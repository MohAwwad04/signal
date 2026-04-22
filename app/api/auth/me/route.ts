import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ name: null });

  // Superadmin / env admins: look up by author email if they have one
  if (session.authorId) {
    const [author] = await db.select({ name: schema.authors.name }).from(schema.authors).where(eq(schema.authors.id, session.authorId)).limit(1).catch(() => []);
    if (author?.name) return NextResponse.json({ name: author.name });
  }

  // Fall back to email
  return NextResponse.json({ name: session.email });
}
