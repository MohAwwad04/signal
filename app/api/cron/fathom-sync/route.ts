import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { isNotNull, eq, inArray } from "drizzle-orm";
import { getValidFathomToken, fetchFathomMeetings } from "@/lib/fathom";
import { generatePostsFromTranscript } from "@/lib/claude";

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

  const allAuthors = await db.select().from(schema.authors).where(eq(schema.authors.active, true));
  const roles = allAuthors.map((a) => a.role ?? "").filter(Boolean);
  const allAngles = allAuthors.flatMap((a) => (a.contentAngles as string[] | null) ?? []);

  const results: { authorId: number; synced: number; error?: string }[] = [];

  for (const author of connectedAuthors) {
    try {
      const token = await getValidFathomToken(author.id);
      const meetings = await fetchFathomMeetings(token, 10);

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

      let synced = 0;
      for (const meeting of newMeetings) {
        try {
          const generated = await generatePostsFromTranscript(meeting.transcript, roles, allAngles);
          if (!generated.length) continue;
          const rows = generated.map((s) => ({
            rawContent: s.rawContent,
            contentType: "post",
            speaker: null as string | null,
            contentAngles: [] as string[],
            recommendedAuthorId:
              s.recommendedAuthorRole
                ? allAuthors.find((a) => a.role?.toLowerCase() === s.recommendedAuthorRole?.toLowerCase())?.id ?? author.id
                : author.id,
            source: "fathom" as const,
            sourceMeetingId: meeting.id,
            sourceMeetingTitle: meeting.title,
            sourceMeetingDate: meeting.date ? new Date(meeting.date) : null,
          }));
          const inserted = await db.insert(schema.signals).values(rows).returning();
          synced += inserted.length;
        } catch {
          // skip failed meetings
        }
      }

      await db
        .update(schema.authors)
        .set({ fathomLastSyncedAt: new Date() })
        .where(eq(schema.authors.id, author.id));

      results.push({ authorId: author.id, synced });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "sync failed";
      results.push({ authorId: author.id, synced: 0, error: msg });
    }
  }

  return NextResponse.json({ ok: true, results });
}
