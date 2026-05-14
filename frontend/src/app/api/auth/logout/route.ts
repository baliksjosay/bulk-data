import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ok } from "@/lib/api-response";
import { clearAllAuthCookies } from "@/lib/auth-session-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = ok(
    { message: "Logged out successfully" },
    "Logged out successfully",
  );
  clearAllAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  clearAllAuthCookies(response);
  return response;
}
