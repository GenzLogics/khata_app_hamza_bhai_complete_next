import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stockItems, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, notFound, unauthorized, serverError } from "@/lib/api-response";
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [stockItem] = await getDb().select().from(stockItems).where(and(eq(stockItems.id, id), eq(stockItems.ownerId, user.id))).limit(1);

    if (!stockItem) return notFound("Stock item not found");

    await getDb().delete(stockItems).where(eq(stockItems.id, id));

    return ok({ message: "Stock deleted" });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete stock error:", error);
    return serverError("Failed to delete stock");
  }
}
