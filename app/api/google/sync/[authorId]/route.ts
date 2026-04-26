import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { eq, inArray, and } from "drizzle-orm";
import { getValidGoogleToken, fetchGoogleMeetTranscripts } from "@/lib/google";
import { generatePostsFromTranscript } from "@/lib/claude";
import { scoreSignalsOrDelete, deduplicateAgainstExisting } from "@/lib/signals-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: { authorId: string } }
) {
  const authorId = Number(params.authorId);
  if (!authorId) return NextResponse.json({ error: "invalid authorId" }, { status: 400 });

  let token: string;
  try {
    token = await getValidGoogleToken(authorId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "token error";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const meetings = await fetchGoogleMeetTranscripts(token, 10);
  if (!meetings.length) return NextResponse.json({ ok: true, synced: 0, meetings: 0 });

  // Deduplicate per author: skip only if this author already has signals from this meeting
  const fileIds = meetings.map((m) => m.id);
  const existingSignals = fileIds.length
    ? await db.select({ sourceMeetingId: schema.signals.sourceMeetingId })
        .from(schema.signals)
        .where(and(
          inArray(schema.signals.sourceMeetingId, fileIds),
          eq(schema.signals.recommendedAuthorId, authorId),
        ))
    : [];
  const existingIds = new Set(existingSignals.map((s) => s.sourceMeetingId));

  const newMeetings = meetings.filter((m) => !existingIds.has(m.id));
  if (!newMeetings.length) return NextResponse.json({ ok: true, synced: 0, meetings: meetings.length });

  const [authors, allFrameworks] = await Promise.all([
    db.select().from(schema.authors).where(eq(schema.authors.active, true)),
    db.select().from(schema.frameworks),
  ]);

  const authorContexts = authors.map((a) => ({
    role: a.role ?? "",
    contentAngles: (a.contentAngles as string[] | null) ?? [],
    preferredFrameworkNames: (a.preferredFrameworks as number[] | null ?? [])
      .map((fid) => allFrameworks.find((f) => f.id === fid)?.name)
      .filter((n): n is string => Boolean(n)),
    voiceProfile: a.voiceProfile ?? undefined,
  }));

  let totalSignals = 0;

  for (const meeting of newMeetings) {
    try {
      // Reuse existing transcript if already stored, otherwise insert
      const existingTranscript = await db.select()
        .from(schema.transcripts)
        .where(eq(schema.transcripts.sourceMeetingId, meeting.id))
        .limit(1)
        .then((r) => r[0] ?? null);

      const transcriptRow = existingTranscript ?? (await db.insert(schema.transcripts).values({
        title: meeting.title,
        content: meeting.transcript,
        source: "google_meet",
        sourceMeetingId: meeting.id,
        sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
      }).returning().then((r) => r[0]));

      const generated = await generatePostsFromTranscript(meeting.transcript, authorContexts);
      if (!generated.length) continue;

      const rows = generated.map((s) => {
        const recFramework = s.frameworkName
          ? allFrameworks.find((f) => f.name.toLowerCase() === s.frameworkName!.toLowerCase())
          : undefined;
        return {
          rawContent: s.rawContent,
          contentType: "post",
          speaker: null as string | null,
          contentAngles: s.contentAngle ? [s.contentAngle] : [] as string[],
          recommendedAuthorId: authorId,
          bestFrameworkId: recFramework?.id ?? null,
          source: "google_meet" as const,
          sourceMeetingId: meeting.id,
          sourceMeetingTitle: meeting.title,
          sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
          transcriptId: transcriptRow.id,
          sourceExcerpt: s.sourceExcerpt ?? null,
        };
      });

      const deduped = await deduplicateAgainstExisting(rows);
      if (!deduped.length) continue;
      const inserted = await db.insert(schema.signals).values(deduped).returning();
      const kept = await scoreSignalsOrDelete(inserted.map((r) => r.id));
      totalSignals += kept.length;
    } catch (e) {
      console.error(`[google-sync] Failed to process doc ${meeting.id}:`, e);
    }
  }

  await db.update(schema.authors).set({ googleLastSyncedAt: new Date() }).where(eq(schema.authors.id, authorId));

  if (totalSignals > 0) {
    revalidatePath("/signals");
    revalidatePath("/");
  }

  return NextResponse.json({
    ok: true,
    synced: totalSignals,
    newMeetings: newMeetings.length,
    totalMeetings: meetings.length,
  });
}
