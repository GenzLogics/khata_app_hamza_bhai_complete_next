import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { vendors, purchaseInvoices, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { ok, badRequest, unauthorized, notFound, conflict, serverError } from "@/lib/api-response";

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

    const [debitResult] = await getDb().select({ total: sql<number>`coalesce(sum(${purchaseInvoices.balanceDue}), 0)` }).from(purchaseInvoices).where(eq(purchaseInvoices.vendorId, id));
    const debit_amount = Number(debitResult?.total || 0);

    return ok({
      message: "Vendor fetched",
      vendor: { ...vendor, debit_amount },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get vendor error:", error);
    return serverError("Failed to fetch vendor");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [existing] = await getDb().select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.ownerId, user.id))).limit(1);
    if (!existing) return notFound("Vendor not found");

    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) {
      if (body.phone === "" || body.phone === null) {
        updateData.phone = null;
      } else {
        const [phoneExisting] = await getDb().select().from(vendors).where(and(eq(vendors.ownerId, user.id), eq(vendors.phone, body.phone), sql`${vendors.id} != ${id}`)).limit(1);
        if (phoneExisting) return conflict("Phone number already exists");
        updateData.phone = body.phone;
      }
    }

    const [updated] = await getDb().update(vendors).set(updateData).where(eq(vendors.id, id)).returning();

    const [debitResult] = await getDb().select({ total: sql<number>`coalesce(sum(${purchaseInvoices.balanceDue}), 0)` }).from(purchaseInvoices).where(eq(purchaseInvoices.vendorId, id));
    const debit_amount = Number(debitResult?.total || 0);

    return ok({
      message: "Vendor updated",
      vendor: { ...updated, debit_amount },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Update vendor error:", error);
    return serverError("Failed to update vendor");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [vendor] = await getDb().select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.ownerId, user.id))).limit(1);

    if (!vendor) return notFound("Vendor not found");

    if (Number(vendor.currentBalance) > 0) {
      return conflict("Vendor has pending balance");
    }

    await getDb().delete(purchaseInvoices).where(eq(purchaseInvoices.vendorId, id));
    await getDb().delete(vendors).where(eq(vendors.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete vendor error:", error);
    return serverError("Failed to delete vendor");
  }
}
