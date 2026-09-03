import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { expenses, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

const patchSchema = z.object({
  new_heading: z.string().min(1).max(100),
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ oldHeading: string }> }) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    const { oldHeading } = await params;

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message || "Validation failed");
    }

    const { new_heading } = parsed.data;

    const result = await getDb().update(expenses).set({ heading: new_heading }).where(and(eq(expenses.heading, decodeURIComponent(oldHeading)), eq(expenses.ownerId, user.id))).returning({ count: sql<number>`count(*)` });

    const updated = Number(result[0]?.count || 0);

    return ok({
      updated,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Patch expense heading error:", error);
    return serverError("Failed to update expense heading");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ oldHeading: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { oldHeading } = await params;
    const result = await getDb().delete(expenses).where(and(eq(expenses.heading, decodeURIComponent(oldHeading)), eq(expenses.ownerId, user.id))).returning({ count: sql<number>`count(*)` });

    const updated = Number(result[0]?.count || 0);

    return ok({
      updated,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete expense heading error:", error);
    return serverError("Failed to delete expenses by heading");
  }
}
