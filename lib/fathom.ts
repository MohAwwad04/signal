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

/** Fetch the transcript for a single recording. */
async function fetchRecordingTranscript(token: string, recordingId: string): Promise<string> {
  const res = await fetch(`${FATHOM_API_BASE}/recordings/${recordingId}/transcript`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return "";
  const d = await res.json();
  // Fathom returns { transcript: [{ speaker: { display_name }, text, timestamp }] }
  if (Array.isArray(d.transcript)) {
    return d.transcript
      .map((t: { speaker?: { display_name?: string }; text?: string }) =>
        `${t.speaker?.display_name ?? "Speaker"}: ${t.text ?? ""}`
      )
      .join("\n");
  }
  return String(d.transcript ?? d.text ?? "");
}

/** Fetch recent meetings from Fathom for an author. */
export async function fetchFathomMeetings(
  token: string,
  limit = 10
): Promise<FathomMeeting[]> {
  const res = await fetch(`${FATHOM_API_BASE}/meetings?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Fathom API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  // Fathom returns { items: [...], next_cursor, limit }
  const items = Array.isArray(data.items) ? data.items : [];
  const meetings = await Promise.all(
    items.map(async (m: Record<string, unknown>) => {
      const recordingId = String(m.recording_id ?? "");
      // List endpoint has transcript: null — fetch per-recording
      let transcript = "";
      if (recordingId) {
        transcript = await fetchRecordingTranscript(token, recordingId);
      }
      return {
        id: recordingId,
        title: String(m.title ?? m.meeting_title ?? "Untitled meeting"),
        date: String(m.created_at ?? m.scheduled_start_time ?? ""),
        transcript,
      };
    })
  );
  return meetings;
}

/** Fetch user info from Fathom (no /user endpoint — infer from first meeting). */
export async function fetchFathomUser(
  token: string
): Promise<{ id: string; email: string }> {
  // Fathom has no user profile endpoint — get info from recorded_by on first meeting
  const res = await fetch(`${FATHOM_API_BASE}/meetings?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { id: "", email: "" };
  const data = await res.json();
  const meeting = data.items?.[0];
  if (!meeting?.recorded_by) return { id: "", email: "" };
  return {
    id: String(meeting.recorded_by.email ?? ""),
    email: String(meeting.recorded_by.email ?? ""),
  };
}

export type FathomMeeting = {
  id: string;
  title: string;
  date: string;
  transcript: string;
};
