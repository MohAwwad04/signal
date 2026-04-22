import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt, isNull } from "drizzle-orm";

function hashToken(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return `h_${(h >>> 0).toString(36)}`;
}

export async function POST(req: NextRequest) {
  const { token, name, bio, styleNotes, contentAngles } = await req.json().catch(() => ({}));

  if (!token || !name?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // Validate token
  const [authToken] = await db
    .select()
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.token, token),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!authToken) {
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 403 });
  }

  const email = authToken.email;
  const angles = (contentAngles as string)
    ?.split(",")
    .map((s: string) => s.trim())
    .filter(Boolean) ?? [];

  // Create author record
  const [author] = await db
    .insert(schema.authors)
    .values({
      name: name.trim(),
      bio: bio?.trim() || null,
      styleNotes: styleNotes?.trim() || null,
      contentAngles: angles,
      email,
      active: true,
    })
    .returning();

  // Link author to user and mark token used
  await Promise.all([
    db
      .update(schema.users)
      .set({ authorId: author.id })
      .where(eq(schema.users.email, email)),
    db
      .update(schema.authTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.authTokens.id, authToken.id)),
  ]);

  // Log them in
  const expected = process.env.AUTH_SECRET ?? "";
  const res = NextResponse.json({ ok: true });
  const cookieOpts = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
  res.cookies.set("signal_auth", hashToken(expected), { ...cookieOpts, httpOnly: true });
  res.cookies.set("signal_email", email, cookieOpts);
  return res;
}
