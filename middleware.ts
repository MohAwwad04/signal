import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/fathom/webhook",
  "/api/fathom/oauth/callback",
  "/api/cron",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  const cookie = req.cookies.get("signal_auth")?.value;
  const expected = process.env.AUTH_SECRET;
  // If AUTH_SECRET isn't set, allow everything (dev mode).
  if (!expected) return NextResponse.next();
  if (cookie && cookie === hashToken(expected)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Edge-runtime safe quick hash (not security-grade, just obfuscation — app is small-team)
function hashToken(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `h_${(h >>> 0).toString(36)}`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
