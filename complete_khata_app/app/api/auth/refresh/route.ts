import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, createAccessToken, setAccessTokenCookie } from "@/lib/auth/jwt";
import { z } from "zod";

const refreshSchema = z.object({
  refresh_token: z.string().min(1, "refresh_token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const payload = await verifyRefreshToken(parsed.data.refresh_token);
    if (!payload) {
      return NextResponse.json({ detail: "Invalid or expired refresh token" }, { status: 401 });
    }

    const newAccessToken = await createAccessToken({ sub: payload.sub, email: payload.email });
    setAccessTokenCookie(newAccessToken);

    return NextResponse.json({
      access_token: newAccessToken,
      token_type: "bearer",
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json({ detail: "Token refresh failed" }, { status: 500 });
  }
}

