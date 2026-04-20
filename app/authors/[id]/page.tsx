import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { FathomCard } from "./fathom-card";
import { LinkedInCard } from "./linkedin-card";
import { ContentAngles } from "./content-angles";
import { ArrowUpRight, User } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AuthorDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [author] = await db.select().from(schema.authors).where(eq(schema.authors.id, id));
  if (!author) notFound();
  console.log(`[author/${id}] fathomAccessToken present:`, !!author.fathomAccessToken, "email:", author.fathomUserEmail, "connectedAt:", author.fathomConnectedAt);
  const posts = await db.select().from(schema.posts).where(eq(schema.posts.authorId, id)).orderBy(desc(schema.posts.updatedAt));
  const recentEdits = await db.select().from(schema.edits).where(eq(schema.edits.authorId, id)).orderBy(desc(schema.edits.createdAt)).limit(5);

  return (
    <div className="mx-auto w-full max-w-4xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-cyan-500" />
          <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Author</span>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold tracking-tight">{author.name}</h1>
          {author.role && <Badge variant="secondary">{author.role}</Badge>}
          {!author.active && <Badge variant="destructive">Inactive</Badge>}
        </div>
        {author.bio && <p className="mt-1 text-sm text-muted-foreground">{author.bio}</p>}
      </header>

      <div className="space-y-4 mb-8">
        <Suspense>
          <FathomCard
            authorId={author.id}
            fathomUserEmail={author.fathomUserEmail}
            fathomConnectedAt={author.fathomConnectedAt}
            fathomLastSyncedAt={author.fathomLastSyncedAt}
            isConnected={!!author.fathomAccessToken}
          />
        </Suspense>
        <Suspense>
          <LinkedInCard
            authorId={author.id}
            linkedinMemberName={author.linkedinMemberName}
            linkedinConnectedAt={author.linkedinConnectedAt}
            linkedinLastSyncedAt={author.linkedinLastSyncedAt}
            isConnected={!!author.linkedinAccessToken}
          />
        </Suspense>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Content angles</CardTitle>
          <CardDescription>Topics this author focuses on. Used to guide post generation from transcripts.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContentAngles
            authorId={author.id}
            initialAngles={(author.contentAngles as string[] | null) ?? []}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice profile</CardTitle>
            <CardDescription>Built automatically from the edits you make.</CardDescription>
          </CardHeader>
          <CardContent>
            {author.voiceProfile ? (
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{author.voiceProfile}</pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">No voice profile yet. Make ~2 edits and one will appear here.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Style notes <span className="font-normal text-muted-foreground">(manual)</span></CardTitle>
          </CardHeader>
          <CardContent>
            {author.styleNotes ? (
              <p className="text-sm">{author.styleNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No manual notes.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Posts ({posts.length})</h2>
      </div>
      <div className="grid gap-2.5 mb-10">
        {posts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No posts yet.
          </div>
        )}
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/posts/${p.id}`}
            className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm">{p.content}</p>
              <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
                <span className="text-muted-foreground">Updated {timeAgo(p.updatedAt)}</span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent edits</h2>
      </div>
      <div className="grid gap-3">
        {recentEdits.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No edits yet.
          </div>
        )}
        {recentEdits.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-border/50">
              <Badge variant="secondary">{e.editType}</Badge>
              <span className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
              {e.instruction && <span className="text-xs text-muted-foreground ml-1 line-clamp-1">&ldquo;{e.instruction}&rdquo;</span>}
            </div>
            <div className="grid md:grid-cols-2 gap-0">
              <div className="p-4 border-r border-border/50">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Before</div>
                <p className="line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">{e.before}</p>
              </div>
              <div className="p-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">After</div>
                <p className="line-clamp-6 whitespace-pre-wrap text-xs">{e.after}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
