import Link from "next/link";
import { db, schema } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";
import { LinkedInSyncButton } from "./sync-button";
import { BarChart3, TrendingUp, Heart, MessageSquare, Eye, Share2, ArrowUpRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const rows = await db
    .select({
      postId: schema.posts.id,
      content: schema.posts.content,
      authorId: schema.posts.authorId,
      publishedAt: schema.posts.publishedAt,
      impressions: sql<number>`coalesce(sum(${schema.analytics.impressions}), 0)::int`,
      likes: sql<number>`coalesce(sum(${schema.analytics.likes}), 0)::int`,
      comments: sql<number>`coalesce(sum(${schema.analytics.comments}), 0)::int`,
      shares: sql<number>`coalesce(sum(${schema.analytics.shares}), 0)::int`,
    })
    .from(schema.posts)
    .leftJoin(schema.analytics, eq(schema.analytics.postId, schema.posts.id))
    .where(eq(schema.posts.status, "published"))
    .groupBy(schema.posts.id)
    .orderBy(desc(sql`coalesce(sum(${schema.analytics.likes}), 0)`))
    .catch(() => []);

  const authorRows = await db
    .select({
      authorId: schema.posts.authorId,
      totalLikes: sql<number>`coalesce(sum(${schema.analytics.likes}), 0)::int`,
      totalImpressions: sql<number>`coalesce(sum(${schema.analytics.impressions}), 0)::int`,
      postCount: sql<number>`count(distinct ${schema.posts.id})::int`,
    })
    .from(schema.posts)
    .leftJoin(schema.analytics, eq(schema.analytics.postId, schema.posts.id))
    .where(eq(schema.posts.status, "published"))
    .groupBy(schema.posts.authorId)
    .catch(() => []);

  const authorMap = new Map<number, { name: string; role: string | null }>();
  const allAuthors = await db.select().from(schema.authors);
  allAuthors.forEach((a) => authorMap.set(a.id, { name: a.name, role: a.role }));

  const linkedinConnectedAuthorIds = allAuthors
    .filter((a) => !!a.linkedinAccessToken)
    .map((a) => a.id);

  const totals = rows.reduce(
    (acc, r) => ({
      posts: acc.posts + 1,
      impressions: acc.impressions + (r.impressions ?? 0),
      likes: acc.likes + (r.likes ?? 0),
      comments: acc.comments + (r.comments ?? 0),
    }),
    { posts: 0, impressions: 0, likes: 0, comments: 0 }
  );

  return (
    <div className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Analytics</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Post performance feeds back into generation — top-performing hooks get reused automatically.
          </p>
        </div>
        <LinkedInSyncButton authorIds={linkedinConnectedAuthorIds} />
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Published posts" value={totals.posts} color="blue" />
        <StatCard icon={<Eye className="h-4 w-4" />} label="Impressions" value={totals.impressions.toLocaleString()} color="purple" />
        <StatCard icon={<Heart className="h-4 w-4" />} label="Likes" value={totals.likes.toLocaleString()} color="amber" />
        <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Comments" value={totals.comments.toLocaleString()} color="emerald" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Top posts by likes</h2>
          <div className="grid gap-2.5">
            {rows.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No published posts yet.
              </div>
            )}
            {rows.map((r) => (
              <Link
                key={r.postId}
                href={`/posts/${r.postId}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-emerald-400/30 hover:shadow-glow-sm hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-relaxed">{r.content}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {r.authorId && authorMap.get(r.authorId) && (
                      <span className="font-medium text-foreground/60">{authorMap.get(r.authorId)?.name}</span>
                    )}
                    {r.publishedAt && <span>Published {timeAgo(r.publishedAt)}</span>}
                    <span className="text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{r.impressions.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{r.likes.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{r.comments.toLocaleString()}</span>
                    <span className="flex items-center gap-1"><Share2 className="h-3 w-3" />{r.shares.toLocaleString()}</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By author</CardTitle>
              <CardDescription>Total impressions across published posts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {authorRows.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
              {authorRows.map((a) => {
                const author = a.authorId ? authorMap.get(a.authorId) : null;
                const maxImpressions = Math.max(...authorRows.map((x) => x.totalImpressions), 1);
                const pct = Math.round((a.totalImpressions / maxImpressions) * 100);
                return (
                  <div key={a.authorId ?? 0} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{author?.name ?? "Unknown"}</span>
                      <span className="text-muted-foreground">{a.totalImpressions.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.postCount} post{a.postCount === 1 ? "" : "s"} · {a.totalLikes.toLocaleString()} likes
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

const colorMap: Record<string, { icon: string; bg: string }> = {
  blue:    { icon: "text-blue-500",    bg: "bg-blue-500/10"    },
  purple:  { icon: "text-purple-500",  bg: "bg-purple-500/10"  },
  amber:   { icon: "text-amber-500",   bg: "bg-amber-500/10"   },
  emerald: { icon: "text-emerald-500", bg: "bg-emerald-500/10" },
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${c.bg}`}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
