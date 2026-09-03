import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { vendorItems, vendors, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api-response";

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
    const [vendor] = await getDb().select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.ownerId, user.id))).limit(1);
    if (!vendor) return notFound("Vendor not found");

    const items = await getDb().select({ itemName: vendorItems.itemName }).from(vendorItems).where(eq(vendorItems.vendorId, id)).orderBy(vendorItems.itemName);

    return ok({
      items: items.map((i) => i.itemName),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get vendor items error:", error);
    return serverError("Failed to fetch vendor items");
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const itemName = typeof body.itemName === "string" ? body.itemName : "";
    const { id } = await params;

    if (!itemName.trim()) {
      return badRequest("itemName is required");
    }

    const [vendor] = await getDb().select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.ownerId, user.id))).limit(1);
    if (!vendor) return notFound("Vendor not found");

    const normalized = itemName.replace(/\s+/g, " ").trim();

    await getDb().insert(vendorItems).values({ vendorId: id, itemName: normalized });

    const items = await getDb().select({ itemName: vendorItems.itemName }).from(vendorItems).where(eq(vendorItems.vendorId, id)).orderBy(vendorItems.itemName);

    return ok({
      items: items.map((i) => i.itemName),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Add vendor item error:", error);
    return serverError("Failed to add vendor item");
  }
}
