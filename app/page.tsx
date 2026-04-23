import Link from "next/link";
import { db, schema } from "@/lib/db";
import { desc, sql, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { ArrowUpRight, Radio, FileEdit, Send, Users, Zap } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadStats() {
  try {
    const [signalsByStatus, postsByStatus, authorsCount, recent] = await Promise.all([
      db.select({ status: schema.signals.status, count: sql<number>`count(*)::int` })
        .from(schema.signals).groupBy(schema.signals.status),
      db.select({ status: schema.posts.status, count: sql<number>`count(*)::int` })
        .from(schema.posts).groupBy(schema.posts.status),
      db.select({ count: sql<number>`count(*)::int` })
        .from(schema.authors).where(eq(schema.authors.active, true)),
      db.select({
        id: schema.posts.id,
        content: schema.posts.content,
        status: schema.posts.status,
        updatedAt: schema.posts.updatedAt,
        authorId: schema.posts.authorId,
        hookStrengthScore: schema.posts.hookStrengthScore,
      }).from(schema.posts).orderBy(desc(schema.posts.updatedAt)).limit(6),
    ]);
    const byStatus = (rows: { status: string; count: number }[]) =>
      Object.fromEntries(rows.map((r) => [r.status, r.count])) as Record<string, number>;
    return {
      unused: byStatus(signalsByStatus).unused ?? 0,
      drafting: byStatus(signalsByStatus).drafting ?? 0,
      inReview: byStatus(postsByStatus).in_review ?? 0,
      approved: byStatus(postsByStatus).approved ?? 0,
      published: byStatus(postsByStatus).published ?? 0,
      drafts: byStatus(postsByStatus).draft ?? 0,
      authors: authorsCount[0]?.count ?? 0,
      recent,
      dbOk: true as const,
    };
  } catch (e: any) {
    return { dbOk: false as const, error: e?.message ?? "Database not connected yet." };
  }
}

export default async function DashboardPage() {
  const stats = await loadStats();

  return (
    <div className="mx-auto w-full max-w-6xl p-6 md:p-10">
      {/* Header */}
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-cyan-500" />
            <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Overview</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Turn meeting signals into LinkedIn posts that sound like you.
          </p>
        </div>
        <Link href="/signals/new">
          <Button size="lg">
            <Radio className="h-4 w-4" />
            Capture signals
          </Button>
        </Link>
      </header>

      {!stats.dbOk ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-700 dark:text-amber-300">Database not connected</CardTitle>
            <CardDescription>
              Set <code className="rounded-lg bg-background px-1.5 py-0.5 text-xs">DATABASE_URL</code> and run{" "}
              <code className="rounded-lg bg-background px-1.5 py-0.5 text-xs">npm run db:push</code> to finish setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Error: {stats.error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<Radio    className="h-4 w-4" />} label="Unused signals" value={stats.unused}    href="/signals"   color="blue" />
            <Stat icon={<FileEdit className="h-4 w-4" />} label="In review"      value={stats.drafts}    href="/drafts"    color="purple" />
            <Stat icon={<Send     className="h-4 w-4" />} label="Published"      value={stats.published} href="/analytics" color="emerald" />
            <Stat icon={<Users    className="h-4 w-4" />} label="Authors"        value={stats.authors}   href="/authors"   color="cyan" />
          </div>

          {/* Recent posts */}
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent posts</h2>
              <Link href="/drafts" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                See all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {stats.recent.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-2.5">
                {stats.recent.map((p) => (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-relaxed">{p.content.slice(0, 220)}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <StatusBadge status={p.status} />
                        <span className="text-muted-foreground/40">·</span>
                        <span>Updated {timeAgo(p.updatedAt)}</span>
                        {p.hookStrengthScore != null && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-primary/70 font-medium">Hook {p.hookStrengthScore}/100</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const colorMap: Record<string, { icon: string; bg: string; ring: string }> = {
  blue:    { icon: "text-blue-500",    bg: "bg-blue-500/10",    ring: "hover:border-blue-400/30"    },
  purple:  { icon: "text-purple-500",  bg: "bg-purple-500/10",  ring: "hover:border-purple-400/30"  },
  amber:   { icon: "text-amber-500",   bg: "bg-amber-500/10",   ring: "hover:border-amber-400/30"   },
  emerald: { icon: "text-emerald-500", bg: "bg-emerald-500/10", ring: "hover:border-emerald-400/30" },
  cyan:    { icon: "text-cyan-500",    bg: "bg-cyan-500/10",    ring: "hover:border-cyan-400/30"    },
};

function Stat({ icon, label, value, href, color }: {
  icon: React.ReactNode; label: string; value: number; href: string; color: string;
}) {
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <Link
      href={href}
      className={`group rounded-2xl border border-border bg-card p-4 transition-all duration-200 ${c.ring} hover:shadow-glow-sm hover:-translate-y-0.5`}
    >
      <div className={`mb-3 inline-flex rounded-xl p-2 ${c.bg}`}>
        <span className={c.icon}>{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    draft:      { variant: "secondary",   label: "Draft"     },
    in_review:  { variant: "warning",     label: "In review" },
    approved:   { variant: "success",     label: "Approved"  },
    rejected:   { variant: "destructive", label: "Rejected"  },
    published:  { variant: "default",     label: "Published" },
  };
  const m = map[status] ?? { variant: "secondary", label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Radio className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-medium">No posts yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Start by capturing a signal from a meeting transcript.</p>
      <div className="mt-5">
        <Link href="/signals/new">
          <Button size="sm">Paste a transcript</Button>
        </Link>
      </div>
    </div>
  );
}
