import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  salesInvoices,
  salesInvoiceItems,
  salesInvoicePayments,
  customers,
  stockItems,
  users,
} from "@/lib/db/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, conflict, serverError } from "@/lib/api-response";
import { z } from "zod";

const createSchema = z.object({
  customer_id: z.string().uuid(),
  sale_type: z.enum(["cash", "credit"]),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unit_type: z.string().optional(),
      weight_per_unit: z.number().optional(),
      total_weight: z.number().optional(),
      unit_price: z.number().positive(),
      is_custom: z.boolean().optional(),
    })
  ),
  amount_paid: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  invoice_number: z.string().optional(),
});

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
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const customer_id = searchParams.get("customer_id") || "";
    const fromDate = searchParams.get("from_date") || "";
    const toDate = searchParams.get("to_date") || "";

    const conditions = [eq(salesInvoices.ownerId, user.id)];
    if (customer_id) conditions.push(eq(salesInvoices.customerId, customer_id));
    if (fromDate) conditions.push(gte(salesInvoices.invoiceDate, new Date(fromDate)));
    if (toDate) conditions.push(lte(salesInvoices.invoiceDate, new Date(toDate)));

    const whereClause = and(...conditions);

    const [invoices, totalResult] = await Promise.all([
      getDb().select().from(salesInvoices).where(whereClause).orderBy(desc(salesInvoices.createdAt)).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(salesInvoices).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    const result = await Promise.all(
      invoices.map(async (invoice) => {
        const [items, payments] = await Promise.all([
          getDb().select().from(salesInvoiceItems).where(eq(salesInvoiceItems.salesInvoiceId, invoice.id)),
          getDb().select().from(salesInvoicePayments).where(eq(salesInvoicePayments.salesInvoiceId, invoice.id)),
        ]);
        return { ...invoice, items, payments };
      })
    );

    return ok({ message: "Sales invoices fetched", total, items: result });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List sales invoices error:", error);
    return serverError("Failed to fetch sales invoices");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || "Validation failed");
    }

    const { customer_id, sale_type, items, amount_paid, discount, notes, invoice_date, due_date, invoice_number } = parsed.data;

    const [customer] = await getDb().select().from(customers).where(and(eq(customers.id, customer_id), eq(customers.ownerId, user.id))).limit(1);
    if (!customer) return notFound("Customer not found");

    const lineItems = items.map((item) => {
      const weight = item.total_weight ?? (item.weight_per_unit ? item.quantity * item.weight_per_unit : item.quantity);
      return { ...item, lineWeight: weight };
    });

    const subtotal = lineItems.reduce((sum, item) => sum + item.lineWeight * item.unit_price, 0);
    const discountAmount = discount ?? 0;
    const totalAmount = Math.max(subtotal - discountAmount, 0);
    const effectiveAmountPaid = sale_type === "cash" ? totalAmount : (amount_paid ?? 0);

    if (effectiveAmountPaid > totalAmount) {
      return badRequest("Amount paid cannot exceed total amount");
    }

    const balanceDue = Math.max(totalAmount - effectiveAmountPaid, 0);

    const invoiceDate = invoice_date ? new Date(invoice_date) : new Date();
    const dueDate = due_date ? new Date(due_date) : null;

    let finalInvoiceNumber = invoice_number;
    if (!finalInvoiceNumber) {
      const [countResult] = await getDb().select({ count: sql<number>`count(*)` }).from(salesInvoices).where(sql`${salesInvoices.invoiceNumber} LIKE 'SINV-%'`);
      const count = Number(countResult?.count || 0);
      const dateStr = invoiceDate.toISOString().slice(0, 10).replace(/-/g, "");
      const book = String(Math.floor(count / 100) + 1).padStart(3, "0");
      const serial = String((count % 100) + 1).padStart(4, "0");
      finalInvoiceNumber = `SINV-${dateStr}-B${book}-${serial}`;
    }

    const stockChecks = lineItems.filter((item) => !item.is_custom);
    for (const item of stockChecks) {
      const normalizedName = item.description.trim().toLowerCase();
      const [existingStock] = await getDb().select().from(stockItems).where(and(eq(stockItems.ownerId, user.id), eq(stockItems.itemName, normalizedName))).limit(1);

      if (!existingStock) {
        return badRequest(`Stock item not found: ${item.description}`);
      }

      const bagWeight = Number(existingStock.bagWeightKg);
      const requiredWeight = Math.ceil(item.lineWeight / bagWeight) * bagWeight;
      if (Number(existingStock.quantityKg) < requiredWeight) {
        return badRequest(`Insufficient stock for ${item.description}`);
      }
    }

    const result = await getDb().transaction(async (tx) => {
      const [newInvoice] = await tx.insert(salesInvoices).values({
        ownerId: user.id,
        invoiceNumber: finalInvoiceNumber,
        customerId: customer_id,
        saleType: sale_type,
        subtotal: subtotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        amountPaid: effectiveAmountPaid.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
        notes: notes || null,
        invoiceDate,
        dueDate,
      }).returning();

      const insertedItems = await Promise.all(
        lineItems.map((item) =>
          tx.insert(salesInvoiceItems).values({
            salesInvoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity.toString(),
            unitType: item.unit_type || "kg",
            weightPerUnit: item.weight_per_unit?.toString() || null,
            totalWeight: item.total_weight?.toString() || null,
            unitPrice: item.unit_price.toString(),
            totalPrice: (item.lineWeight * item.unit_price).toFixed(2),
          }).returning()
        )
      );

      for (const item of stockChecks) {
        const normalizedName = item.description.trim().toLowerCase();
        const [existingStock] = await tx.select().from(stockItems).where(and(eq(stockItems.ownerId, user.id), eq(stockItems.itemName, normalizedName))).limit(1);

        const bagWeight = Number(existingStock!.bagWeightKg);
        const requiredWeight = Math.ceil(item.lineWeight / bagWeight) * bagWeight;
        await tx.update(stockItems).set({ quantityKg: sql`${stockItems.quantityKg} - ${requiredWeight}` }).where(eq(stockItems.id, existingStock!.id));
      }

      const insertedPayments = await tx.select().from(salesInvoicePayments).where(eq(salesInvoicePayments.salesInvoiceId, newInvoice.id));

      return { invoice: newInvoice, items: insertedItems, payments: insertedPayments };
    });

    return ok({
      message: "Sales invoice created",
      invoice: {
        ...result.invoice,
        items: result.items,
        payments: result.payments,
      },
    }, 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create sales invoice error:", error);
    return serverError("Failed to create sales invoice");
  }
}

