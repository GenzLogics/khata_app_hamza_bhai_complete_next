import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cashSales, salesInvoices, salesInvoicePayments, purchaseInvoices, purchaseInvoicePayments, expenses, users } from "@/lib/db/schema";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { ok, unauthorized, serverError } from "@/lib/api-response";

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
    const period = searchParams.get("period") || "";
    const fromDateParam = searchParams.get("from_date") || "";
    const toDateParam = searchParams.get("to_date") || "";

    let fromDate: Date;
    let toDate: Date = new Date();
    toDate.setHours(23, 59, 59, 999);

    if (fromDateParam && toDateParam) {
      fromDate = new Date(fromDateParam);
      toDate = new Date(toDateParam);
      toDate.setHours(23, 59, 59, 999);
    } else if (period) {
      const now = new Date();
      toDate = new Date(now);
      toDate.setHours(23, 59, 59, 999);

      switch (period) {
        case "1d":
          fromDate = new Date(now);
          fromDate.setHours(0, 0, 0, 0);
          break;
        case "7d":
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 6);
          fromDate.setHours(0, 0, 0, 0);
          break;
        case "1m":
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 29);
          fromDate.setHours(0, 0, 0, 0);
          break;
        case "3m":
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 89);
          fromDate.setHours(0, 0, 0, 0);
          break;
        case "6m":
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 179);
          fromDate.setHours(0, 0, 0, 0);
          break;
        case "1y":
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 364);
          fromDate.setHours(0, 0, 0, 0);
          break;
        default:
          fromDate = new Date(now);
          fromDate.setHours(0, 0, 0, 0);
      }
    } else {
      fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
    }

    const [
      cashSalesResult,
      salesInvoicesResult,
      salesInvoicesData,
      purchaseInvoicesResult,
      purchaseBalanceDueResult,
      expensesResult,
    ] = await Promise.all([
      getDb().select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${cashSales.amount}), 0)` }).from(cashSales).where(and(eq(cashSales.ownerId, user.id), gte(cashSales.fromDate, fromDate), lte(cashSales.fromDate, toDate))),
      getDb().select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${salesInvoices.totalAmount}), 0)` }).from(salesInvoices).where(and(eq(salesInvoices.ownerId, user.id), gte(salesInvoices.invoiceDate, fromDate), lte(salesInvoices.invoiceDate, toDate))),
      getDb().select().from(salesInvoices).where(and(eq(salesInvoices.ownerId, user.id), gte(salesInvoices.invoiceDate, fromDate), lte(salesInvoices.invoiceDate, toDate))),
      getDb().select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${purchaseInvoices.totalAmount}), 0)` }).from(purchaseInvoices).where(and(eq(purchaseInvoices.ownerId, user.id), gte(purchaseInvoices.invoiceDate, fromDate), lte(purchaseInvoices.invoiceDate, toDate))),
      getDb().select({ total: sql<number>`coalesce(sum(${purchaseInvoices.balanceDue}), 0)` }).from(purchaseInvoices).where(and(eq(purchaseInvoices.ownerId, user.id), gte(purchaseInvoices.invoiceDate, fromDate), lte(purchaseInvoices.invoiceDate, toDate))),
      getDb().select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.ownerId, user.id), gte(expenses.fromDate, fromDate), lte(expenses.fromDate, toDate))),
    ]);

    const salesInvoiceIds = salesInvoicesData.map((s) => s.id);
    const amountPaidResult = salesInvoiceIds.length > 0
      ? await getDb().select({ total: sql<number>`coalesce(sum(${salesInvoicePayments.amount}), 0)` }).from(salesInvoicePayments).where(and(inArray(salesInvoicePayments.salesInvoiceId, salesInvoiceIds), gte(salesInvoicePayments.paymentDate, fromDate), lte(salesInvoicePayments.paymentDate, toDate)))
      : [{ total: 0 }];

    return ok({
      message: "Dashboard summary fetched",
      cash_sales_count: Number(cashSalesResult[0]?.count || 0),
      cash_sales_total: Number(cashSalesResult[0]?.total || 0),
      sales_invoices_count: Number(salesInvoicesResult[0]?.count || 0),
      sales_total: Number(salesInvoicesResult[0]?.total || 0),
      amount_paid_total: Number(amountPaidResult[0]?.total || 0),
      balance_due_total: Number(salesInvoicesResult[0]?.total || 0) - Number(amountPaidResult[0]?.total || 0),
      purchase_invoices_count: Number(purchaseInvoicesResult[0]?.count || 0),
      purchase_total: Number(purchaseInvoicesResult[0]?.total || 0),
      purchase_balance_due_total: Number(purchaseBalanceDueResult[0]?.total || 0),
      expenses_total: Number(expensesResult[0]?.total || 0),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get dashboard summary error:", error);
    return serverError("Failed to fetch dashboard summary");
  }
}

