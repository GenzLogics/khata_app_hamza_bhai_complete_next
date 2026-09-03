import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cashSales, salesInvoices, salesInvoicePayments, purchaseInvoices, purchaseInvoicePayments, expenses, customers, vendors, users } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api-response";

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = request.cookies.get("access_token")?.value;
  const token = bearerToken || cookieToken;
  if (!token) throw new Error("No token");

  const { verifyAccessToken } = await import("@/lib/auth/jwt");
  const payload = await verifyAccessToken(token);
  if (!payload) throw new Error("Invalid token");

  const [user] = await getDb().select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || !user.isActive) throw new Error("User not found");
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const fromDateParam = searchParams.get("from_date") || "";
    const toDateParam = searchParams.get("to_date") || "";

    if (!fromDateParam || !toDateParam) {
      return badRequest("from_date and to_date are required");
    }

    const fromDate = new Date(fromDateParam);
    const toDate = new Date(toDateParam);
    toDate.setHours(23, 59, 59, 999);

    const [
      cashSalesData,
      salesInvoicesData,
      purchaseInvoicesData,
      expensesData,
    ] = await Promise.all([
      getDb().select().from(cashSales).where(and(eq(cashSales.ownerId, user.id), gte(cashSales.fromDate, fromDate), lte(cashSales.fromDate, toDate))),
      getDb().select().from(salesInvoices).where(and(eq(salesInvoices.ownerId, user.id), gte(salesInvoices.invoiceDate, fromDate), lte(salesInvoices.invoiceDate, toDate))),
      getDb().select().from(purchaseInvoices).where(and(eq(purchaseInvoices.ownerId, user.id), gte(purchaseInvoices.invoiceDate, fromDate), lte(purchaseInvoices.invoiceDate, toDate))),
      getDb().select().from(expenses).where(and(eq(expenses.ownerId, user.id), gte(expenses.fromDate, fromDate), lte(expenses.fromDate, toDate))),
    ]);

    const salesInvoiceIds = salesInvoicesData.map((s) => s.id);
    const purchaseInvoiceIds = purchaseInvoicesData.map((p) => p.id);
    const customerIds = [...new Set(salesInvoicesData.map((s) => s.customerId))];
    const vendorIds = [...new Set(purchaseInvoicesData.map((p) => p.vendorId))];

    const [
      salesPaymentsData,
      purchasePaymentsData,
      customersData,
      vendorsData,
    ] = await Promise.all([
      salesInvoiceIds.length > 0 ? getDb().select().from(salesInvoicePayments).where(and(inArray(salesInvoicePayments.salesInvoiceId, salesInvoiceIds), gte(salesInvoicePayments.paymentDate, fromDate), lte(salesInvoicePayments.paymentDate, toDate))) : Promise.resolve([]),
      purchaseInvoiceIds.length > 0 ? getDb().select().from(purchaseInvoicePayments).where(and(inArray(purchaseInvoicePayments.purchaseInvoiceId, purchaseInvoiceIds), gte(purchaseInvoicePayments.paymentDate, fromDate), lte(purchaseInvoicePayments.paymentDate, toDate))) : Promise.resolve([]),
      customerIds.length > 0 ? getDb().select().from(customers).where(inArray(customers.id, customerIds)) : Promise.resolve([]),
      vendorIds.length > 0 ? getDb().select().from(vendors).where(inArray(vendors.id, vendorIds)) : Promise.resolve([]),
    ]);

    const customerMap = new Map(customersData.map((c) => [c.id, c.name]));
    const vendorMap = new Map(vendorsData.map((v) => [v.id, v.name]));

    const items: Array<{
      date: string;
      type: string;
      amount: number;
      notes: string | null;
      heading: string | null;
      sub_heading: string | null;
      customer_name: string | null;
      vendor_name: string | null;
      invoice_id: string | null;
    }> = [];

    for (const cs of cashSalesData) {
      items.push({
        date: cs.fromDate.toISOString().slice(0, 10),
        type: "cash_sale",
        amount: Number(cs.amount),
        notes: cs.notes,
        heading: null,
        sub_heading: null,
        customer_name: null,
        vendor_name: null,
        invoice_id: cs.id,
      });
    }

    for (const si of salesInvoicesData) {
      items.push({
        date: si.invoiceDate.toISOString().slice(0, 10),
        type: "invoice",
        amount: Number(si.totalAmount),
        notes: si.notes,
        heading: null,
        sub_heading: null,
        customer_name: customerMap.get(si.customerId) || null,
        vendor_name: null,
        invoice_id: si.id,
      });

      if (Number(si.balanceDue) > 0) {
        items.push({
          date: si.invoiceDate.toISOString().slice(0, 10),
          type: "invoice_credit",
          amount: Number(si.balanceDue),
          notes: si.notes,
          heading: null,
          sub_heading: null,
          customer_name: customerMap.get(si.customerId) || null,
          vendor_name: null,
          invoice_id: si.id,
        });
      }
    }

    for (const sp of salesPaymentsData) {
      items.push({
        date: sp.paymentDate.toISOString().slice(0, 10),
        type: "payment",
        amount: Number(sp.amount),
        notes: sp.notes,
        heading: null,
        sub_heading: null,
        customer_name: null,
        vendor_name: null,
        invoice_id: sp.salesInvoiceId,
      });
    }

    for (const pi of purchaseInvoicesData) {
      items.push({
        date: pi.invoiceDate.toISOString().slice(0, 10),
        type: "purchase_invoice",
        amount: Number(pi.totalAmount),
        notes: pi.notes,
        heading: null,
        sub_heading: null,
        customer_name: null,
        vendor_name: vendorMap.get(pi.vendorId) || null,
        invoice_id: pi.id,
      });
    }

    for (const pp of purchasePaymentsData) {
      items.push({
        date: pp.paymentDate.toISOString().slice(0, 10),
        type: "purchase_payment",
        amount: Number(pp.amount),
        notes: pp.notes,
        heading: null,
        sub_heading: null,
        customer_name: null,
        vendor_name: null,
        invoice_id: pp.purchaseInvoiceId,
      });
    }

    for (const e of expensesData) {
      items.push({
        date: e.fromDate.toISOString().slice(0, 10),
        type: "expense",
        amount: Number(e.amount),
        notes: e.notes,
        heading: e.heading,
        sub_heading: e.subHeading,
        customer_name: null,
        vendor_name: null,
        invoice_id: e.id,
      });
    }

    items.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

    return ok({
      message: "Daily breakdown fetched",
      items,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get daily breakdown error:", error);
    return serverError("Failed to fetch daily breakdown");
  }
}

