import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/jwt";
import { z } from "zod";

const signoutSchema = z.object({
  refresh_token: z.string().min(1, "refresh_token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { detail: parsed.error.errors[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    await clearAuthCookies();

    return NextResponse.json({ message: "Signed out successfully" });
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.json({ detail: "Signout failed" }, { status: 500 });
  }
}

