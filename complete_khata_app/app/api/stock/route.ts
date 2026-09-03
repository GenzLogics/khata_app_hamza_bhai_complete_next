import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stockItems, users } from "@/lib/db/schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import { ok, serverError, unauthorized } from "@/lib/api-response";
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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";

    const conditions = [eq(stockItems.ownerId, user.id)];
    if (search) {
      conditions.push(ilike(stockItems.itemName, `%${search.toLowerCase()}%`));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(stockItems).where(whereClause).orderBy(stockItems.itemName).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(stockItems).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return ok({ message: "Stock fetched", total, items: items.map(toSnakeCase) });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List stock error:", error);
    return serverError("Failed to fetch stock");
  }
}

