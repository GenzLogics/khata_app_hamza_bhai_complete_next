import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stockItems, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, notFound, serverError, unauthorized } from "@/lib/api-response";
import { z } from "zod";

const returnBagsSchema = z.object({
  item_name: z.string().min(1),
  bag_count: z.number().int().positive(),
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
    const parsed = returnBagsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ detail: parsed.error.errors[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { item_name, bag_count } = parsed.data;
    const normalizedName = item_name.trim().toLowerCase();

    const [stock] = await getDb().select().from(stockItems).where(and(eq(stockItems.ownerId, user.id), eq(stockItems.itemName, normalizedName))).limit(1);

    if (!stock) return notFound("Stock item not found");

    const addedWeight = bag_count * Number(stock.bagWeightKg);

    const [updated] = await getDb().update(stockItems).set({ quantityKg: sql`${stockItems.quantityKg} + ${addedWeight}` }).where(eq(stockItems.id, stock.id)).returning();

    return ok({ message: "Bags returned successfully", stock: updated, returned_bags: bag_count });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Return bags error:", error);
    return serverError("Failed to return bags");
  }
}

