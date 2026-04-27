import { NextRequest, NextResponse } from "next/server";

const PASSWORD            = process.env.DASHBOARD_PASSWORD;
const TOWNE_EAST_PASSWORD = process.env.TOWNE_EAST_PASSWORD;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Towne East routes (/towne-east and /towne-east/*) ──────────────────────
  if (pathname === "/towne-east" || pathname.startsWith("/towne-east/")) {
    if (pathname === "/towne-east/login") return NextResponse.next();
    if (pathname === "/api/towne-east-auth") return NextResponse.next();

    if (!TOWNE_EAST_PASSWORD) return NextResponse.next();

    const token = request.cookies.get("towne_east_auth")?.value;
    if (token === TOWNE_EAST_PASSWORD) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/towne-east/login";
    return NextResponse.redirect(url);
  }

  // ── The Grove — publicly accessible (partner-facing, no auth required) ──────
  if (pathname === "/the-grove" || pathname.startsWith("/the-grove/")) return NextResponse.next();
  if (pathname.startsWith("/api/grove/")) return NextResponse.next();

  // ── Towne East API — must be reachable by the email-agent uploader ───────
  if (pathname.startsWith("/api/towne-east/")) return NextResponse.next();

  // ── Main dashboard routes ───────────────────────────────────────────────────
  if (!PASSWORD) return NextResponse.next();
  if (pathname === "/login") return NextResponse.next();
  if (pathname === "/api/auth") return NextResponse.next();

  const token = request.cookies.get("auth")?.value;
  if (token === PASSWORD) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
