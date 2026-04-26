import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { desc, ne, eq, and, ilike, gte, lte, sql, inArray, or, isNull, isNotNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus, Archive, Radio } from "lucide-react";
import { SignalFilterBar } from "./filter-bar";
import { getCurrentUser, getVisibleAuthorIds } from "@/lib/session";
import { SignalsList } from "./signals-list";
import type { SignalGroup } from "./signals-list";

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
  // Iterate oldest-first so older transcripts get lower numbers (#1, #2, …).
  const untitledByDay = new Map<string, number>();
  const groupNumbers = new Map<string, number>();
  for (const g of [...groups].reverse()) {
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
        <SignalsList
          groups={groups.map((group): SignalGroup => {
            const transcriptId = group.key.startsWith("transcript:")
              ? Number(group.key.slice("transcript:".length))
              : null;
            const date = group.date ?? new Date();
            const showNumber =
              (groupNumbers.get(group.key) ?? 0) > 1 ||
              (untitledByDay.get(date.toDateString()) ?? 0) > 1;
            const displayTitle =
              group.title ??
              `Transcript · ${date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}${showNumber ? ` · #${groupNumbers.get(group.key)}` : ""}`;
            return {
              key: group.key,
              displayTitle,
              transcriptId,
              dateStr: group.date
                ? group.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                : null,
              signals: group.signals.map((s) => ({
                id: s.id,
                status: s.status,
                rawContent: s.rawContent,
                recommendedAuthorId: s.recommendedAuthorId ?? null,
                contentAngles: (s.contentAngles as string[] | null) ?? null,
                hashtags: ((s as any).hashtags as string[] | null) ?? null,
                title: ((s as any).title as string | null) ?? null,
                createdAtMs: s.createdAt.getTime(),
              })),
            };
          })}
          authorMap={Object.fromEntries(authorMap)}
          draftCountMap={Object.fromEntries(draftCountMap)}
        />
      )}
    </div>
  );
}
