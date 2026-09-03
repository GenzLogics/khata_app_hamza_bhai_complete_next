import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  salesInvoices,
  salesInvoiceItems,
  salesInvoicePayments,
  stockItems,
  users,
} from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { ok, badRequest, notFound, unauthorized, serverError } from "@/lib/api-response";
import { toSnakeCase } from "@/lib/utils/snake-case";

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
    const [invoice] = await getDb().select().from(salesInvoices).where(and(eq(salesInvoices.id, id), eq(salesInvoices.ownerId, user.id))).limit(1);

    if (!invoice) return notFound("Sales invoice not found");

    const items = await getDb().select().from(salesInvoiceItems).where(eq(salesInvoiceItems.salesInvoiceId, id));
    const payments = await getDb().select().from(salesInvoicePayments).where(eq(salesInvoicePayments.salesInvoiceId, id));

    return ok({
      message: "Sales invoice fetched",
      invoice: toSnakeCase({ ...invoice, items, payments }),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get sales invoice error:", error);
    return serverError("Failed to fetch sales invoice");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [invoice] = await getDb().select().from(salesInvoices).where(and(eq(salesInvoices.id, id), eq(salesInvoices.ownerId, user.id))).limit(1);

    if (!invoice) return notFound("Sales invoice not found");

    const items = await getDb().select().from(salesInvoiceItems).where(eq(salesInvoiceItems.salesInvoiceId, id));

    await getDb().transaction(async (tx) => {
      for (const item of items) {
        const lineWeight = item.totalWeight ? Number(item.totalWeight) : (item.weightPerUnit ? Number(item.quantity) * Number(item.weightPerUnit) : Number(item.quantity));
        const normalizedName = item.description.trim().toLowerCase();

        const [existingStock] = await tx.select().from(stockItems).where(and(eq(stockItems.ownerId, user.id), eq(stockItems.itemName, normalizedName))).limit(1);

        if (existingStock) {
          await tx.update(stockItems).set({ quantityKg: sql`${stockItems.quantityKg} + ${lineWeight}` }).where(eq(stockItems.id, existingStock.id));
        } else {
          await tx.insert(stockItems).values({
            ownerId: user.id,
            itemName: normalizedName,
            quantityKg: lineWeight.toString(),
            bagWeightKg: "50",
          });
        }
      }

      await tx.delete(salesInvoices).where(eq(salesInvoices.id, id));
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete sales invoice error:", error);
    return serverError("Failed to delete sales invoice");
  }
}
