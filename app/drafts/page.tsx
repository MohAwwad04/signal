import Link from "next/link";
import { db, schema } from "@/lib/db";
import { desc, eq, inArray, sql, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { FileEdit, ArrowUpRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const TABS = [
  { key: "drafts",   label: "In review", statuses: ["draft", "in_review"] as const, icon: FileEdit,      color: "text-blue-500"   },
  { key: "accepted", label: "Accepted",  statuses: ["approved", "published"] as const, icon: CheckCircle2, color: "text-emerald-500" },
  { key: "rejected", label: "Rejected",  statuses: ["rejected"] as const,             icon: XCircle,      color: "text-red-500"    },
] as const;

type TabKey = typeof TABS[number]["key"];

export default async function DraftsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await getCurrentUser();
  const isRegularUser = !session?.isAdmin && !session?.isSuperAdmin;
  const scopedAuthorId = isRegularUser ? (session?.authorId ?? null) : null;

  const activeTab: TabKey = (searchParams.tab as TabKey) ?? "drafts";
  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  const statusCondition = sql`${schema.posts.status} = ANY(ARRAY[${sql.join(tab.statuses.map(s => sql`${s}`), sql`, `)}]::text[])`;
  const authorCondition = scopedAuthorId ? eq(schema.posts.authorId, scopedAuthorId) : undefined;

  const posts = await db
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      status: schema.posts.status,
      contentAngle: schema.posts.contentAngle,
      authorId: schema.posts.authorId,
      hookStrengthScore: schema.posts.hookStrengthScore,
      specificityScore: schema.posts.specificityScore,
      reviewerNotes: schema.posts.reviewerNotes,
      createdAt: schema.posts.createdAt,
      updatedAt: schema.posts.updatedAt,
    })
    .from(schema.posts)
    .where(authorCondition ? and(statusCondition, authorCondition) : statusCondition)
    .orderBy(desc(schema.posts.updatedAt))
    .limit(200)
    .catch(() => []);

  const authorIds = [...new Set(posts.map((p) => p.authorId).filter(Boolean) as number[])];
  const authors = authorIds.length > 0
    ? await db.select({ id: schema.authors.id, name: schema.authors.name }).from(schema.authors).where(inArray(schema.authors.id, authorIds))
    : [];
  const authorMap = new Map(authors.map((a) => [a.id, a.name]));

  // Counts for tab badges — scoped to same author filter
  const countsQuery = db
    .select({ status: schema.posts.status, count: sql<number>`count(*)::int` })
    .from(schema.posts)
    .groupBy(schema.posts.status);
  const counts = await (authorCondition
    ? countsQuery.where(authorCondition)
    : countsQuery
  ).catch(() => []);

  const countByStatus: Record<string, number> = {};
  for (const row of counts) {
    countByStatus[row.status] = row.count;
  }

  function tabCount(t: typeof TABS[number]) {
    return t.statuses.reduce((sum, s) => sum + (countByStatus[s] ?? 0), 0);
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <FileEdit className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">{isRegularUser ? "My posts" : "In review"}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isRegularUser
            ? "Posts written for you — review, edit, and approve before they go live."
            : "Review in-progress posts, track approved ones, and manage rejections."}
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-muted p-1 w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === activeTab;
          const count = tabCount(t);
          return (
            <Link
              key={t.key}
              href={`/drafts?tab=${t.key}`}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? t.color : ""}`} />
              {t.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isActive ? "bg-primary/10 text-primary" : "bg-muted-foreground/15 text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <tab.icon className={`h-5 w-5 ${tab.color}`} />
          </div>
          <p className="text-sm font-medium">No {tab.label.toLowerCase()} yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab.key === "drafts"
              ? isRegularUser ? "Your admin will send posts here for you to review." : "Generate a post from a signal to see it here in review."
              : tab.key === "accepted"
              ? "Approved posts will appear here."
              : "Rejected posts will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {posts.map((p) => {
            const authorName = p.authorId ? authorMap.get(p.authorId) : null;
            return (
              <Link
                key={p.id}
                href={`/posts/${p.id}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-relaxed">{p.content}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <StatusBadge status={p.status} />
                    {authorName && <span className="text-muted-foreground">{authorName}</span>}
                    {p.contentAngle && (
                      <span className="text-muted-foreground line-clamp-1">· {p.contentAngle}</span>
                    )}
                    {p.hookStrengthScore != null && (
                      <span className="text-primary/70 font-medium">
                        Hook {(p.hookStrengthScore / 20).toFixed(1)}/5
                      </span>
                    )}
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(p.updatedAt)}
                    </span>
                  </div>
                  {p.reviewerNotes && tab.key === "rejected" && (
                    <p className="mt-1.5 text-xs text-destructive/80 line-clamp-1">
                      ↩ {p.reviewerNotes}
                    </p>
                  )}
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    draft:      { variant: "secondary",   label: "Draft"      },
    in_review:  { variant: "warning",     label: "In review"  },
    approved:   { variant: "success",     label: "Approved"   },
    rejected:   { variant: "destructive", label: "Rejected"   },
    published:  { variant: "default",     label: "Published"  },
  };
  const m = map[status] ?? { variant: "secondary", label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
