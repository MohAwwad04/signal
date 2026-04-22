import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import { fetchLinkedinProfile, fetchLinkedinVanityName } from "@/lib/linkedin";

const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID ?? "";
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET ?? "";
const APP_BASE_URL = process.env.APP_BASE_URL?.trim() ?? "https://signal-umber-ten.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  let authorId: number | null = null;
  if (state) {
    const [row] = await db
      .select()
      .from(schema.oauthStates)
      .where(
        and(
          eq(schema.oauthStates.state, state),
          eq(schema.oauthStates.provider, "linkedin"),
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
      `${APP_BASE_URL}${redirect}?linkedin=error&reason=${encodeURIComponent(reason)}`
    );
  }

  const redirectUri = `${APP_BASE_URL}/api/linkedin/oauth/callback`;
  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${APP_BASE_URL}/authors/${authorId}?linkedin=error&reason=token_exchange_failed`
    );
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  const profile = await fetchLinkedinProfile(tokens.access_token).catch((e) => {
    console.error("[linkedin-callback] fetchLinkedinProfile failed:", e);
    return { id: "", name: "" };
  });
  const vanityName = await fetchLinkedinVanityName(tokens.access_token, profile.id).catch(() => null);

  const linkedinUrl = vanityName ? `https://www.linkedin.com/in/${vanityName}` : undefined;

  try {
    await db
      .update(schema.authors)
      .set({
        linkedinAccessToken: tokens.access_token,
        linkedinRefreshToken: tokens.refresh_token ?? null,
        linkedinTokenExpiresAt: expiresAt,
        linkedinMemberId: profile.id,
        linkedinMemberName: profile.name,
        linkedinConnectedAt: new Date(),
        ...(linkedinUrl ? { linkedinUrl } : {}),
      })
      .where(eq(schema.authors.id, authorId));
  } catch (e) {
    console.error("[linkedin-callback] db update failed:", e);
    return NextResponse.redirect(
      `${APP_BASE_URL}/authors/${authorId}?linkedin=error&reason=db_save_failed`
    );
  }

  return NextResponse.redirect(`${APP_BASE_URL}/authors/${authorId}?linkedin=connected`);
}
