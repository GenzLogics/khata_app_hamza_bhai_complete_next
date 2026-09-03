import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { expenses, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";
import { toSnakeCase } from "@/lib/utils/snake-case";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  heading: z.string().min(1).max(100).optional(),
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [expense] = await getDb().select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.ownerId, user.id))).limit(1);

    if (!expense) return notFound("Expense not found");

    return ok(toSnakeCase(expense));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get expense error:", error);
    return serverError("Failed to fetch expense");
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

    const [existing] = await getDb().select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.ownerId, user.id))).limit(1);
    if (!existing) return notFound("Expense not found");

    const updateData: Record<string, unknown> = {};
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount.toString();
    if (parsed.data.from_date !== undefined) updateData.fromDate = new Date(parsed.data.from_date);
    if (parsed.data.to_date !== undefined) updateData.toDate = new Date(parsed.data.to_date);
    if (parsed.data.heading !== undefined) updateData.heading = parsed.data.heading;
    if (parsed.data.sub_heading !== undefined) updateData.subHeading = parsed.data.sub_heading || null;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes || null;

    const [updated] = await getDb().update(expenses).set(updateData).where(eq(expenses.id, id)).returning();

    return ok(toSnakeCase(updated));
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Update expense error:", error);
    return serverError("Failed to update expense");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [expense] = await getDb().select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.ownerId, user.id))).limit(1);

    if (!expense) return notFound("Expense not found");

    await getDb().delete(expenses).where(eq(expenses.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete expense error:", error);
    return serverError("Failed to delete expense");
  }
}
