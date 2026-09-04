import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { investors, users } from "@/lib/db/schema";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { ok, badRequest, unauthorized, conflict, serverError } from "@/lib/api-response";
import { z } from "zod";
import { toSnakeCase } from "@/lib/utils/snake-case";

const createSchema = z.object({
  investment_amount: z.number().positive(),
  investment_date: z.string().min(1).optional(),
  investor_name: z.string().max(255).optional(),
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
    const search = searchParams.get("search") || "";

    const conditions = [eq(investors.ownerId, user.id)];
    if (search) {
      conditions.push(ilike(investors.investorName, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(investors).where(whereClause).orderBy(desc(investors.createdAt)).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(investors).where(whereClause),
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
    console.error("List investors error:", error);
    return serverError("Failed to fetch investors");
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

    const { investment_amount, investment_date, investor_name, notes } = parsed.data;

    const [investor] = await getDb().insert(investors).values({
      ownerId: user.id,
      investmentAmount: investment_amount.toString(),
      investmentDate: investment_date ? new Date(investment_date) : null,
      investorName: investor_name || null,
      notes: notes || null,
    }).returning();

    return ok(toSnakeCase(investor), 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create investor error:", error);
    return serverError("Failed to create investor");
  }
}

