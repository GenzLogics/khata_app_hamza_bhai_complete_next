import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cashSales, users } from "@/lib/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { ok, badRequest, serverError, unauthorized } from "@/lib/api-response";
import { z } from "zod";
import { toSnakeCase } from "@/lib/utils/snake-case";

const createCashSaleSchema = z.object({
  amount: z.number().positive(),
  from_date: z.string().min(1, "From date is required"),
  to_date: z.string().min(1, "To date is required"),
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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const parsed = createCashSaleSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || "Validation failed");
    }

    const { amount, from_date, to_date, notes } = parsed.data;

    const [cashSale] = await getDb().insert(cashSales).values({
      ownerId: user.id,
      amount: amount.toString(),
      fromDate: new Date(from_date),
      toDate: new Date(to_date),
      notes: notes || null,
    }).returning();

    return ok(toSnakeCase(cashSale), 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create cash sale error:", error);
    return serverError("Failed to create cash sale");
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const fromDate = searchParams.get("from_date") ? new Date(searchParams.get("from_date")!) : undefined;
    const toDate = searchParams.get("to_date") ? new Date(searchParams.get("to_date")!) : undefined;

    const conditions = [eq(cashSales.ownerId, user.id)];
    if (fromDate) conditions.push(gte(cashSales.fromDate, fromDate));
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(cashSales.toDate, endOfDay));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(cashSales).where(whereClause).orderBy(cashSales.createdAt).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(cashSales).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return ok({ total, items: items.map(toSnakeCase) });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List cash sales error:", error);
    return serverError("Failed to fetch cash sales");
  }
}

