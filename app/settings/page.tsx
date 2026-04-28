import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { FathomCard } from "@/app/authors/[id]/fathom-card";
import { LinkedInCard } from "@/app/authors/[id]/linkedin-card";
import { GoogleDriveCard } from "@/app/authors/[id]/google-drive-card";
import { LinkedinUrlEditor } from "@/app/authors/[id]/linkedin-url-editor";
import { ContentAngles } from "@/app/authors/[id]/content-angles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const session = await getCurrentUser();
  if (!session) notFound();

  if (!session.authorId) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="h-4 w-4 text-cyan-500" />
            <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Settings</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">My Settings</h1>
        </header>
        <p className="text-sm text-muted-foreground">
          Your account is not linked to an author profile. To connect integrations, go to{" "}
          <a href="/authors" className="underline text-foreground">Authors</a> and manage connections from there.
        </p>
      </div>
    );
  }

  const [author, allGlobalAngles, allFrameworks] = await Promise.all([
    db.select().from(schema.authors).where(eq(schema.authors.id, session.authorId)).then((r) => r[0]),
    db.select({ id: schema.contentAngles.id, name: schema.contentAngles.name }).from(schema.contentAngles).orderBy(schema.contentAngles.name),
    db.select({ id: schema.frameworks.id, name: schema.frameworks.name }).from(schema.frameworks),
  ]);

  if (!author) notFound();

  const preferredFrameworkIds = (author.preferredFrameworks as number[] | null) ?? [];
  const preferredFrameworks = preferredFrameworkIds
    .map((id) => allFrameworks.find((f) => f.id === id))
    .filter((f): f is { id: number; name: string } => f !== undefined);

  return (
    <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-4 w-4 text-cyan-500" />
          <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Settings</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{author.name}</h1>
        {author.bio && <p className="mt-1 text-sm text-muted-foreground">{author.bio}</p>}
        <div className="mt-2">
          <LinkedinUrlEditor authorId={author.id} initialUrl={author.linkedinUrl ?? null} />
        </div>
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
            linkedinUrl={author.linkedinUrl ?? null}
          />
        </Suspense>
        <Suspense>
          <GoogleDriveCard
            authorId={author.id}
            googleUserEmail={author.googleUserEmail ?? null}
            googleConnectedAt={author.googleConnectedAt ?? null}
            googleLastSyncedAt={author.googleLastSyncedAt ?? null}
            isConnected={!!author.googleAccessToken}
          />
        </Suspense>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content angles</CardTitle>
            <CardDescription>Topics you focus on. Used to guide post generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContentAngles
              authorId={author.id}
              initialAngles={(author.contentAngles as string[] | null) ?? []}
              allGlobalAngles={allGlobalAngles}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferred frameworks</CardTitle>
            <CardDescription>Post structures that match your natural writing style.</CardDescription>
          </CardHeader>
          <CardContent>
            {preferredFrameworks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {preferredFrameworks.map((f) => (
                  <Badge key={f.id} variant="secondary">{f.name}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No preferred frameworks yet. Run "Auto-fill from LinkedIn" to detect them automatically.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice profile</CardTitle>
            <CardDescription>How the AI writes in your voice. Built from your edits and LinkedIn posts.</CardDescription>
          </CardHeader>
          <CardContent>
            {author.voiceProfile ? (
              <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{author.voiceProfile}</pre>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No voice profile yet. Make a few edits or run "Auto-fill from LinkedIn" to build one.
              </p>
            )}
          </CardContent>
        </Card>

        {author.styleNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Style notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{author.styleNotes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
