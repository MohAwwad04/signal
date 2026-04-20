import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { FathomCard } from "./fathom-card";
import { ContentAngles } from "./content-angles";

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
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {author.role && <Badge variant="secondary">{author.role}</Badge>}
          {!author.active && <Badge variant="destructive">Inactive</Badge>}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{author.name}</h1>
        {author.bio && <p className="mt-1 text-sm text-muted-foreground">{author.bio}</p>}
      </header>

      <div className="mb-4">
        <Suspense>
          <FathomCard
            authorId={author.id}
            fathomUserEmail={author.fathomUserEmail}
            fathomConnectedAt={author.fathomConnectedAt}
            fathomLastSyncedAt={author.fathomLastSyncedAt}
            isConnected={!!author.fathomAccessToken}
          />
        </Suspense>
      </div>

      <div className="mb-4">
        <Card>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          <CardHeader><CardTitle className="text-base">Style notes (manual)</CardTitle></CardHeader>
          <CardContent>
            {author.styleNotes ? (
              <p className="text-sm">{author.styleNotes}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No manual notes.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-10 mb-3 text-sm font-medium text-muted-foreground">Posts ({posts.length})</h2>
      <div className="grid gap-3">
        {posts.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No posts yet.</div>}
        {posts.map((p) => (
          <Link key={p.id} href={`/posts/${p.id}`} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
            <p className="line-clamp-2 text-sm">{p.content}</p>
            <div className="mt-2 text-[11px] text-muted-foreground">
              <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
              <span className="ml-2">Updated {timeAgo(p.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-medium text-muted-foreground">Recent edits</h2>
      <div className="grid gap-3">
        {recentEdits.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No edits yet.</div>}
        {recentEdits.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{e.editType}</Badge>
                <span>{timeAgo(e.createdAt)}</span>
              </div>
              {e.instruction && <CardDescription className="mt-1">&ldquo;{e.instruction}&rdquo;</CardDescription>}
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">Before</div>
                <p className="line-clamp-6 whitespace-pre-wrap text-xs">{e.before}</p>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">After</div>
                <p className="line-clamp-6 whitespace-pre-wrap text-xs">{e.after}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
