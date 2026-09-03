import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customers, salesInvoices, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, unauthorized, notFound, serverError } from "@/lib/api-response";

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
    const [customer] = await getDb().select().from(customers).where(and(eq(customers.id, id), eq(customers.ownerId, user.id))).limit(1);

    if (!customer) return notFound("Customer not found");

    const [creditResult] = await getDb().select({ total: sql<number>`coalesce(sum(${salesInvoices.balanceDue}), 0)` }).from(salesInvoices).where(and(eq(salesInvoices.customerId, id), eq(salesInvoices.ownerId, user.id)));
    const creditAmount = Number(creditResult?.total || 0);

    return ok({
      customer_id: customer.id,
      credit_amount: Math.round(creditAmount * 100) / 100,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get customer credit error:", error);
    return serverError("Failed to fetch customer credit");
  }
}
