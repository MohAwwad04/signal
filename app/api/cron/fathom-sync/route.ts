import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { isNotNull, eq, inArray, and } from "drizzle-orm";
import { getValidFathomToken, fetchFathomMeetings } from "@/lib/fathom";
import { generatePostsFromTranscript } from "@/lib/claude";
import { ensureTranscript, scoreSignalsOrDelete } from "@/lib/signals-helpers";

export const maxDuration = 300; // 5 min for Vercel Pro

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connectedAuthors = await db
    .select()
    .from(schema.authors)
    .where(isNotNull(schema.authors.fathomAccessToken));

  const [allAuthors, allFrameworks] = await Promise.all([
    db.select().from(schema.authors).where(eq(schema.authors.active, true)),
    db.select().from(schema.frameworks),
  ]);
  const authorContexts = allAuthors.map((a) => ({
    role: a.role ?? "",
    contentAngles: (a.contentAngles as string[] | null) ?? [],
    preferredFrameworkNames: (a.preferredFrameworks as number[] | null ?? [])
      .map((fid) => allFrameworks.find((f) => f.id === fid)?.name)
      .filter((n): n is string => Boolean(n)),
    voiceProfile: a.voiceProfile ?? undefined,
  }));

  const results = await Promise.allSettled(
    connectedAuthors.map(async (author) => {
      const token = await getValidFathomToken(author.id);
      const meetings = await fetchFathomMeetings(token, 10);

      const meetingIds = meetings.map((m) => m.id).filter(Boolean);
      const existing = meetingIds.length
        ? await db
            .select({ sourceMeetingId: schema.signals.sourceMeetingId })
            .from(schema.signals)
            .where(and(
              inArray(schema.signals.sourceMeetingId, meetingIds),
              eq(schema.signals.recommendedAuthorId, author.id),
            ))
        : [];
      const existingIds = new Set(existing.map((e) => e.sourceMeetingId));

      const newMeetings = meetings.filter(
        (m) => m.id && !existingIds.has(m.id) && m.transcript.length >= 100
      );

      const meetingResults = await Promise.allSettled(
        newMeetings.map(async (meeting) => {
          const generated = await generatePostsFromTranscript(meeting.transcript, authorContexts);
          if (!generated.length) return 0;
          const transcriptRow = await ensureTranscript({
            title: meeting.title,
            content: meeting.transcript,
            source: "fathom",
            sourceMeetingId: meeting.id,
            sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
          });
          const rows = generated.map((s) => {
            const recAuthor = s.recommendedAuthorRole
              ? allAuthors.find((a) => a.role?.toLowerCase() === s.recommendedAuthorRole?.toLowerCase())
              : undefined;
            const recFramework = s.frameworkName
              ? allFrameworks.find((f) => f.name.toLowerCase() === s.frameworkName!.toLowerCase())
              : undefined;
            return {
              rawContent: s.rawContent,
              contentType: "post",
              speaker: null as string | null,
              contentAngles: s.contentAngle ? [s.contentAngle] : [] as string[],
              recommendedAuthorId: recAuthor?.id ?? author.id,
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
          return kept.length;
        })
      );

      const synced = meetingResults.reduce(
        (sum, r) => sum + (r.status === "fulfilled" ? r.value : 0), 0
      );

      await db
        .update(schema.authors)
        .set({ fathomLastSyncedAt: new Date() })
        .where(eq(schema.authors.id, author.id));

      return { authorId: author.id, synced };
    })
  );

  const formatted = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { authorId: -1, synced: 0, error: (r.reason as Error)?.message ?? "sync failed" }
  );

  return NextResponse.json({ ok: true, results: formatted });
}
