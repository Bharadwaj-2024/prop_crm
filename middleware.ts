import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/webhooks",
  "/api/whatsapp",
  "/api/whatsapp/send",
  "/login",
  "/_next",
  "/favicon.ico",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const token = req.headers.get("authorization");
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    try {
      await verifyAccessToken(token.replace(/^Bearer\s+/i, ""));
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }
  }

  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("session_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      await verifyAccessToken(token);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL("/login", req.url));
      response.cookies.delete("session_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/((?!auth|webhooks).)*"],
};