import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, extractBearerToken } from "@/lib/auth/jwt";

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/webhooks",
  "/login",
  "/_next",
  "/favicon.ico",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For API routes: check Authorization header
  if (pathname.startsWith("/api/")) {
    const token = extractBearerToken(req.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }
    try {
      await verifyAccessToken(token);
      return NextResponse.next();
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }
  }

  // For page routes: check session cookie
  const sessionToken = req.cookies.get("session_token")?.value;
  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await verifyAccessToken(sessionToken);
    return NextResponse.next();
  } catch {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/((?!auth|webhooks).)*"],
};