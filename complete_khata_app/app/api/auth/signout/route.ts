import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    await clearAuthCookies();

    return NextResponse.json({ message: "Signed out successfully" });
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.json({ detail: "Signout failed" }, { status: 500 });
  }
}

