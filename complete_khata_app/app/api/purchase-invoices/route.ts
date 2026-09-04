import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  purchaseInvoices,
  purchaseInvoiceItems,
  purchaseInvoicePayments,
  vendors,
  stockItems,
  users,
} from "@/lib/db/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, conflict, serverError } from "@/lib/api-response";
import { z } from "zod";
import { toSnakeCase, formatDateOnly } from "@/lib/utils/snake-case";

const createSchema = z.object({
  vendor_id: z.string().uuid(),
  purchase_type: z.enum(["cash", "credit"]),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().positive(),
      unit_type: z.string().optional(),
      weight_per_unit: z.number().optional(),
      total_weight: z.number().optional(),
      unit_price: z.number().positive(),
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
    const vendor_id = searchParams.get("vendor_id") || "";
    const fromDate = searchParams.get("from_date") || "";
    const toDate = searchParams.get("to_date") || "";

    const conditions = [eq(purchaseInvoices.ownerId, user.id)];
    if (vendor_id) conditions.push(eq(purchaseInvoices.vendorId, vendor_id));
    if (fromDate) conditions.push(gte(purchaseInvoices.invoiceDate, new Date(fromDate)));
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(purchaseInvoices.invoiceDate, endOfDay));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(purchaseInvoices).where(whereClause).orderBy(desc(purchaseInvoices.createdAt)).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(purchaseInvoices).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return ok({ total, items: items.map(toSnakeCase) });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List purchase invoices error:", error);
    return serverError("Failed to fetch purchase invoices");
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

    const { vendor_id, purchase_type, items, amount_paid, discount, notes, invoice_date, due_date, invoice_number } = parsed.data;

    const [vendor] = await getDb().select().from(vendors).where(and(eq(vendors.id, vendor_id), eq(vendors.ownerId, user.id))).limit(1);
    if (!vendor) return notFound("Vendor not found");

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const discountAmount = discount ?? 0;
    const totalAmount = Math.max(subtotal - discountAmount, 0);
    const effectiveAmountPaid = purchase_type === "cash" ? totalAmount : (amount_paid ?? 0);
    const balanceDue = Math.max(totalAmount - effectiveAmountPaid, 0);

    const invoiceDate = invoice_date ? new Date(invoice_date) : new Date();
    const dueDate = due_date ? new Date(due_date) : null;

    let finalInvoiceNumber = invoice_number;
    if (!finalInvoiceNumber) {
      const [countResult] = await getDb().select({ count: sql<number>`count(*)` }).from(purchaseInvoices).where(sql`${purchaseInvoices.invoiceNumber} LIKE 'PINV-%'`);
      const count = Number(countResult?.count || 0);
      const dateStr = formatDateOnly(invoiceDate)?.replace(/-/g, "") || "";
      const book = String(1).padStart(3, "0");
      const serial = String(count + 1).padStart(4, "0");
      finalInvoiceNumber = `PINV-${dateStr}-B${book}-${serial}`;
    }

    const invoice = await getDb().transaction(async (tx) => {
      const [newInvoice] = await tx.insert(purchaseInvoices).values({
        ownerId: user.id,
        invoiceNumber: finalInvoiceNumber,
        vendorId: vendor_id,
        purchaseType: purchase_type,
        subtotal: subtotal.toString(),
        discount: discountAmount.toString(),
        totalAmount: totalAmount.toString(),
        amountPaid: effectiveAmountPaid.toString(),
        balanceDue: balanceDue.toString(),
        notes: notes || null,
        invoiceDate,
        dueDate,
      }).returning();

      const insertedItems = await Promise.all(
        items.map((item) =>
          tx.insert(purchaseInvoiceItems).values({
            purchaseInvoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity.toString(),
            unitType: item.unit_type || "bag",
            weightPerUnit: item.weight_per_unit?.toString() || null,
            totalWeight: item.total_weight?.toString() || null,
            unitPrice: item.unit_price.toString(),
            totalPrice: (item.quantity * item.unit_price).toString(),
          }).returning()
        )
      );

      for (const item of items) {
        const weight = item.total_weight ?? (item.weight_per_unit ? item.quantity * item.weight_per_unit : item.quantity);
        const normalizedName = item.description.trim().toLowerCase();

        const [existingStock] = await tx.select().from(stockItems).where(and(eq(stockItems.ownerId, user.id), eq(stockItems.itemName, normalizedName))).limit(1);

        if (existingStock) {
          await tx.update(stockItems).set({ quantityKg: sql`${stockItems.quantityKg} + ${weight}` }).where(eq(stockItems.id, existingStock.id));
        } else {
          await tx.insert(stockItems).values({
            ownerId: user.id,
            itemName: normalizedName,
            quantityKg: weight.toString(),
            bagWeightKg: "50",
          });
        }
      }

      if (balanceDue > 0) {
        await tx.update(vendors).set({ currentBalance: sql`${vendors.currentBalance} + ${balanceDue}` }).where(eq(vendors.id, vendor_id));
      }

      return { invoice: newInvoice, items: insertedItems };
    });

    return ok(toSnakeCase({
      ...invoice.invoice,
      items: invoice.items,
      payments: [],
    }), 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create purchase invoice error:", error);
    return serverError("Failed to create purchase invoice");
  }
}

