import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { expenses, users } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api-response";
import { z } from "zod";
import { toSnakeCase } from "@/lib/utils/snake-case";

const createSchema = z.object({
  amount: z.number().positive(),
  from_date: z.string().datetime(),
  to_date: z.string().datetime(),
  heading: z.string().min(1).max(100),
  sub_heading: z.string().max(100).optional(),
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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const fromDate = searchParams.get("from_date") || "";
    const toDate = searchParams.get("to_date") || "";

    const conditions = [eq(expenses.ownerId, user.id)];
    if (fromDate) conditions.push(gte(expenses.fromDate, new Date(fromDate)));
    if (toDate) {
      const endOfDay = new Date(toDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(expenses.toDate, endOfDay));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(expenses).where(whereClause).orderBy(desc(expenses.createdAt)).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(expenses).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return ok({
      total,
      items: items.map(toSnakeCase),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List expenses error:", error);
    return serverError("Failed to fetch expenses");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || "Validation failed");
    }

    const { amount, from_date, to_date, heading, sub_heading, notes } = parsed.data;

    const [expense] = await getDb().insert(expenses).values({
      ownerId: user.id,
      amount: amount.toString(),
      fromDate: new Date(from_date),
      toDate: new Date(to_date),
      heading,
      subHeading: sub_heading || null,
      notes: notes || null,
    }).returning();

    return ok(toSnakeCase(expense), 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create expense error:", error);
    return serverError("Failed to create expense");
  }
}

