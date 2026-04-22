import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_API_BASE = "https://api.linkedin.com";
// LinkedIn REST API version header required for v202302+ endpoints
const LINKEDIN_VERSION = "202302";

/** Refresh if needed and return a valid LinkedIn access token for the given author. */
export async function getValidLinkedinToken(authorId: number): Promise<string> {
  const [author] = await db
    .select()
    .from(schema.authors)
    .where(eq(schema.authors.id, authorId));
  if (!author?.linkedinAccessToken) throw new Error("No LinkedIn token for author");

  const expiresAt = author.linkedinTokenExpiresAt?.getTime() ?? 0;
  const fiveMin = 5 * 60 * 1000;

  if (Date.now() < expiresAt - fiveMin) {
    return author.linkedinAccessToken;
  }

  if (!author.linkedinRefreshToken) {
    throw new Error("LinkedIn token expired and no refresh token available");
  }

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: author.linkedinRefreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      await db
        .update(schema.authors)
        .set({
          linkedinAccessToken: null,
          linkedinRefreshToken: null,
          linkedinTokenExpiresAt: null,
          linkedinMemberId: null,
          linkedinMemberName: null,
          linkedinConnectedAt: null,
          linkedinLastSyncedAt: null,
        })
        .where(eq(schema.authors.id, authorId));
      throw new Error("LinkedIn token refresh failed — author must reconnect");
    }
    throw new Error(`LinkedIn token refresh failed with status ${res.status}`);
  }

  const tokens = await res.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  await db
    .update(schema.authors)
    .set({
      linkedinAccessToken: tokens.access_token,
      linkedinRefreshToken: tokens.refresh_token ?? author.linkedinRefreshToken,
      linkedinTokenExpiresAt: newExpiry,
    })
    .where(eq(schema.authors.id, authorId));

  return tokens.access_token;
}

/** Fetch the LinkedIn member profile (sub = member ID, name). Uses OIDC userinfo. */
export async function fetchLinkedinProfile(accessToken: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${LINKEDIN_API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`LinkedIn userinfo failed: ${res.status}`);
  const data = await res.json();
  return { id: data.sub ?? "", name: data.name ?? "" };
}

/**
 * Fetch the author's most recent LinkedIn posts (up to 20).
 * Requires w_member_social or r_member_social scope.
 * Returns null if the endpoint isn't accessible (insufficient permissions).
 */
export async function fetchLinkedinAuthoredPosts(
  accessToken: string,
  memberId: string
): Promise<string[] | null> {
  const authorUrn = encodeURIComponent(`urn:li:person:${memberId}`);
  const res = await fetch(
    `${LINKEDIN_API_BASE}/rest/posts?author=${authorUrn}&count=20&sortBy=LAST_MODIFIED`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  if (!res.ok) {
    console.warn(`[linkedin] fetchAuthoredPosts → ${res.status}`);
    return null;
  }

  const data = await res.json();
  const elements: any[] = data.elements ?? [];
  return elements
    .filter((el) => el.lifecycleState === "PUBLISHED" && el.commentary)
    .map((el) => el.commentary as string);
}

/**
 * Extract a LinkedIn post URN from a post URL.
 *
 * Supported URL formats:
 *   https://www.linkedin.com/posts/username_...-activity-7234567890123-AbCd/
 *   https://www.linkedin.com/feed/update/urn:li:activity:7234567890123/
 *   https://www.linkedin.com/feed/update/urn:li:ugcPost:7234567890123/
 */
export function extractLinkedinPostUrn(url: string): string | null {
  // /feed/update/urn:li:...
  const feedMatch = url.match(/\/feed\/update\/(urn:li:[^/?#]+)/);
  if (feedMatch) return decodeURIComponent(feedMatch[1]);

  // /posts/username_...-activity-{numericId}-{hash}/
  const activityMatch = url.match(/activity-(\d{15,})-/);
  if (activityMatch) return `urn:li:activity:${activityMatch[1]}`;

  return null;
}

/**
 * Fetch social metrics for a LinkedIn post URN.
 * Requires r_member_social scope (Community Management API approval).
 * Returns null if the endpoint returns an error (e.g. insufficient permissions).
 */
export async function fetchLinkedinPostMetrics(
  accessToken: string,
  postUrn: string
): Promise<{ likes: number; comments: number; shares: number; impressions: number } | null> {
  const encodedUrn = encodeURIComponent(postUrn);
  const res = await fetch(
    `${LINKEDIN_API_BASE}/rest/socialMetadata/${encodedUrn}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );

  if (!res.ok) {
    console.warn(`[linkedin] socialMetadata ${postUrn} → ${res.status}`);
    return null;
  }

  const data = await res.json();
  return {
    likes: data.numLikes ?? 0,
    comments: data.numComments ?? 0,
    shares: data.numReposts ?? 0,
    impressions: data.numImpressions ?? 0,
  };
}
