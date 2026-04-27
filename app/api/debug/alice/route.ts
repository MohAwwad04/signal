import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await db.select().from(schema.users).where(eq(schema.users.email, "alice.morgan@signal.app")).limit(1);
  const user = users[0];
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const authors = await db.select().from(schema.authors).where(eq(schema.authors.id, user.authorId!)).limit(1);
  const author = authors[0];
  if (!author) return NextResponse.json({ error: "author not found" }, { status: 404 });

  return NextResponse.json({
    authorId: author.id,
    contentAngles: author.contentAngles,
    hasVoiceProfile: !!author.voiceProfile,
    hasStyleNotes: !!author.styleNotes,
    voiceProfileSnippet: author.voiceProfile?.slice(0, 80) ?? null,
  });
}
