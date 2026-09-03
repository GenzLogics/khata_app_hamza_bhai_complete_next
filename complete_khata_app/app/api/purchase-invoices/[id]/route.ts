import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { purchaseInvoices, vendors, purchaseInvoiceItems, purchaseInvoicePayments, users, stockItems } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, notFound, unauthorized, serverError } from "@/lib/api-response";

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [invoice] = await getDb().select().from(purchaseInvoices).where(and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.ownerId, user.id))).limit(1);

    if (!invoice) return notFound("Purchase invoice not found");

    const items = await getDb().select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.purchaseInvoiceId, id));
    const payments = await getDb().select().from(purchaseInvoicePayments).where(eq(purchaseInvoicePayments.purchaseInvoiceId, id));

    return ok({
      message: "Purchase invoice fetched",
      invoice: { ...invoice, items, payments },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get purchase invoice error:", error);
    return serverError("Failed to fetch purchase invoice");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [invoice] = await getDb().select().from(purchaseInvoices).where(and(eq(purchaseInvoices.id, id), eq(purchaseInvoices.ownerId, user.id))).limit(1);

    if (!invoice) return notFound("Purchase invoice not found");

    const items = await getDb().select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.purchaseInvoiceId, id));

    await getDb().transaction(async (tx) => {
      for (const item of items) {
        const weight = item.totalWeight ? Number(item.totalWeight) : (item.weightPerUnit ? Number(item.quantity) * Number(item.weightPerUnit) : Number(item.quantity));
        const normalizedName = item.description.trim().toLowerCase();

        const [existingStock] = await tx.select().from(stockItems).where(and(eq(stockItems.ownerId, user.id), eq(stockItems.itemName, normalizedName))).limit(1);

        if (existingStock) {
          await tx.update(stockItems).set({ quantityKg: sql`${stockItems.quantityKg} - ${weight}` }).where(eq(stockItems.id, existingStock.id));
        }
      }

      await tx.delete(purchaseInvoices).where(eq(purchaseInvoices.id, id));

      const originalBalanceDue = Number(invoice.balanceDue);
      if (originalBalanceDue > 0) {
        await tx.update(vendors).set({ currentBalance: sql`${vendors.currentBalance} - ${originalBalanceDue}` }).where(eq(vendors.id, invoice.vendorId));
      }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete purchase invoice error:", error);
    return serverError("Failed to delete purchase invoice");
  }
}
