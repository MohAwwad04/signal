import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import { fetchFathomUser } from "@/lib/fathom";

const FATHOM_TOKEN_URL =
  process.env.FATHOM_TOKEN_URL ?? "https://fathom.video/external/v1/oauth2/token";
const FATHOM_CLIENT_ID = process.env.FATHOM_CLIENT_ID ?? "";
const FATHOM_CLIENT_SECRET = process.env.FATHOM_CLIENT_SECRET ?? "";
const APP_BASE_URL = process.env.APP_BASE_URL?.trim() ?? "https://signal-umber-ten.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Look up state to get authorId (even on error, for redirect)
  let authorId: number | null = null;
  if (state) {
    const [row] = await db
      .select()
      .from(schema.oauthStates)
      .where(
        and(
          eq(schema.oauthStates.state, state),
          eq(schema.oauthStates.provider, "fathom"),
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
    return NextResponse.redirect(
      `${APP_BASE_URL}${redirect}?fathom=error&reason=${encodeURIComponent(reason)}`
    );
  }

  // Exchange code for tokens
  const redirectUri = `${APP_BASE_URL}/api/fathom/oauth/callback`;
  const tokenRes = await fetch(FATHOM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: FATHOM_CLIENT_ID,
      client_secret: FATHOM_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${APP_BASE_URL}/authors/${authorId}?fathom=error&reason=token_exchange_failed`
    );
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  const user = await fetchFathomUser(tokens.access_token).catch(() => ({ id: "", email: "" }));

  try {
    await db
      .update(schema.authors)
      .set({
        fathomAccessToken: tokens.access_token,
        fathomRefreshToken: tokens.refresh_token ?? null,
        fathomTokenExpiresAt: expiresAt,
        fathomUserId: user.id,
        fathomUserEmail: user.email,
        fathomConnectedAt: new Date(),
      })
      .where(eq(schema.authors.id, authorId))
      .returning({ id: schema.authors.id });
  } catch (e) {
    console.error("[fathom-callback] db update FAILED:", e);
    return NextResponse.redirect(
      `${APP_BASE_URL}/authors/${authorId}?fathom=error&reason=db_save_failed`
    );
  }

  return NextResponse.redirect(
    `${APP_BASE_URL}/authors/${authorId}?fathom=connected`
  );
}
