import Link from "next/link";
import { db, schema } from "@/lib/db";
import { desc, ne } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { Plus, User } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignalsPage() {
  const [signals, authors] = await Promise.all([
    db.select().from(schema.signals).where(ne(schema.signals.status, "archived")).orderBy(desc(schema.signals.createdAt)),
    db.select({ id: schema.authors.id, name: schema.authors.name }).from(schema.authors),
  ]);
  const authorMap = new Map(authors.map((a) => [a.id, a.name]));

  return (
    <div className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Signals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            LinkedIn posts generated from your meetings.
          </p>
        </div>
        <Link href="/signals/new">
          <Button>
            <Plus className="h-4 w-4" />
            New from transcript
          </Button>
        </Link>
      </header>

      {signals.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No signals yet.</p>
          <div className="mt-4">
            <Link href="/signals/new"><Button size="sm">Paste a transcript</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {signals.map((s) => {
            const authorName = s.recommendedAuthorId ? authorMap.get(s.recommendedAuthorId) : null;
            const firstLine = s.rawContent.split("\n").find((l) => l.trim()) ?? s.rawContent;
            const hashtags = Array.from(new Set(s.rawContent.match(/#[\w\u0080-\uFFFF]+/g) ?? [])).slice(0, 5);
            return (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <p className="line-clamp-2 text-sm font-medium leading-snug">{firstLine}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant={s.status === "unused" ? "warning" : s.status === "used" ? "success" : "secondary"}>
                    {s.status}
                  </Badge>
                  {authorName && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {authorName}
                    </span>
                  )}
                  {hashtags.map((tag) => (
                    <span key={tag} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary/70">
                      {tag}
                    </span>
                  ))}
                  {s.sourceMeetingTitle && <span className="ml-auto">· {s.sourceMeetingTitle}</span>}
                  <span>· {timeAgo(s.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
