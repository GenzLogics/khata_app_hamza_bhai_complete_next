import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { salesInvoices, purchaseInvoices, customers, vendors, users } from "@/lib/db/schema";
import { eq, and, sql, desc, lte } from "drizzle-orm";
import { ok, serverError, unauthorized } from "@/lib/api-response";

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

    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(reminderDate.getDate() + 2);

    const salesUnpaidResult = await getDb().select({
      id: salesInvoices.id,
      invoice_number: salesInvoices.invoiceNumber,
      party_name: customers.name,
      balance_due: salesInvoices.balanceDue,
      due_date: salesInvoices.dueDate,
    }).from(salesInvoices)
      .where(and(eq(salesInvoices.ownerId, user.id), sql`${salesInvoices.balanceDue} > 0`, lte(salesInvoices.dueDate, reminderDate)))
      .innerJoin(customers, eq(salesInvoices.customerId, customers.id))
      .orderBy(desc(salesInvoices.dueDate))
      .limit(5);

    const purchaseUnpaidResult = await getDb().select({
      id: purchaseInvoices.id,
      invoice_number: purchaseInvoices.invoiceNumber,
      party_name: vendors.name,
      balance_due: purchaseInvoices.balanceDue,
      due_date: purchaseInvoices.dueDate,
    }).from(purchaseInvoices)
      .where(and(eq(purchaseInvoices.ownerId, user.id), sql`${purchaseInvoices.balanceDue} > 0`, lte(purchaseInvoices.dueDate, reminderDate)))
      .innerJoin(vendors, eq(purchaseInvoices.vendorId, vendors.id))
      .orderBy(desc(purchaseInvoices.dueDate))
      .limit(5);

    const salesUnpaidCount = await getDb().select({ count: sql<number>`count(*)` }).from(salesInvoices).where(and(eq(salesInvoices.ownerId, user.id), sql`${salesInvoices.balanceDue} > 0`, lte(salesInvoices.dueDate, reminderDate)));
    const purchaseUnpaidCount = await getDb().select({ count: sql<number>`count(*)` }).from(purchaseInvoices).where(and(eq(purchaseInvoices.ownerId, user.id), sql`${purchaseInvoices.balanceDue} > 0`, lte(purchaseInvoices.dueDate, reminderDate)));

    return ok({
      sales_unpaid_count: Number(salesUnpaidCount[0]?.count || 0),
      purchase_unpaid_count: Number(purchaseUnpaidCount[0]?.count || 0),
      sales_unpaid: salesUnpaidResult,
      purchase_unpaid: purchaseUnpaidResult,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get reminders error:", error);
    return serverError("Failed to fetch reminders");
  }
}

