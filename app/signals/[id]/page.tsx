import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { PostEditor } from "./post-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignalDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [signal] = await db.select().from(schema.signals).where(eq(schema.signals.id, id));
  if (!signal) notFound();

  const author = signal.recommendedAuthorId
    ? (await db.select().from(schema.authors).where(eq(schema.authors.id, signal.recommendedAuthorId)))[0]
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/signals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Signals
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={signal.status === "unused" ? "warning" : signal.status === "used" ? "success" : "secondary"}>
          {signal.status}
        </Badge>
        {signal.sourceMeetingTitle && <span>· {signal.sourceMeetingTitle}</span>}
        {signal.sourceMeetingDate && <span>· {signal.sourceMeetingDate.toLocaleDateString()}</span>}
        <span>· {timeAgo(signal.createdAt)}</span>
      </div>

      <PostEditor
        signalId={signal.id}
        initialContent={signal.rawContent}
        authorName={author?.name ?? null}
      />

      {signal.notes && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Note: </span>{signal.notes}
        </div>
      )}
    </div>
  );
}
