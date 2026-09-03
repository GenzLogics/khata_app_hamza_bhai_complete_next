import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { getCurrentUser, AuthenticatedUser } from "@/lib/auth/get-user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { z } from "zod";
import { ok, badRequest, unauthorized, conflict, serverError, notFound } from "@/lib/api-response";
import { toSnakeCase } from "@/lib/utils/snake-case";

const createSchema = z.object({
  name: z.string().min(2).max(255),
  phone: z.string().max(20).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).nullable().optional(),
});

async function getAuthUser(request: NextRequest): Promise<AuthenticatedUser> {
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

  return { id: user.id, email: user.email, fullName: user.fullName, isActive: user.isActive };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const search = searchParams.get("search") || "";

    const conditions = [eq(customers.ownerId, user.id)];
    if (search) {
      conditions.push(or(sql`${customers.name} ILIKE ${`%${search}%`}`, sql`${customers.phone} ILIKE ${`%${search}%`}`)!);
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(customers).where(whereClause).orderBy(customers.createdAt).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(customers).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return ok({
      total,
      items: items.map((c) =>
        toSnakeCase({
          ...c,
          credit_amount: 0,
        })
      ),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List customers error:", error);
    return serverError("Failed to fetch customers");
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

    const { name, phone } = parsed.data;

    if (phone) {
      const [existing] = await getDb().select().from(customers).where(and(eq(customers.ownerId, user.id), eq(customers.phone, phone))).limit(1);
      if (existing) {
        return conflict("Phone number already exists");
      }
    }

    const [customer] = await getDb().insert(customers).values({ ownerId: user.id, name, phone: phone || null }).returning();

    return ok({ message: "Customer created", customer: toSnakeCase(customer) }, 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create customer error:", error);
    return serverError("Failed to create customer");
  }
}

