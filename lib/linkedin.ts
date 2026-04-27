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

function extractVanityFromUrl(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? m[1] : null;
}

export async function jinaGet(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-No-Cache": "true" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

function extractLinkedinVanity(text: string): string | null {
  const m = text.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Resolve the LinkedIn vanity name for a member using three strategies:
 * 1. Guess from name slug and verify the profile page loads (no auth wall)
 * 2. Bing search via Jina Reader
 * 3. Google search via Jina Reader
 */
async function resolveVanityViaSearch(memberName: string): Promise<string | null> {
  // Strategy 1: try the slugified name directly against linkedin.com/in/
  const slug = memberName
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug) {
    const text = await jinaGet(`https://www.linkedin.com/in/${slug}`);
    if (text && !text.includes("Sign in to LinkedIn") && !text.includes("authwall")) {
      const firstName = memberName.split(/\s+/)[0].toLowerCase();
      if (text.toLowerCase().includes(firstName)) return slug;
    }
  }

  // Strategy 2: Bing search
  const query = encodeURIComponent(`site:linkedin.com/in "${memberName}"`);
  const bing = await jinaGet(`https://www.bing.com/search?q=${query}`);
  if (bing) { const v = extractLinkedinVanity(bing); if (v) return v; }

  // Strategy 3: Google search
  const google = await jinaGet(`https://www.google.com/search?q=${query}`);
  if (google) { const v = extractLinkedinVanity(google); if (v) return v; }

  return null;
}

/**
 * Resolve the LinkedIn profile vanity name.
 * With only OIDC scopes (openid profile email), the LinkedIn API does not return the vanity name,
 * so we fall back to a DuckDuckGo search via Jina Reader using the member's display name.
 */
export async function fetchLinkedinVanityName(
  _accessToken: string,
  _memberId?: string | null,
  memberName?: string | null
): Promise<string | null> {
  if (memberName) {
    return resolveVanityViaSearch(memberName);
  }
  return null;
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
