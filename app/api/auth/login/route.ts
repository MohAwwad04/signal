import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { hashToken, SUPERADMIN_EMAIL } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const envAdmins = (process.env.ALLOWED_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  const isEnvAdmin = normalizedEmail === SUPERADMIN_EMAIL || envAdmins.includes(normalizedEmail);

  if (isEnvAdmin) {
    // Env admins use the shared AUTH_SECRET
    const expected = process.env.AUTH_SECRET;
    if (!expected) return NextResponse.json({ error: "AUTH_SECRET not set." }, { status: 500 });
    if (password !== expected) return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  } else {
    // DB users use their own password
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, normalizedEmail)).limit(1).catch(() => []);
    if (!user) return NextResponse.json({ error: "This email is not on the allowlist." }, { status: 403 });
    if (!user.active) return NextResponse.json({ error: "Account not activated yet — check your invite email." }, { status: 403 });
    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Wrong password." }, { status: 401 });
    }
  }

  const secret = process.env.AUTH_SECRET ?? "";
  const res = NextResponse.json({ ok: true });
  const cookieOpts = { sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };
  res.cookies.set("signal_auth", hashToken(secret), { ...cookieOpts, httpOnly: true });
  res.cookies.set("signal_email", normalizedEmail, { ...cookieOpts, httpOnly: true });
  return res;
}
