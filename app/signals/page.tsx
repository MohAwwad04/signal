import Link from "next/link";
import { Suspense } from "react";
import { db, schema } from "@/lib/db";
import { desc, ne, eq, and, ilike, gte, lte, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { Plus, User, Archive, Radio, ArrowUpRight } from "lucide-react";
import { SignalFilterBar } from "./filter-bar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: { q?: string; author?: string; angle?: string; from?: string; to?: string };
}) {
  const { q, author, angle, from, to } = searchParams;

  const conditions: any[] = [ne(schema.signals.status, "archived")];
  if (q) conditions.push(ilike(schema.signals.rawContent, `%${q}%`));
  if (author) conditions.push(eq(schema.signals.recommendedAuthorId, Number(author)));
  if (from) conditions.push(gte(schema.signals.createdAt, new Date(from)));
  if (to) conditions.push(lte(schema.signals.createdAt, new Date(to + "T23:59:59")));
  if (angle) conditions.push(sql`${schema.signals.contentAngles} @> ${JSON.stringify([angle])}::jsonb`);

  const [signals, authors, allAngles, archivedCount] = await Promise.all([
    db.select().from(schema.signals).where(and(...conditions)).orderBy(desc(schema.signals.createdAt)),
    db.select({ id: schema.authors.id, name: schema.authors.name }).from(schema.authors).where(eq(schema.authors.active, true)),
    db.select({ id: schema.contentAngles.id, name: schema.contentAngles.name }).from(schema.contentAngles).orderBy(schema.contentAngles.name),
    db.select({ id: schema.signals.id }).from(schema.signals).where(eq(schema.signals.status, "archived")).then((r) => r.length),
  ]);

  const authorMap = new Map(authors.map((a) => [a.id, a.name]));
  const isFiltered = !!(q || author || angle || from || to);

  return (
    <div className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">Signals</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Captured signals</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            LinkedIn posts generated from your meetings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/signals/archive">
            <Button variant="outline" size="sm">
              <Archive className="h-4 w-4" />
              Archive
              {archivedCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  {archivedCount}
                </span>
              )}
            </Button>
          </Link>
          <Link href="/signals/new">
            <Button>
              <Plus className="h-4 w-4" />
              New from transcript
            </Button>
          </Link>
        </div>
      </header>

      <Suspense fallback={null}>
        <SignalFilterBar authors={authors} angles={allAngles} />
      </Suspense>

      {signals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
            <Radio className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-sm font-medium">{isFiltered ? "No signals match your filters" : "No signals yet"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isFiltered ? "Try adjusting or clearing your filters." : "Paste a transcript to extract content ideas."}
          </p>
          {!isFiltered && (
            <div className="mt-5">
              <Link href="/signals/new">
                <Button size="sm">Paste a transcript</Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-2.5">
          {signals.map((s) => {
            const authorName = s.recommendedAuthorId ? authorMap.get(s.recommendedAuthorId) : null;
            const firstLine = s.rawContent.split("\n").find((l) => l.trim()) ?? s.rawContent;
            const taggedAngles = (s.contentAngles as string[] | null) ?? [];
            return (
              <Link
                key={s.id}
                href={`/signals/${s.id}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{firstLine}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant={s.status === "unused" ? "warning" : s.status === "used" ? "success" : "secondary"}>
                      {s.status}
                    </Badge>
                    {authorName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {authorName}
                      </span>
                    )}
                    {taggedAngles.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-purple-500/8 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                        {tag}
                      </span>
                    ))}
                    {s.sourceMeetingTitle && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{s.sourceMeetingTitle}</span>
                      </>
                    )}
                    <span className="text-muted-foreground/40">·</span>
                    <span>{timeAgo(s.createdAt)}</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
