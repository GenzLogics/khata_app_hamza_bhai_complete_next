import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyAccessToken, getAccessTokenFromCookies } from "@/lib/auth/jwt";

export type AuthenticatedUser = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
};

export async function getCurrentUser(request: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = await getAccessTokenFromCookies();
  const token = bearerToken || cookieToken;

  if (!token) {
    throw new Error("Not authenticated");
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    throw new Error("Invalid or expired token");
  }

  const [user] = await getDb().select().from(users).where(eq(users.id, payload.sub)).limit(1);
  if (!user || !user.isActive) {
    throw new Error("User not found or inactive");
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isActive: user.isActive,
  };
}
