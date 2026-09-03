import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { investors, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";
import { toSnakeCase } from "@/lib/utils/snake-case";

const updateSchema = z.object({
  investment_amount: z.number().positive().optional(),
  investment_date: z.string().datetime().optional(),
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [investor] = await getDb().select().from(investors).where(and(eq(investors.id, id), eq(investors.ownerId, user.id))).limit(1);

    if (!investor) return notFound("Investor not found");

    return ok(toSnakeCase(investor));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get investor error:", error);
    return serverError("Failed to fetch investor");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    const { id } = await params;

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || "Validation failed");
    }

    const [existing] = await getDb().select().from(investors).where(and(eq(investors.id, id), eq(investors.ownerId, user.id))).limit(1);
    if (!existing) return notFound("Investor not found");

    const updateData: Record<string, unknown> = {};
    if (parsed.data.investment_amount !== undefined) updateData.investmentAmount = parsed.data.investment_amount.toString();
    if (parsed.data.investment_date !== undefined) updateData.investmentDate = parsed.data.investment_date ? new Date(parsed.data.investment_date) : null;
    if (parsed.data.investor_name !== undefined) updateData.investorName = parsed.data.investor_name || null;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes || null;

    const [updated] = await getDb().update(investors).set(updateData).where(eq(investors.id, id)).returning();

    return ok(toSnakeCase(updated));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Update investor error:", error);
    return serverError("Failed to update investor");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [investor] = await getDb().select().from(investors).where(and(eq(investors.id, id), eq(investors.ownerId, user.id))).limit(1);

    if (!investor) return notFound("Investor not found");

    await getDb().delete(investors).where(eq(investors.id, id));

    return ok(toSnakeCase(investor));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete investor error:", error);
    return serverError("Failed to delete investor");
  }
}
