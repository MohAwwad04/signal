import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

async function handleLogout(req: NextRequest) {
  const sessionToken = req.cookies.get("signal_auth")?.value;
  if (sessionToken) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, sessionToken)).catch(() => {});
  }
  const res = NextResponse.redirect(new URL("/home", req.url));
  const opts = { path: "/", maxAge: 0 };
  res.cookies.set("signal_auth", "", opts);
  res.cookies.set("signal_email", "", opts);
  return res;
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
