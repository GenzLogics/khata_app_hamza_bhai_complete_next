import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!bearerToken) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const payload = await verifyAccessToken(bearerToken);
    if (!payload) {
      return NextResponse.json({ detail: "Invalid or expired token" }, { status: 401 });
    }

    const [user] = await getDb().select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || !user.isActive) {
      return NextResponse.json({ detail: "User not found or inactive" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      is_active: user.isActive,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return NextResponse.json({ detail: "Failed to get user" }, { status: 500 });
  }
}

