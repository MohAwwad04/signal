import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Archive } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { ArchiveActions } from "./archive-actions";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ArchivePage() {
  const session = await getCurrentUser();
  if (!session?.isAdmin && !session?.isSuperAdmin) redirect("/drafts");
  const archiveFilter = session?.isSuperAdmin
    ? eq(schema.signals.status, "archived")
    : and(eq(schema.signals.status, "archived"), session?.authorId
        ? eq(schema.signals.recommendedAuthorId, session.authorId)
        : eq(schema.signals.id, -1));

  const [archived, authors] = await Promise.all([
    db.select().from(schema.signals).where(archiveFilter).orderBy(desc(schema.signals.archivedAt)),
    db.select({ id: schema.authors.id, name: schema.authors.name }).from(schema.authors),
  ]);

  const authorMap = new Map(authors.map((a) => [a.id, a.name]));

  return (
    <div className="mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="mb-6">
        <Link href="/signals">
          <Button variant="ghost" size="sm" className="pl-1">
            <ArrowLeft className="h-4 w-4" />
            Back to signals
          </Button>
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Archive</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Archived signals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Archived signals are permanently deleted after 7 days.
        </p>
      </header>

      {archived.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Archive className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Archive is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">Archived signals will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {archived.map((s) => {
            const authorName = s.recommendedAuthorId ? authorMap.get(s.recommendedAuthorId) : null;
            const firstLine = s.rawContent.split("\n").find((l) => l.trim()) ?? s.rawContent;
            const hashtags = Array.from(new Set(s.rawContent.match(/#[\w\u0080-\uFFFF]+/g) ?? [])).slice(0, 4);
            const expiresSoon = s.archivedAt && s.archivedAt < new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
            const daysLeft = s.archivedAt
              ? Math.max(0, Math.ceil((s.archivedAt.getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)))
              : 7;

            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-muted-foreground">{firstLine}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {authorName && <span>{authorName}</span>}
                  {hashtags.map((tag) => (
                    <span key={tag} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/70">
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto">Archived {s.archivedAt ? timeAgo(s.archivedAt) : ""}</span>
                  {expiresSoon ? (
                    <Badge variant="destructive">Deletes in {daysLeft}d</Badge>
                  ) : (
                    <span className="text-muted-foreground/60">Deletes in {daysLeft}d</span>
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  <ArchiveActions signalId={s.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
