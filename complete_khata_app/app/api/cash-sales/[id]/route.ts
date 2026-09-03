import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cashSales, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, notFound, serverError, unauthorized } from "@/lib/api-response";
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
    const [cashSale] = await getDb().select().from(cashSales).where(and(eq(cashSales.id, id), eq(cashSales.ownerId, user.id))).limit(1);

    if (!cashSale) return notFound("Cash sale not found");

    return ok(toSnakeCase(cashSale));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get cash sale error:", error);
    return serverError("Failed to fetch cash sale");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const { id } = await params;

    const [existing] = await getDb().select().from(cashSales).where(and(eq(cashSales.id, id), eq(cashSales.ownerId, user.id))).limit(1);
    if (!existing) return notFound("Cash sale not found");

    const updateData: Record<string, unknown> = {};
    if (body.amount !== undefined) updateData.amount = body.amount.toString();
    if (body.from_date !== undefined) updateData.fromDate = new Date(body.from_date);
    if (body.to_date !== undefined) updateData.toDate = new Date(body.to_date);
    if (body.notes !== undefined) updateData.notes = body.notes;

    const [updated] = await getDb().update(cashSales).set(updateData).where(eq(cashSales.id, id)).returning();

    return ok(toSnakeCase(updated));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Update cash sale error:", error);
    return serverError("Failed to update cash sale");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [cashSale] = await getDb().select().from(cashSales).where(and(eq(cashSales.id, id), eq(cashSales.ownerId, user.id))).limit(1);

    if (!cashSale) return notFound("Cash sale not found");

    await getDb().delete(cashSales).where(eq(cashSales.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete cash sale error:", error);
    return serverError("Failed to delete cash sale");
  }
}
