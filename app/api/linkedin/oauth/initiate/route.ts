import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, schema } from "@/lib/db";

const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID ?? "";
// openid + profile + email → OIDC (no review needed)
// r_member_social → read post stats (requires Community Management API approval)
const LINKEDIN_SCOPES = "openid profile email r_member_social";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://signal-umber-ten.vercel.app";

export async function GET(req: NextRequest) {
  const authorId = req.nextUrl.searchParams.get("authorId");
  if (!authorId) {
    return NextResponse.json({ error: "authorId required" }, { status: 400 });
  }

  if (!LINKEDIN_CLIENT_ID) {
    return NextResponse.json({ error: "LINKEDIN_CLIENT_ID not configured" }, { status: 500 });
  }

  const state = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db.insert(schema.oauthStates).values({
    state,
    authorId: Number(authorId),
    provider: "linkedin",
    expiresAt,
  });

  const redirectUri = `${APP_BASE_URL}/api/linkedin/oauth/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: LINKEDIN_SCOPES,
    state,
  });

  return NextResponse.redirect(`${LINKEDIN_AUTHORIZE_URL}?${params.toString()}`);
}
