import { NextResponse, type NextRequest } from "next/server";
import { extractSignalsAction } from "@/lib/actions";

/**
 * Fathom webhook handler.
 *
 * Configure in Fathom to POST meeting-ended events here. The handler accepts
 * a few common shapes so you can wire this up fast:
 *   { transcript: string, title?: string, started_at?: string }
 *   { meeting: { transcript, title, started_at } }
 *   { transcript_text: string, ... }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FATHOM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  const provided = req.headers.get("x-webhook-secret");
  if (provided !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload = body?.meeting ?? body ?? {};
  const transcript: string = payload.transcript ?? payload.transcript_text ?? payload.text ?? "";
  const title: string | undefined = payload.title ?? payload.meeting_title;
  const startedAt: string | undefined = payload.started_at ?? payload.start_time ?? payload.date;

  if (!transcript || transcript.length < 100) {
    return NextResponse.json({ error: "transcript missing or too short" }, { status: 400 });
  }

  try {
    const { inserted } = await extractSignalsAction(transcript, title, startedAt);
    return NextResponse.json({ ok: true, inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "extraction failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST a Fathom meeting payload here." });
}
