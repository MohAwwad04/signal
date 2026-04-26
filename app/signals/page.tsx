import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { desc, ne, eq, and, ilike, gte, lte, sql, inArray, or, isNull, isNotNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { Plus, Linkedin, Archive, Radio, ArrowUpRight, FileText } from "lucide-react";
import { SignalFilterBar } from "./filter-bar";
import { getCurrentUser, getVisibleAuthorIds } from "@/lib/session";
import { SendSignalButton } from "./send-signal-button";
import { GroupTitleEdit } from "./group-title-edit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: { q?: string; author?: string; angle?: string; from?: string; to?: string };
}) {
  const { q, author, angle, from, to } = searchParams;

  const session = await getCurrentUser();
  if (!session?.isAdmin && !session?.isSuperAdmin) redirect("/drafts");

  const visibleAuthorIds = await getVisibleAuthorIds();

  const conditions: any[] = [
    ne(schema.signals.status, "archived"),
    ne(schema.signals.status, "drafting"),
    or(
      isNotNull(schema.signals.transcriptId),
      isNotNull(schema.signals.sourceTranscript),
    )!,
    isNotNull(schema.signals.hookStrengthScore),
  ];

  if (visibleAuthorIds === null) {
    // superadmin — no extra filter
  } else if (session?.isAdmin) {
    if (visibleAuthorIds.length > 0) {
      conditions.push(
        or(
          inArray(schema.signals.recommendedAuthorId, visibleAuthorIds),
          isNull(schema.signals.recommendedAuthorId),
        )!
      );
    } else {
      conditions.push(isNull(schema.signals.recommendedAuthorId));
    }
  } else if (visibleAuthorIds.length > 0) {
    conditions.push(inArray(schema.signals.recommendedAuthorId, visibleAuthorIds));
  } else {
    conditions.push(eq(schema.signals.id, -1));
  }

  if (q) conditions.push(ilike(schema.signals.rawContent, `%${q}%`));
  if (author && session?.isSuperAdmin) conditions.push(eq(schema.signals.recommendedAuthorId, Number(author)));
  if (from) conditions.push(gte(schema.signals.createdAt, new Date(from)));
  if (to) conditions.push(lte(schema.signals.createdAt, new Date(to + "T23:59:59")));
  if (angle) conditions.push(sql`${schema.signals.contentAngles} @> ${JSON.stringify([angle])}::jsonb`);

  const [signals, authors, allAngles, archivedCount] = await Promise.all([
    db.select().from(schema.signals).where(and(...conditions)).orderBy(desc(schema.signals.createdAt)).limit(200),
    db.select({ id: schema.authors.id, name: schema.authors.name }).from(schema.authors).where(eq(schema.authors.active, true)),
    db.select({ id: schema.contentAngles.id, name: schema.contentAngles.name }).from(schema.contentAngles).orderBy(schema.contentAngles.name),
    (async () => {
      const archConds: any[] = [eq(schema.signals.status, "archived")];
      if (visibleAuthorIds === null) {
        // superadmin — no extra filter
      } else if (session?.isAdmin) {
        if (visibleAuthorIds.length > 0) {
          archConds.push(
            or(
              inArray(schema.signals.recommendedAuthorId, visibleAuthorIds),
              isNull(schema.signals.recommendedAuthorId),
            )!
          );
        } else {
          archConds.push(isNull(schema.signals.recommendedAuthorId));
        }
      } else if (visibleAuthorIds.length > 0) {
        archConds.push(inArray(schema.signals.recommendedAuthorId, visibleAuthorIds));
      } else {
        archConds.push(eq(schema.signals.id, -1));
      }
      const r = await db.select({ id: schema.signals.id }).from(schema.signals).where(and(...archConds));
      return r.length;
    })(),
  ]);

  // Draft post counts per signal (to show "Send to user" button)
  const signalIds = signals.map((s) => s.id);
  const draftPostCounts = signalIds.length
    ? await db
        .select({ signalId: schema.posts.signalId, count: sql<number>`count(*)::int` })
        .from(schema.posts)
        .where(and(
          inArray(schema.posts.signalId, signalIds),
          inArray(schema.posts.status, ["draft", "rejected"] as any[]),
        ))
        .groupBy(schema.posts.signalId)
    : [];
  const draftCountMap = new Map(draftPostCounts.map((r) => [r.signalId, r.count]));

  const authorMap = new Map(authors.map((a) => [a.id, a.name]));
  const isFiltered = !!(q || author || angle || from || to);

  type SignalRow = typeof signals[number];
  type Group = {
    key: string;
    title: string | null;
    date: Date | null;
    signals: SignalRow[];
  };

  const groupMap = new Map<string, Group>();
  for (const s of signals) {
    // Each transcript extraction gets its own group via transcriptId.
    // Fall back to meetingId / meetingTitle for legacy signals, then a per-signal key.
    const key = s.transcriptId
      ? `transcript:${s.transcriptId}`
      : s.sourceMeetingId
      ? `meeting:${s.sourceMeetingId}`
      : s.sourceMeetingTitle
      ? `title:${s.sourceMeetingTitle}`
      : `signal:${s.id}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        title: s.sourceMeetingTitle ?? null,
        date: s.sourceMeetingDate ?? s.createdAt,
        signals: [],
      });
    }
    groupMap.get(key)!.signals.push(s);
  }

  const groups = [...groupMap.values()].sort((a, b) =>
    (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)
  );

  // Number untitled transcript groups so same-day ones are distinguishable.
  const untitledByDay = new Map<string, number>();
  const groupNumbers = new Map<string, number>();
  for (const g of groups) {
    if (!g.title) {
      const day = (g.date ?? new Date()).toDateString();
      const n = (untitledByDay.get(day) ?? 0) + 1;
      untitledByDay.set(day, n);
      groupNumbers.set(g.key, n);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">Signals</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Captured signals</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            LinkedIn posts generated from your meetings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/signals/archive">
            <Button variant="outline" size="sm">
              <Archive className="h-4 w-4" />
              Archive
              {archivedCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {archivedCount}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/signals/new">
            <Button>
              <Plus className="h-4 w-4" />
              New from transcript
            </Button>
          </Link>
        </div>
      </header>

      <Suspense fallback={null}>
        <SignalFilterBar authors={authors} angles={allAngles} />
      </Suspense>

      {signals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
            <Radio className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{isFiltered ? "No signals match your filters" : "No signals yet"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isFiltered ? "Try adjusting or clearing your filters." : "Paste a transcript to extract content ideas."}
          </p>
          {!isFiltered && (
            <div className="mt-5">
              <Link href="/signals/new">
                <Button size="sm">Paste a transcript</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key ?? "__none__"}>
              {/* Group header */}
              <div className="mb-3 flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  {(() => {
                    const transcriptId = group.key.startsWith("transcript:") ? Number(group.key.slice("transcript:".length)) : null;
                    const displayTitle = group.title ?? `Transcript · ${(group.date ?? new Date()).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}${(groupNumbers.get(group.key) ?? 0) > 1 || (untitledByDay.get((group.date ?? new Date()).toDateString()) ?? 0) > 1 ? ` · #${groupNumbers.get(group.key)}` : ""}`;
                    return transcriptId
                      ? <GroupTitleEdit transcriptId={transcriptId} title={displayTitle} />
                      : <span className="text-sm font-semibold truncate">{displayTitle}</span>;
                  })()}
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {group.signals.length} signal{group.signals.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {group.date && (
                  <span className="shrink-0 text-[11px] text-muted-foreground/60">
                    {group.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Signals in this group */}
              <div className="grid gap-2">
                {group.signals.map((s) => {
                  const authorName = s.recommendedAuthorId ? authorMap.get(s.recommendedAuthorId) : null;
                  const contentLines = s.rawContent.split("\n").filter((l) => l.trim().length > 0);
                  const firstLine = contentLines[0] ?? s.rawContent;
                  const taggedAngles = (s.contentAngles as string[] | null) ?? [];
                  const hashtags = ((s as any).hashtags as string[] | null) ?? [];
                  const signalTitle = (s as any).title as string | null;
                  const previewTags = hashtags.slice(0, 4);
                  const previewTitle = !previewTags.length && signalTitle
                    ? signalTitle.trim().split(/\s+/).slice(0, 5).join(" ")
                    : null;
                  return (
                    <div
                      key={s.id}
                      className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
                    >
                      <Link href={`/signals/${s.id}`} className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{firstLine}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant={s.status === "unused" ? "warning" : s.status === "used" ? "success" : "secondary"}>
                            {s.status}
                          </Badge>
                          {authorName && (
                            <span className="flex items-center gap-1">
                              <Linkedin className="h-3 w-3" />
                              {authorName}
                            </span>
                          )}
                          {taggedAngles.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full bg-purple-500/8 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                              {tag}
                            </span>
                          ))}
                          {previewTags.length > 0 && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              {previewTags.map((tag) => (
                                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                                  #{tag}
                                </span>
                              ))}
                            </>
                          )}
                          {previewTitle && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="italic text-muted-foreground/50 truncate max-w-[220px]">{previewTitle}</span>
                            </>
                          )}
                          <span className="text-muted-foreground/40">·</span>
                          <span>{timeAgo(s.createdAt)}</span>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        {(draftCountMap.get(s.id) ?? 0) > 0 && (
                          <SendSignalButton signalId={s.id} />
                        )}
                        <Link href={`/signals/${s.id}`}>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
