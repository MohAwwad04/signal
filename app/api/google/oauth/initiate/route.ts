import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, schema } from "@/lib/db";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/drive.readonly";
const APP_BASE_URL = process.env.APP_BASE_URL?.trim() ?? "https://signal-umber-ten.vercel.app";

export async function GET(req: NextRequest) {
  const authorId = req.nextUrl.searchParams.get("authorId");
  if (!authorId) return NextResponse.json({ error: "authorId required" }, { status: 400 });
  if (!GOOGLE_CLIENT_ID) return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });

  const state = randomBytes(32).toString("hex");
  await db.insert(schema.oauthStates).values({
    state,
    authorId: Number(authorId),
    provider: "google",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const redirectUri = `${APP_BASE_URL}/api/google/oauth/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: GOOGLE_SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`${GOOGLE_AUTHORIZE_URL}?${params.toString()}`);
}
