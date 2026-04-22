import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getValidGoogleToken(authorId: number): Promise<string> {
  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, authorId));
  if (!author?.googleAccessToken) throw new Error("No Google token for author");

  const expiresAt = author.googleTokenExpiresAt?.getTime() ?? 0;
  const fiveMin = 5 * 60 * 1000;

  if (Date.now() < expiresAt - fiveMin) return author.googleAccessToken;

  if (!author.googleRefreshToken) {
    throw new Error("Google token expired and no refresh token — author must reconnect");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: author.googleRefreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 400) {
      await db.update(schema.authors).set({
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
        googleUserEmail: null,
        googleConnectedAt: null,
        googleLastSyncedAt: null,
      }).where(eq(schema.authors.id, authorId));
      throw new Error("Google token refresh failed — author must reconnect");
    }
    throw new Error(`Google token refresh failed with status ${res.status}`);
  }

  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  await db.update(schema.authors).set({
    googleAccessToken: tokens.access_token,
    googleRefreshToken: tokens.refresh_token ?? author.googleRefreshToken,
    googleTokenExpiresAt: newExpiry,
  }).where(eq(schema.authors.id, authorId));

  return tokens.access_token;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  const d = await res.json();
  return d.email ?? "";
}

export type GoogleMeetTranscript = {
  id: string;
  title: string;
  date: string;
  transcript: string;
};

/** Search Drive for Gemini Meet transcript docs and return their text content. */
export async function fetchGoogleMeetTranscripts(
  accessToken: string,
  limit = 10
): Promise<GoogleMeetTranscript[]> {
  // Google Meet + Gemini saves transcripts as Docs named "[Meeting] - Transcript"
  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.document' and name contains 'Transcript' and trashed = false`
  );
  const fields = encodeURIComponent("files(id,name,createdTime)");
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=createdTime+desc&pageSize=${limit}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`Google Drive list failed: ${listRes.status}`);
  const listData = await listRes.json();
  const files: { id: string; name: string; createdTime: string }[] = listData.files ?? [];

  const results = await Promise.all(
    files.map(async (file) => {
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const transcript = exportRes.ok ? await exportRes.text() : "";
      return {
        id: file.id,
        title: file.name,
        date: file.createdTime,
        transcript,
      };
    })
  );

  return results.filter((r) => r.transcript.length >= 100);
}
