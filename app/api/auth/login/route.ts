import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

function hashToken(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `h_${(h >>> 0).toString(36)}`;
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  const expected = process.env.AUTH_SECRET;

  if (!expected) {
    return NextResponse.json({ error: "AUTH_SECRET not set on the server." }, { status: 500 });
  }

  const normalizedEmail = String(email ?? "").toLowerCase().trim();

  // Bootstrap allowlist from env var (original admins always work)
  const envAllowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const isEnvAdmin = envAllowed.includes(normalizedEmail);

  if (!isEnvAdmin) {
    // Check DB users table
    const [dbUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1)
      .catch(() => []);

    if (!dbUser) {
      return NextResponse.json({ error: "This email is not on the allowlist." }, { status: 403 });
    }
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const cookieOpts = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
  res.cookies.set("signal_auth", hashToken(expected), { ...cookieOpts, httpOnly: true });
  res.cookies.set("signal_email", normalizedEmail, cookieOpts);
  return res;
}
