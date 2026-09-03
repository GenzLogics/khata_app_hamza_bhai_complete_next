import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { purchaseInvoices, purchaseInvoicePayments, vendors, purchaseInvoiceItems, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, badRequest, notFound, unauthorized, serverError } from "@/lib/api-response";
import { z } from "zod";

const createPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_date: z.string(),
  notes: z.string().optional(),
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);
    const { id } = await params;

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || "Validation failed");
    }

    const { amount, payment_date, notes } = parsed.data;

    const [invoice] = await getDb().select().from(purchaseInvoices).where(and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.ownerId, user.id))).limit(1);

    if (!invoice) return notFound("Purchase invoice not found");

    const currentBalanceDue = Number(invoice.balanceDue);
    if (amount > currentBalanceDue) {
      return badRequest("Payment amount exceeds balance due");
    }

    const paymentDate = new Date(payment_date);

    const result = await getDb().transaction(async (tx) => {
      await tx.insert(purchaseInvoicePayments).values({
        purchaseInvoiceId: id,
        amount: amount.toString(),
        paymentDate,
        notes: notes || null,
      });

      const newAmountPaid = Number(invoice.amountPaid) + amount;
      const newBalanceDue = Math.max(Number(invoice.totalAmount) - newAmountPaid, 0);

      const [updatedInvoice] = await tx.update(purchaseInvoices).set({
        amountPaid: newAmountPaid.toString(),
        balanceDue: newBalanceDue.toString(),
      }).where(eq(purchaseInvoices.id, id)).returning();

      if (amount > 0) {
        await tx.update(vendors).set({ currentBalance: sql`${vendors.currentBalance} - ${amount}` }).where(eq(vendors.id, invoice.vendorId));
      }

      const items = await tx.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.purchaseInvoiceId, id));
      const payments = await tx.select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.purchaseInvoiceId, id));

      return { invoice: updatedInvoice, items, payments };
    });

    return ok({
      message: "Payment recorded",
      invoice: result,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Record purchase payment error:", error);
    return serverError("Failed to record payment");
  }
}
