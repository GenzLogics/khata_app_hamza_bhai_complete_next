import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { investors, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

    const [summary] = await getDb().select({
      total_invested: sql<number>`coalesce(sum(${investors.investmentAmount}), 0)`,
      count: sql<number>`count(*)`,
    }).from(investors).where(eq(investors.ownerId, user.id));

    return ok({
      message: "Investor summary fetched",
      total_invested: Number(summary?.total_invested || 0),
      count: Number(summary?.count || 0),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get investor summary error:", error);
    return serverError("Failed to fetch investor summary");
  }
}

