import Link from "next/link";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, ArrowUpRight, Tag } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthorsPage() {
  const authors = await db.select().from(schema.authors).orderBy(desc(schema.authors.createdAt)).catch(() => []);
  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-cyan-500" />
            <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Authors</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Authors</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            People we write in the voice of. Voice profiles learn from edits automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/authors/content-angles">
            <Button variant="outline">
              <Tag className="h-4 w-4" />
              Content angles
            </Button>
          </Link>
          <Link href="/authors/new">
            <Button>
              <Plus className="h-4 w-4" />
              New author
            </Button>
          </Link>
        </div>
      </header>

      {authors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10">
            <Users className="h-5 w-5 text-cyan-500" />
          </div>
          <p className="text-sm font-medium">No authors yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add one to start generating posts in their voice.</p>
          <div className="mt-5">
            <Link href="/authors/new"><Button size="sm">Add author</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {authors.map((a) => {
            const angles = (a.contentAngles as string[] | null) ?? [];
            return (
              <Link
                key={a.id}
                href={`/authors/${a.id}`}
                className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-cyan-400/30 hover:shadow-glow-sm hover:-translate-y-0.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{a.name}</span>
                    {!a.active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {a.role && <p className="text-xs text-muted-foreground mb-2">{a.role}</p>}
                  {angles.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {angles.slice(0, 3).map((angle) => (
                        <span key={angle} className="rounded-full bg-purple-500/8 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                          {angle}
                        </span>
                      ))}
                      {angles.length > 3 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{angles.length - 3}</span>
                      )}
                    </div>
                  )}
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {a.voiceProfile ? a.voiceProfile.slice(0, 220) : (a.bio ?? "No voice profile yet — it'll build up from edits.")}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-cyan-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
