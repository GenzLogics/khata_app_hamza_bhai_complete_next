import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { vendors, users, purchaseInvoices } from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { ok, badRequest, unauthorized, conflict, serverError } from "@/lib/api-response";
import { toSnakeCase } from "@/lib/utils/snake-case";

const createSchema = z.object({
  name: z.string().min(2).max(255),
  phone: z.string().max(20).nullable().optional(),
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

    const conditions = [eq(vendors.ownerId, user.id)];
    if (search) {
      conditions.push(or(sql`${vendors.name} ILIKE ${`%${search}%`}`, sql`${vendors.phone} ILIKE ${`%${search}%`}`)!);
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      getDb().select().from(vendors).where(whereClause).orderBy(vendors.createdAt).offset(skip).limit(limit),
      getDb().select({ count: sql<number>`count(*)` }).from(vendors).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    const vendorsWithDebit = await Promise.all(
      items.map(async (v) => ({
        ...v,
        debit_amount: Number(
          (
            await getDb()
              .select({ total: sql<number>`coalesce(sum(${purchaseInvoices.balanceDue}), 0)` })
              .from(purchaseInvoices)
              .where(eq(purchaseInvoices.vendorId, v.id))
          )[0]?.total || 0
        ),
      }))
    );

    return ok({
      total,
      items: vendorsWithDebit.map(toSnakeCase),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("List vendors error:", error);
    return serverError("Failed to fetch vendors");
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
      const [existing] = await getDb().select().from(vendors).where(and(eq(vendors.ownerId, user.id), eq(vendors.phone, phone))).limit(1);
      if (existing) {
        return conflict("Phone number already exists");
      }
    }

    const [vendor] = await getDb().insert(vendors).values({ ownerId: user.id, name, phone: phone || null }).returning();

    return ok(toSnakeCase(vendor), 201);
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Create vendor error:", error);
    return serverError("Failed to create vendor");
  }
}

