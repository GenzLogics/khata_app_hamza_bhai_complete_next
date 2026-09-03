import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth/password";
import { createAccessToken, createRefreshToken, setAccessTokenCookie, setRefreshTokenCookie } from "@/lib/auth/jwt";
import { z } from "zod";

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !(await verifyPassword(password, user.hashedPassword))) {
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ detail: "User account is inactive" }, { status: 403 });
    }

    const accessToken = await createAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await createRefreshToken({ sub: user.id, email: user.email });

    setAccessTokenCookie(accessToken);
    setRefreshTokenCookie(refreshToken);

    return NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    return NextResponse.json({ detail: "Login failed" }, { status: 500 });
  }
}

