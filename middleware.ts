import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/home",
  "/login",
  "/invite",
  "/api/auth/login",
  "/api/invite",
  "/api/fathom/webhook",
  "/api/fathom/oauth/callback",
  "/api/linkedin/oauth/callback",
  "/api/google/oauth/callback",
  "/api/cron",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p)))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const cookie = req.cookies.get("signal_auth")?.value;
  if (cookie) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
