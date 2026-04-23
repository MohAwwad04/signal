import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, lt, and } from "drizzle-orm";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(schema.signals)
    .where(and(eq(schema.signals.status, "archived"), lt(schema.signals.archivedAt, cutoff)))
    .returning({ id: schema.signals.id });

  return NextResponse.json({ ok: true, deleted: deleted.length });
}
