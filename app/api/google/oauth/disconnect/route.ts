import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const authorId = Number(body.authorId);
  if (!authorId) return NextResponse.json({ error: "authorId required" }, { status: 400 });

  await db.update(schema.authors).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiresAt: null,
    googleUserEmail: null,
    googleConnectedAt: null,
    googleLastSyncedAt: null,
  }).where(eq(schema.authors.id, authorId));

  return NextResponse.json({ ok: true });
}
