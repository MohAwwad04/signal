import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { ArrowLeft, Radio, ArrowUpRight } from "lucide-react";
import { PostEditor } from "./post-editor";
import { SignalGenerateForm } from "./generate-form";
import { AuthorCard, SignalAnglesCard, TranscriptCard, SignalStatsPanel } from "./sidebar-cards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignalDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);

  const [signal, allAuthors, frameworks, allAngles] = await Promise.all([
    db.select().from(schema.signals).where(eq(schema.signals.id, id)).then((r) => r[0]),
    db.select({ id: schema.authors.id, name: schema.authors.name, role: schema.authors.role }).from(schema.authors).where(eq(schema.authors.active, true)),
    db.select().from(schema.frameworks).orderBy(schema.frameworks.name),
    db.select({ id: schema.contentAngles.id, name: schema.contentAngles.name }).from(schema.contentAngles).orderBy(schema.contentAngles.name),
  ]);

  if (!signal) notFound();

  const author = signal.recommendedAuthorId
    ? allAuthors.find((a) => a.id === signal.recommendedAuthorId) ?? null
    : null;

  // Posts for this signal
  const signalPosts = await db
    .select({
      id: schema.posts.id,
      content: schema.posts.content,
      status: schema.posts.status,
      hookStrengthScore: schema.posts.hookStrengthScore,
      specificityScore: schema.posts.specificityScore,
      frameworkId: schema.posts.frameworkId,
      contentAngle: schema.posts.contentAngle,
      createdAt: schema.posts.createdAt,
    })
    .from(schema.posts)
    .where(eq(schema.posts.signalId, id))
    .orderBy(desc(schema.posts.createdAt));

  // Analytics for this signal's posts
  const postIds = signalPosts.map((p) => p.id);
  const analyticsRows = postIds.length > 0
    ? await db
        .select({
          impressions: sql<number>`coalesce(sum(${schema.analytics.impressions}), 0)::int`,
          likes: sql<number>`coalesce(sum(${schema.analytics.likes}), 0)::int`,
          comments: sql<number>`coalesce(sum(${schema.analytics.comments}), 0)::int`,
          shares: sql<number>`coalesce(sum(${schema.analytics.shares}), 0)::int`,
        })
        .from(schema.analytics)
        .where(inArray(schema.analytics.postId, postIds))
    : [];

  const totalAnalytics = analyticsRows[0] ?? { impressions: 0, likes: 0, comments: 0, shares: 0 };

  // Best quality post for stats display
  const bestPost = signalPosts.length > 0
    ? signalPosts.reduce((best, p) => {
        const score = (p.hookStrengthScore ?? 0) + (p.specificityScore ?? 0);
        const bestScore = (best.hookStrengthScore ?? 0) + (best.specificityScore ?? 0);
        return score > bestScore ? p : best;
      })
    : null;

  // Content angles for the generate form: signal angles + author angles + all global angles
  const signalAngles = (signal.contentAngles as string[] | null) ?? [];
  const authorAngles = author
    ? ((await db
        .select({ name: schema.contentAngles.name })
        .from(schema.authorContentAngles)
        .innerJoin(schema.contentAngles, eq(schema.authorContentAngles.contentAngleId, schema.contentAngles.id))
        .where(eq(schema.authorContentAngles.authorId, author.id))
      ).map((r) => r.name))
    : [];
  const allAngleNames = Array.from(new Set([...signalAngles, ...authorAngles, ...allAngles.map((a) => a.name)]));

  const frameworksForForm = frameworks.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    bestFor: (f.bestFor as string[] | null) ?? [],
  }));

  const frameworksForEditor = frameworks.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
  }));

  return (
    <div className="mx-auto w-full max-w-7xl p-6 md:p-10">
      {/* Back */}
      <div className="mb-6">
        <Link href="/signals">
          <Button variant="ghost" size="sm" className="pl-1">
            <ArrowLeft className="h-4 w-4" />
            Back to signals
          </Button>
        </Link>
      </div>

      {/* Signal header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">Signal #{signal.id}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant={signal.status === "unused" ? "warning" : signal.status === "used" ? "success" : "secondary"}>
            {signal.status}
          </Badge>
          {signal.sourceMeetingTitle && <span>{signal.sourceMeetingTitle}</span>}
          {signal.sourceMeetingDate && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{signal.sourceMeetingDate.toLocaleDateString()}</span>
            </>
          )}
          <span className="text-muted-foreground/40">·</span>
          <span>{timeAgo(signal.createdAt)}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_288px]">
        {/* ── MAIN ── */}
        <div className="space-y-5 min-w-0">
          <PostEditor
            signalId={signal.id}
            initialContent={signal.rawContent}
            authorName={author?.name ?? null}
            frameworks={frameworksForEditor}
            bestFrameworkId={signal.bestFrameworkId ?? null}
          />

          <SignalGenerateForm
            signalId={signal.id}
            contentAngles={allAngleNames}
            recommendedAuthorId={signal.recommendedAuthorId ?? null}
            authors={allAuthors}
            frameworks={frameworksForForm}
            contentType={signal.contentType}
            bestFrameworkId={signal.bestFrameworkId ?? null}
          />

          {signalPosts.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Generated posts ({signalPosts.length})
              </h3>
              <div className="grid gap-2">
                {signalPosts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}`}
                    className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{p.content}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        <PostStatusBadge status={p.status} />
                        {p.contentAngle && <span className="text-muted-foreground line-clamp-1">· {p.contentAngle}</span>}
                        {p.hookStrengthScore != null && (
                          <span className="text-primary/70 font-medium">Hook {(p.hookStrengthScore / 20).toFixed(1)}/5</span>
                        )}
                        <span className="text-muted-foreground">{timeAgo(p.createdAt)}</span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {signal.notes && (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note: </span>{signal.notes}
            </div>
          )}
        </div>

        {/* ── SIDEBAR ── */}
        <aside className="space-y-4">
          <AuthorCard
            signalId={signal.id}
            author={author}
            allAuthors={allAuthors}
          />

          <SignalAnglesCard
            signalId={signal.id}
            signalAngles={signalAngles}
            allAngles={allAngles}
          />

          {signal.sourceTranscript && (
            <TranscriptCard transcript={signal.sourceTranscript} />
          )}

          <SignalStatsPanel
            hookStrength={bestPost?.hookStrengthScore ?? null}
            specificity={bestPost?.specificityScore ?? null}
            analytics={totalAnalytics}
            postCount={signalPosts.length}
          />
        </aside>
      </div>
    </div>
  );
}

function PostStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    draft:     { variant: "secondary",   label: "Draft"     },
    in_review: { variant: "warning",     label: "In review" },
    approved:  { variant: "success",     label: "Approved"  },
    rejected:  { variant: "destructive", label: "Rejected"  },
    published: { variant: "default",     label: "Published" },
  };
  const m = map[status] ?? { variant: "secondary", label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
