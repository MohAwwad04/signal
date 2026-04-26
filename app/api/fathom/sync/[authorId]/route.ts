import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { eq, inArray, and } from "drizzle-orm";
import { getValidFathomToken, fetchFathomMeetings } from "@/lib/fathom";
import { generatePostsFromTranscript } from "@/lib/claude";
import { ensureTranscript, scoreSignalsOrDelete } from "@/lib/signals-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: { authorId: string } }
) {
  const authorId = Number(params.authorId);
  if (!authorId) {
    return NextResponse.json({ error: "invalid authorId" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getValidFathomToken(authorId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "token error";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const meetings = await fetchFathomMeetings(token, 10);
  if (!meetings.length) {
    return NextResponse.json({ ok: true, synced: 0, meetings: 0 });
  }

  const meetingIds = meetings.map((m) => m.id).filter(Boolean);
  const existing = meetingIds.length
    ? await db
        .select({ sourceMeetingId: schema.signals.sourceMeetingId })
        .from(schema.signals)
        .where(and(
          inArray(schema.signals.sourceMeetingId, meetingIds),
          eq(schema.signals.recommendedAuthorId, authorId),
        ))
    : [];
  const existingIds = new Set(existing.map((e) => e.sourceMeetingId));

  const newMeetings = meetings.filter(
    (m) => m.id && !existingIds.has(m.id) && m.transcript.length >= 100
  );

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

  let totalInserted = 0;

  for (const meeting of newMeetings) {
    try {
      const generated = await generatePostsFromTranscript(meeting.transcript, authorContexts);
      if (!generated.length) continue;

      const transcriptRow = await ensureTranscript({
        title: meeting.title,
        content: meeting.transcript,
        source: "fathom",
        sourceMeetingId: meeting.id,
        sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
      });

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
          source: "fathom" as const,
          sourceMeetingId: meeting.id,
          sourceMeetingTitle: meeting.title,
          sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
          transcriptId: transcriptRow.id,
        };
      });

      const inserted = await db.insert(schema.signals).values(rows).returning();
      const kept = await scoreSignalsOrDelete(inserted.map((r) => r.id));
      totalInserted += kept.length;
    } catch (e: unknown) {
      console.error(`[fathom-sync] Failed to process meeting ${meeting.id}:`, e);
    }
  }

  await db
    .update(schema.authors)
    .set({ fathomLastSyncedAt: new Date() })
    .where(eq(schema.authors.id, authorId));

  if (totalInserted > 0) {
    revalidatePath("/signals");
    revalidatePath("/");
  }

  return NextResponse.json({
    ok: true,
    synced: totalInserted,
    newMeetings: newMeetings.length,
    totalMeetings: meetings.length,
    skippedAlreadyImported: meetings.length - newMeetings.length - meetings.filter((m) => !m.id || m.transcript.length < 100).length,
    skippedNoTranscript: meetings.filter((m) => m.id && m.transcript.length < 100).length,
  });
}
