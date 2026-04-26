import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { isNotNull, eq, inArray, and } from "drizzle-orm";
import { getValidGoogleToken, fetchGoogleMeetTranscripts } from "@/lib/google";
import { generatePostsFromTranscript } from "@/lib/claude";
import { scoreSignalsOrDelete } from "@/lib/signals-helpers";
import { revalidatePath } from "next/cache";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connectedAuthors = await db
    .select()
    .from(schema.authors)
    .where(isNotNull(schema.authors.googleAccessToken));

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
      const token = await getValidGoogleToken(author.id);
      const meetings = await fetchGoogleMeetTranscripts(token, 10);
      if (!meetings.length) return { authorId: author.id, synced: 0 };

      const fileIds = meetings.map((m) => m.id);
      const existingSignals = fileIds.length
        ? await db.select({ sourceMeetingId: schema.signals.sourceMeetingId })
            .from(schema.signals)
            .where(and(
              inArray(schema.signals.sourceMeetingId, fileIds),
              eq(schema.signals.recommendedAuthorId, author.id),
            ))
        : [];
      const existingIds = new Set(existingSignals.map((s) => s.sourceMeetingId));
      const newMeetings = meetings.filter((m) => !existingIds.has(m.id));

      let synced = 0;
      for (const meeting of newMeetings) {
        try {
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
              source: "google_meet" as const,
              sourceMeetingId: meeting.id,
              sourceMeetingTitle: meeting.title,
              sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
              transcriptId: transcriptRow.id,
              sourceExcerpt: s.sourceExcerpt ?? null,
            };
          });

          const inserted = await db.insert(schema.signals).values(rows).returning();
          const kept = await scoreSignalsOrDelete(inserted.map((r) => r.id));
          synced += kept.length;
        } catch {
          // skip failed meetings
        }
      }

      await db.update(schema.authors).set({ googleLastSyncedAt: new Date() }).where(eq(schema.authors.id, author.id));
      return { authorId: author.id, synced };
    })
  );

  const formatted = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { authorId: -1, synced: 0, error: (r.reason as Error)?.message ?? "sync failed" }
  );

  const totalSynced = formatted.reduce((sum, r) => sum + (r.synced ?? 0), 0);
  if (totalSynced > 0) {
    revalidatePath("/signals");
    revalidatePath("/");
  }

  return NextResponse.json({ ok: true, results: formatted });
}
