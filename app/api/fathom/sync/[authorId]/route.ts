import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { getValidFathomToken, fetchFathomMeetings } from "@/lib/fathom";
import { generatePostsFromTranscript } from "@/lib/claude";

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
        .where(inArray(schema.signals.sourceMeetingId, meetingIds))
    : [];
  const existingIds = new Set(existing.map((e) => e.sourceMeetingId));

  const newMeetings = meetings.filter(
    (m) => m.id && !existingIds.has(m.id) && m.transcript.length >= 100
  );

  const authors = await db.select().from(schema.authors).where(eq(schema.authors.active, true));
  const roles = authors.map((a) => a.role ?? "").filter(Boolean);
  const allAngles = authors.flatMap((a) => (a.contentAngles as string[] | null) ?? []);
  const voiceProfiles = Object.fromEntries(
    authors.filter((a) => a.role && a.voiceProfile).map((a) => [a.role!, a.voiceProfile!])
  );

  let totalInserted = 0;

  for (const meeting of newMeetings) {
    try {
      const generated = await generatePostsFromTranscript(meeting.transcript, roles, allAngles, voiceProfiles);
      if (!generated.length) continue;

      const recAuthorMatch = (role?: string) =>
        role ? authors.find((a) => a.role?.toLowerCase() === role.toLowerCase()) : undefined;

      const rows = generated.map((s) => ({
        rawContent: s.rawContent,
        contentType: "post",
        speaker: null as string | null,
        contentAngles: [] as string[],
        recommendedAuthorId: recAuthorMatch(s.recommendedAuthorRole)?.id ?? authorId,
        source: "fathom" as const,
        sourceMeetingId: meeting.id,
        sourceMeetingTitle: meeting.title,
        sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
      }));

      const inserted = await db.insert(schema.signals).values(rows).returning();
      totalInserted += inserted.length;
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
