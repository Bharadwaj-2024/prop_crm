import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || pathname === "/login") {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/refresh") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/webhooks/exotel") ||
    pathname.startsWith("/api/webhooks/whatsapp")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get("session_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    try {
      await verifyAccessToken(token);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL("/", req.url));
      response.cookies.delete("session_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};