import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cashSales, users } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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
    const fromDate = searchParams.get("from_date") || "";
    const toDate = searchParams.get("to_date") || "";

    const conditions = [eq(cashSales.ownerId, user.id)];
    if (fromDate) conditions.push(gte(cashSales.fromDate, new Date(fromDate)));
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(cashSales.toDate, endOfDay));
    }

    const whereClause = and(...conditions);

    const [result] = await getDb()
      .select({ total_count: sql<number>`count(*)`, total_amount: sql<number>`coalesce(sum(CAST(${cashSales.amount} AS NUMERIC)), 0)` })
      .from(cashSales)
      .where(whereClause);

    const total_count = Number(result?.total_count || 0);
    const total_amount = Number(result?.total_amount || 0);

    return ok({ total_count, total_amount });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Cash sales summary error:", error);
    return serverError("Failed to fetch cash sales summary");
  }
}
