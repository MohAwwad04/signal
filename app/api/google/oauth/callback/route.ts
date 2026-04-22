import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import { fetchGoogleUserEmail } from "@/lib/google";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const APP_BASE_URL = process.env.APP_BASE_URL?.trim() ?? "https://signal-umber-ten.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  let authorId: number | null = null;
  if (state) {
    const [row] = await db.select().from(schema.oauthStates).where(
      and(
        eq(schema.oauthStates.state, state),
        eq(schema.oauthStates.provider, "google"),
        gt(schema.oauthStates.expiresAt, new Date())
      )
    );
    if (row) {
      authorId = row.authorId;
      await db.delete(schema.oauthStates).where(eq(schema.oauthStates.id, row.id));
    }
  }

  if (error || !code || !authorId) {
    const reason = error ?? (!state ? "missing_state" : !authorId ? "invalid_or_expired_state" : "missing_code");
    const redirect = authorId ? `/authors/${authorId}` : "/authors";
    return NextResponse.redirect(`${APP_BASE_URL}${redirect}?google=error&reason=${encodeURIComponent(reason)}`);
  }

  const redirectUri = `${APP_BASE_URL}/api/google/oauth/callback`;
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${APP_BASE_URL}/authors/${authorId}?google=error&reason=token_exchange_failed`);
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
  const email = await fetchGoogleUserEmail(tokens.access_token).catch(() => "");

  try {
    await db.update(schema.authors).set({
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token ?? null,
      googleTokenExpiresAt: expiresAt,
      googleUserEmail: email || null,
      googleConnectedAt: new Date(),
    }).where(eq(schema.authors.id, authorId));
  } catch {
    return NextResponse.redirect(`${APP_BASE_URL}/authors/${authorId}?google=error&reason=db_save_failed`);
  }

  return NextResponse.redirect(`${APP_BASE_URL}/authors/${authorId}?google=connected`);
}
