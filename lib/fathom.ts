import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const FATHOM_TOKEN_URL =
  process.env.FATHOM_TOKEN_URL ?? "https://fathom.video/external/v1/oauth2/token";
const FATHOM_API_BASE =
  process.env.FATHOM_API_BASE_URL ?? "https://fathom.video/external/v1";

/** Refresh + return a valid access token for the given author. */
export async function getValidFathomToken(authorId: number): Promise<string> {
  const [author] = await db
    .select()
    .from(schema.authors)
    .where(eq(schema.authors.id, authorId));
  if (!author?.fathomAccessToken) throw new Error("No Fathom token for author");

  const expiresAt = author.fathomTokenExpiresAt?.getTime() ?? 0;
  const fiveMin = 5 * 60 * 1000;

  if (Date.now() < expiresAt - fiveMin) {
    return author.fathomAccessToken;
  }

  // Token expired or about to — refresh
  if (!author.fathomRefreshToken) {
    throw new Error("Fathom token expired and no refresh token available");
  }

  const res = await fetch(FATHOM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: author.fathomRefreshToken,
      client_id: process.env.FATHOM_CLIENT_ID ?? "",
      client_secret: process.env.FATHOM_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Auth rejected — clear tokens so user is prompted to reconnect
      await db
        .update(schema.authors)
        .set({
          fathomAccessToken: null,
          fathomRefreshToken: null,
          fathomTokenExpiresAt: null,
          fathomUserId: null,
          fathomUserEmail: null,
          fathomConnectedAt: null,
          fathomLastSyncedAt: null,
        })
        .where(eq(schema.authors.id, authorId));
      throw new Error("Fathom token refresh failed — author must reconnect");
    }
    // Transient error (5xx, etc.) — keep tokens, let caller retry later
    throw new Error(`Fathom token refresh failed with status ${res.status}`);
  }

  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  await db
    .update(schema.authors)
    .set({
      fathomAccessToken: tokens.access_token,
      fathomRefreshToken: tokens.refresh_token ?? author.fathomRefreshToken,
      fathomTokenExpiresAt: newExpiry,
    })
    .where(eq(schema.authors.id, authorId));

  return tokens.access_token;
}

/** Fetch the transcript for a single call (list endpoint rarely includes it). */
async function fetchCallTranscript(token: string, callId: string): Promise<string> {
  // Try /calls/{id}/transcript first, then fall back to /calls/{id}
  for (const path of [`/calls/${callId}/transcript`, `/calls/${callId}`]) {
    const res = await fetch(`${FATHOM_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;
    const d = await res.json();
    const text = String(d.transcript ?? d.transcript_text ?? d.text ?? d.content ?? "");
    if (text.length >= 100) return text;
  }
  return "";
}

/** Fetch recent meetings from Fathom for an author. */
export async function fetchFathomMeetings(
  token: string,
  limit = 10
): Promise<FathomMeeting[]> {
  const res = await fetch(`${FATHOM_API_BASE}/calls?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Fathom API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // Fathom may return { calls: [...] } or an array directly
  const calls = Array.isArray(data) ? data : data.calls ?? data.data ?? [];
  const meetings = await Promise.all(
    calls.map(async (c: Record<string, unknown>) => {
      const id = String(c.id ?? c.call_id ?? "");
      // Transcript is rarely included in list responses — fetch per-call if missing
      let transcript = String(c.transcript ?? c.transcript_text ?? "");
      if (transcript.length < 100 && id) {
        transcript = await fetchCallTranscript(token, id);
      }
      return {
        id,
        title: String(c.title ?? c.meeting_title ?? "Untitled meeting"),
        date: String(c.started_at ?? c.date ?? c.created_at ?? ""),
        transcript,
      };
    })
  );
  return meetings;
}

/** Fetch a user profile from Fathom. */
export async function fetchFathomUser(
  token: string
): Promise<{ id: string; email: string }> {
  const res = await fetch(`${FATHOM_API_BASE}/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    // Some APIs use /me instead of /user
    const res2 = await fetch(`${FATHOM_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res2.ok) {
      return { id: "unknown", email: "unknown" };
    }
    const d = await res2.json();
    return { id: String(d.id ?? ""), email: String(d.email ?? "") };
  }
  const d = await res.json();
  return { id: String(d.id ?? ""), email: String(d.email ?? "") };
}

export type FathomMeeting = {
  id: string;
  title: string;
  date: string;
  transcript: string;
};
