import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getValidLinkedinToken, fetchLinkedinPostMetrics } from "@/lib/linkedin";

export async function POST(
  _req: NextRequest,
  { params }: { params: { authorId: string } }
) {
  const authorId = Number(params.authorId);
  if (!authorId) return NextResponse.json({ error: "Invalid authorId" }, { status: 400 });

  const [author] = await db
    .select()
    .from(schema.authors)
    .where(eq(schema.authors.id, authorId));

  if (!author?.linkedinAccessToken) {
    return NextResponse.json({ error: "LinkedIn not connected for this author" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getValidLinkedinToken(authorId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }

  // Find all published posts for this author that have a LinkedIn URN
  const posts = await db
    .select()
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.authorId, authorId),
        eq(schema.posts.status, "published")
      )
    );

  const linkedPosts = posts.filter((p) => p.linkedinPostUrn);

  const syncResults = await Promise.allSettled(
    linkedPosts.map(async (post) => {
      const metrics = await fetchLinkedinPostMetrics(token, post.linkedinPostUrn!);
      if (!metrics) return false;

      const [existing] = await db
        .select()
        .from(schema.analytics)
        .where(and(eq(schema.analytics.postId, post.id), eq(schema.analytics.source, "linkedin")));

      if (existing) {
        await db
          .update(schema.analytics)
          .set({ impressions: metrics.impressions, likes: metrics.likes, comments: metrics.comments, shares: metrics.shares, capturedAt: new Date() })
          .where(eq(schema.analytics.id, existing.id));
      } else {
        await db.insert(schema.analytics).values({
          postId: post.id, impressions: metrics.impressions, likes: metrics.likes,
          comments: metrics.comments, shares: metrics.shares, clicks: 0, source: "linkedin",
        });
      }
      return true;
    })
  );

  const synced = syncResults.filter((r) => r.status === "fulfilled" && r.value).length;

  await db
    .update(schema.authors)
    .set({ linkedinLastSyncedAt: new Date() })
    .where(eq(schema.authors.id, authorId));

  return NextResponse.json({ ok: true, synced, total: linkedPosts.length });
}
