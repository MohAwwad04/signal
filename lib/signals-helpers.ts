import { db, schema } from "./db";
import { eq, inArray, and, isNull, or, sql, ne } from "drizzle-orm";
import { scorePost } from "./claude";

function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const setA = words(a);
  const setB = words(b);
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Filters out candidate rows whose rawContent is near-identical (Jaccard ≥ 0.75)
 * to a non-archived signal already in the database.
 * Only active signals are compared — archived ones are excluded.
 */
export async function deduplicateAgainstExisting<T extends { rawContent: string }>(
  rows: T[],
): Promise<T[]> {
  if (!rows.length) return [];
  const existing = await db
    .select({ rawContent: schema.signals.rawContent })
    .from(schema.signals)
    .where(ne(schema.signals.status, "archived"))
    .limit(2000);
  if (!existing.length) return rows;
  return rows.filter(
    (row) => !existing.some((e) => jaccardSimilarity(row.rawContent, e.rawContent) >= 0.75),
  );
}

/**
 * Find an existing transcript by sourceMeetingId, or insert a new one.
 * Every signal must point at a transcript row — there is no "transcript-less" signal.
 */
export async function ensureTranscript(input: {
  title?: string | null;
  content: string;
  source: string;
  sourceMeetingId?: string | null;
  sourceMeetingDate?: Date | null;
}): Promise<typeof schema.transcripts.$inferSelect> {
  if (!input.content || input.content.trim().length === 0) {
    throw new Error("Cannot create a transcript with empty content.");
  }
  if (input.sourceMeetingId) {
    const existing = await db
      .select()
      .from(schema.transcripts)
      .where(eq(schema.transcripts.sourceMeetingId, input.sourceMeetingId))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (existing) return existing;
  }
  const [row] = await db
    .insert(schema.transcripts)
    .values({
      title: input.title ?? null,
      content: input.content,
      source: input.source,
      sourceMeetingId: input.sourceMeetingId ?? null,
      sourceMeetingDate: input.sourceMeetingDate ?? null,
    })
    .returning();
  return row;
}

/**
 * Score the given signals. Any signal whose scoring fails is deleted, so the
 * "every signal has transcript + scores" invariant always holds after this returns.
 */
export async function scoreSignalsOrDelete(signalIds: number[]): Promise<number[]> {
  if (signalIds.length === 0) return [];
  const signals = await db
    .select({ id: schema.signals.id, rawContent: schema.signals.rawContent })
    .from(schema.signals)
    .where(inArray(schema.signals.id, signalIds));

  const results = await Promise.allSettled(
    signals.map(async (s) => {
      const scores = await scorePost(s.rawContent);
      await db
        .update(schema.signals)
        .set({
          hookStrengthScore: scores.hookStrength,
          specificityScore: scores.specificity,
          clarityScore: scores.clarity,
          emotionalResonanceScore: scores.emotionalResonance,
          callToActionScore: scores.callToAction,
        })
        .where(eq(schema.signals.id, s.id));
      return s.id;
    }),
  );

  const kept: number[] = [];
  const failed: number[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") kept.push(signals[i].id);
    else failed.push(signals[i].id);
  });

  if (failed.length > 0) {
    await db.delete(schema.signals).where(inArray(schema.signals.id, failed));
    console.error(`[signals] Dropped ${failed.length} signal(s) that failed scoring:`, failed);
  }

  return kept;
}

/**
 * Hard-delete every signal that lacks a transcript link or a hook score.
 * Used as a one-shot cleanup; insertion paths must already enforce the invariant.
 */
export async function pruneInvalidSignals(): Promise<number> {
  const bad = await db
    .select({ id: schema.signals.id })
    .from(schema.signals)
    .where(
      or(
        and(isNull(schema.signals.transcriptId), sql`${schema.signals.sourceTranscript} is null or length(${schema.signals.sourceTranscript}) = 0`),
        isNull(schema.signals.hookStrengthScore),
      )!,
    );
  if (bad.length === 0) return 0;
  const ids = bad.map((b) => b.id);
  await db.delete(schema.signals).where(inArray(schema.signals.id, ids));
  return ids.length;
}
