import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { ArrowLeft, Radio, ArrowUpRight, Check } from "lucide-react";
import { PostEditor } from "./post-editor";
import { AuthorCard, SignalAnglesCard, TranscriptCard, SignalStatsPanel, SourceExcerptCard } from "./sidebar-cards";
import { SendToReviewButton } from "./send-to-review-button";
import { ScoresProvider } from "./scores-provider";
import { getCurrentUser, getVisibleAuthorIds } from "@/lib/session";
import { selectBestFramework } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type AngleWithAuthor = { name: string; authorId: number; authorName: string };

export default async function SignalDetailPage({ params }: { params: { id: string } }) {
  const session = await getCurrentUser();
  if (!session?.isAdmin && !session?.isSuperAdmin) redirect("/drafts");

  const id = Number(params.id);

  const [signal, frameworks] = await Promise.all([
    db.select().from(schema.signals).where(eq(schema.signals.id, id)).then((r) => r[0]),
    db.select().from(schema.frameworks).orderBy(schema.frameworks.name),
  ]);

  if (!signal) notFound();

  const hasTranscript = signal.transcriptId !== null || (signal.sourceTranscript ?? "").trim().length > 0;
  const hasScores = signal.hookStrengthScore !== null;
  if (!hasTranscript || !hasScores) redirect("/signals");

  // Get visible authors — checks DB freshness every visit (force-dynamic)
  const visibleAuthorIds = await getVisibleAuthorIds();

  // Fetch active authors filtered by visibility
  const allAuthors = await db
    .select({ id: schema.authors.id, name: schema.authors.name, role: schema.authors.role })
    .from(schema.authors)
    .where(eq(schema.authors.active, true))
    .then((rows) =>
      visibleAuthorIds === null ? rows : rows.filter((a) => visibleAuthorIds.includes(a.id))
    );

  if (session?.isAdmin && !session.isSuperAdmin) {
    const recId = signal.recommendedAuthorId;
    const allowed =
      recId === null ||
      (visibleAuthorIds !== null && visibleAuthorIds.includes(recId));
    if (!allowed) redirect("/signals");
  }

  // AI-select best framework on first open, then cache it on the signal
  if (!signal.bestFrameworkId && frameworks.length > 0) {
    const bestId = await selectBestFramework(signal.rawContent, frameworks.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      bestFor: (f.bestFor as string[] | null) ?? [],
    }))).catch(() => null);
    if (bestId) {
      signal.bestFrameworkId = bestId;
      db.update(schema.signals).set({ bestFrameworkId: bestId }).where(eq(schema.signals.id, id)).catch(() => {});
    }
  }

  // Load transcript in parallel with posts/analytics
  const transcriptPromise = signal.transcriptId
    ? db.select({ content: schema.transcripts.content }).from(schema.transcripts)
        .where(eq(schema.transcripts.id, signal.transcriptId))
        .then((r) => r[0]?.content ?? null)
    : Promise.resolve(signal.sourceTranscript ?? null);

  const author = signal.recommendedAuthorId
    ? allAuthors.find((a) => a.id === signal.recommendedAuthorId) ?? null
    : null;

  const signalAngles = (signal.contentAngles as string[] | null) ?? [];

  // Fetch posts and transcript in parallel
  const [signalPosts, transcriptText] = await Promise.all([
    db.select({
      id: schema.posts.id,
      content: schema.posts.content,
      status: schema.posts.status,
      hookStrengthScore: schema.posts.hookStrengthScore,
      specificityScore: schema.posts.specificityScore,
      frameworkId: schema.posts.frameworkId,
      contentAngle: schema.posts.contentAngle,
      createdAt: schema.posts.createdAt,
    }).from(schema.posts).where(eq(schema.posts.signalId, id)).orderBy(desc(schema.posts.createdAt)),
    transcriptPromise,
  ]);

  // Analytics fetched in parallel with posts processing
  const postIds = signalPosts.map((p) => p.id);
  const analyticsRows = postIds.length > 0
    ? await db.select({
        impressions: sql<number>`coalesce(sum(${schema.analytics.impressions}), 0)::int`,
        likes: sql<number>`coalesce(sum(${schema.analytics.likes}), 0)::int`,
        comments: sql<number>`coalesce(sum(${schema.analytics.comments}), 0)::int`,
        shares: sql<number>`coalesce(sum(${schema.analytics.shares}), 0)::int`,
      }).from(schema.analytics).where(inArray(schema.analytics.postId, postIds))
    : [];

  const totalAnalytics = analyticsRows[0] ?? { impressions: 0, likes: 0, comments: 0, shares: 0 };

  const frameworksForEditor = frameworks.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    bestFor: (f.bestFor as string[] | null) ?? [],
    contentType: signal.contentType,
  }));

  // First signal content angle is the AI-recommended one (set during extraction)
  const recommendedAngle = signalAngles[0] ?? null;

  // Available angle names for auto-generation (signal angles only — author angles fetched client-side)
  const allAngleNames = signalAngles;

  // Most recent draft or rejected post to pre-populate the editor on load
  const latestEditablePost = signalPosts.find(
    (p) => p.status === "draft" || p.status === "rejected"
  ) ?? null;

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
      <ScoresProvider
        signalId={signal.id}
        initial={{
          hookStrength: signal.hookStrengthScore ?? null,
          specificity: (signal as any).specificityScore ?? null,
          clarity: (signal as any).clarityScore ?? null,
          emotionalResonance: (signal as any).emotionalResonanceScore ?? null,
          callToAction: (signal as any).callToActionScore ?? null,
        }}
        initialAuthorId={signal.recommendedAuthorId ?? null}
      >
      <div className="grid gap-6 lg:grid-cols-[1fr_288px]">
        {/* ── MAIN ── */}
        <div className="space-y-5 min-w-0">
          <PostEditor
            signalId={signal.id}
            initialContent={signal.rawContent}
            authorName={author?.name ?? null}
            allAuthors={[]}
            frameworks={frameworksForEditor}
            bestFrameworkId={signal.bestFrameworkId ?? null}
            contentAngles={allAngleNames}
            existingPostCount={signalPosts.length}
            defaultAuthorId={allAuthors[0]?.id ?? null}
            initialGeneratedPost={latestEditablePost ? { id: latestEditablePost.id, content: latestEditablePost.content } : null}
            signalAngles={signalAngles}
            anglesWithAuthor={[]}
            globalAngles={[]}
            recommendedAngle={recommendedAngle}
            isAdmin={session.isAdmin}
            isSuperAdmin={session.isSuperAdmin}
          />

          {signalPosts.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Generated posts ({signalPosts.length})
              </h3>
              <div className="grid gap-2">
                {signalPosts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <Link
                      href={`/posts/${p.id}`}
                      className="group flex min-w-0 flex-1 items-start gap-4 transition-all duration-200 hover:opacity-80"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{p.content}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <PostStatusBadge status={p.status} />
                          {p.contentAngle && <span className="text-muted-foreground line-clamp-1">· {p.contentAngle}</span>}
                          {p.hookStrengthScore != null && (
                            <span className="text-primary/70 font-medium">Hook {p.hookStrengthScore}/100</span>
                          )}
                          <span className="text-muted-foreground">{timeAgo(p.createdAt)}</span>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                    {p.status === "in_review" ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> Sent to user
                      </span>
                    ) : (p.status === "draft" || p.status === "rejected") ? (
                      <SendToReviewButton postId={p.id} />
                    ) : null}
                  </div>
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
            allAuthors={[]}
          />

          <SignalAnglesCard
            signalId={signal.id}
            signalAngles={signalAngles}
            allAngles={[]}
          />

          {transcriptText && (
            <TranscriptCard transcript={transcriptText} />
          )}

          <SignalStatsPanel
            analytics={totalAnalytics}
            postCount={signalPosts.length}
          />

          {(signal as any).sourceExcerpt && (
            <SourceExcerptCard excerpt={(signal as any).sourceExcerpt} />
          )}
        </aside>
      </div>
      </ScoresProvider>
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
