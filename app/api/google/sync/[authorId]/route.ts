import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { getValidGoogleToken, fetchGoogleMeetTranscripts } from "@/lib/google";
import { generatePostsFromTranscript } from "@/lib/claude";

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

  // Deduplicate by Google Doc file ID stored as sourceMeetingId on transcripts
  const fileIds = meetings.map((m) => m.id);
  const existingTranscripts = fileIds.length
    ? await db.select({ sourceMeetingId: schema.transcripts.sourceMeetingId })
        .from(schema.transcripts)
        .where(inArray(schema.transcripts.sourceMeetingId, fileIds))
    : [];
  const existingIds = new Set(existingTranscripts.map((t) => t.sourceMeetingId));

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
      // Store transcript
      const [transcriptRow] = await db.insert(schema.transcripts).values({
        title: meeting.title,
        content: meeting.transcript,
        source: "google_meet",
        sourceMeetingId: meeting.id,
        sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
      }).returning();

      const generated = await generatePostsFromTranscript(meeting.transcript, authorContexts);
      if (!generated.length) continue;

      const rows = generated.map((s) => {
        const recAuthor = s.recommendedAuthorRole
          ? authors.find((a) => a.role?.toLowerCase() === s.recommendedAuthorRole?.toLowerCase())
          : undefined;
        const recFramework = s.frameworkName
          ? allFrameworks.find((f) => f.name.toLowerCase() === s.frameworkName!.toLowerCase())
          : undefined;
        return {
          rawContent: s.rawContent,
          contentType: "post",
          speaker: null as string | null,
          contentAngles: s.contentAngle ? [s.contentAngle] : [] as string[],
          recommendedAuthorId: recAuthor?.id ?? authorId,
          bestFrameworkId: recFramework?.id ?? null,
          source: "google_meet" as const,
          sourceMeetingId: meeting.id,
          sourceMeetingTitle: meeting.title,
          sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
          transcriptId: transcriptRow.id,
          sourceExcerpt: s.sourceExcerpt ?? null,
        };
      });

      const inserted = await db.insert(schema.signals).values(rows).returning();
      totalSignals += inserted.length;
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
