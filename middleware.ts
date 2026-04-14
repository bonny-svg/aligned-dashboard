import { NextRequest, NextResponse } from "next/server";

const PASSWORD            = process.env.DASHBOARD_PASSWORD;
const TOWNE_EAST_PASSWORD = process.env.TOWNE_EAST_PASSWORD;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Block Towne East on demo (has real data) ───────────────────────────────
  if (pathname === "/towne-east" || pathname.startsWith("/towne-east/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── No password on demo — everything is public ─────────────────────────────
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
