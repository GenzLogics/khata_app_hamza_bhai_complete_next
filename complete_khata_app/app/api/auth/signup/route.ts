import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createAccessToken, createRefreshToken, setAccessTokenCookie, setRefreshTokenCookie } from "@/lib/auth/jwt";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character"),
  fullName: z.string().min(2).max(255),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { email, password, fullName } = parsed.data;

    if (Buffer.byteLength(password, "utf8") > 72) {
      return NextResponse.json(
        { detail: "Password cannot be longer than 72 bytes" },
        { status: 400 }
      );
    }

    const [existing] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ detail: "Email already registered" }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);
    const [user] = await getDb()
      .insert(users)
      .values({ email, hashedPassword, fullName })
      .returning();

    const accessToken = await createAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await createRefreshToken({ sub: user.id, email: user.email });

    setAccessTokenCookie(accessToken);
    setRefreshTokenCookie(refreshToken);

    return NextResponse.json(
      {
        message: "User created successfully",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ detail: "Signup failed" }, { status: 500 });
  }
}

