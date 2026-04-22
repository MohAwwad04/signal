import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/login", process.env.FRONTEND_URL ?? "http://localhost:3000")
  );
  res.cookies.delete("signal_auth");
  res.cookies.delete("signal_email");
  return res;
}

export async function POST() {
  const res = NextResponse.redirect(
    new URL("/login", process.env.FRONTEND_URL ?? "http://localhost:3000")
  );
  res.cookies.delete("signal_auth");
  res.cookies.delete("signal_email");
  return res;
}
