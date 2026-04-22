import { NextResponse } from "next/server";

function clearCookies(res: NextResponse) {
  const opts = { path: "/", maxAge: 0 };
  res.cookies.set("signal_auth", "", opts);
  res.cookies.set("signal_email", "", opts);
}

export async function GET() {
  const res = NextResponse.redirect(new URL("/login", process.env.FRONTEND_URL ?? "http://localhost:3000"));
  clearCookies(res);
  return res;
}

export async function POST() {
  const res = NextResponse.redirect(new URL("/login", process.env.FRONTEND_URL ?? "http://localhost:3000"));
  clearCookies(res);
  return res;
}
