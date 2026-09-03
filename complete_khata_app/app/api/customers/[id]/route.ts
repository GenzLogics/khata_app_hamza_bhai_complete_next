import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customers, salesInvoices, users } from "@/lib/db/schema";
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
    const [customer] = await getDb().select().from(customers).where(and(eq(customers.id, id), eq(customers.ownerId, user.id))).limit(1);

    if (!customer) return notFound("Customer not found");

    return ok({
      message: "Customer fetched",
      customer,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Get customer error:", error);
    return serverError("Failed to fetch customer");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const body = await request.json();
    const { id } = await params;

    const [existing] = await getDb().select().from(customers).where(and(eq(customers.id, id), eq(customers.ownerId, user.id))).limit(1);
    if (!existing) return notFound("Customer not found");

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) {
      if (body.phone === "" || body.phone === null) {
        updateData.phone = null;
      } else {
        const [phoneExisting] = await getDb().select().from(customers).where(and(eq(customers.ownerId, user.id), eq(customers.phone, body.phone), sql`${customers.id} != ${id}`)).limit(1);
        if (phoneExisting) return conflict("Phone number already exists");
        updateData.phone = body.phone;
      }
    }

    const [updated] = await getDb().update(customers).set(updateData).where(eq(customers.id, id)).returning();

    return ok({
      message: "Customer updated",
      customer: updated,
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Update customer error:", error);
    return serverError("Failed to update customer");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;
    const [customer] = await getDb().select().from(customers).where(and(eq(customers.id, id), eq(customers.ownerId, user.id))).limit(1);

    if (!customer) return notFound("Customer not found");

    const [creditResult] = await getDb().select({ total: sql<number>`coalesce(sum(${salesInvoices.balanceDue}), 0)` }).from(salesInvoices).where(eq(salesInvoices.customerId, id));
    const creditAmount = Number(creditResult?.total || 0);

    if (creditAmount > 0) {
      return conflict("Customer has pending credit");
    }

    await getDb().delete(salesInvoices).where(eq(salesInvoices.customerId, id));
    await getDb().delete(customers).where(eq(customers.id, id));

    return ok({ message: "Customer deleted" });
  } catch (error) {
    if (error instanceof Error && (error.message === "No token" || error.message === "Invalid token" || error.message === "User not found")) {
      return unauthorized();
    }
    console.error("Delete customer error:", error);
    return serverError("Failed to delete customer");
  }
}
