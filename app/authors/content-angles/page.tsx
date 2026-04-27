import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Tag } from "lucide-react";
import { ContentAnglesManager } from "./manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContentAnglesPage() {
  const allAuthors = await db
    .select({ id: schema.authors.id, name: schema.authors.name, contentAngles: schema.authors.contentAngles })
    .from(schema.authors)
    .where(eq(schema.authors.active, true));

  // Silently migrate any angle names from authors' jsonb that aren't yet in the global table
  const allJsonbAngles = allAuthors.flatMap((a) => (a.contentAngles as string[] | null) ?? []);
  const uniqueJsonbNames = [...new Set(allJsonbAngles.map((n) => n.trim()).filter(Boolean))];

  if (uniqueJsonbNames.length > 0) {
    for (const name of uniqueJsonbNames) {
      const existing = await db.select({ id: schema.contentAngles.id }).from(schema.contentAngles).where(eq(schema.contentAngles.name, name)).limit(1);
      let angleId: number;
      if (existing[0]) {
        angleId = existing[0].id;
      } else {
        const [created] = await db.insert(schema.contentAngles).values({ name }).returning();
        angleId = created.id;
      }
      // Ensure each author that has this name in their jsonb is linked in the join table
      for (const author of allAuthors) {
        const angles = (author.contentAngles as string[] | null) ?? [];
        if (angles.includes(name)) {
          await db
            .insert(schema.authorContentAngles)
            .values({ authorId: author.id, contentAngleId: angleId })
            .onConflictDoNothing();
        }
      }
    }
  }

  // Now load the canonical data
  const [allAngles, authorAngleLinks] = await Promise.all([
    db.select().from(schema.contentAngles).orderBy(schema.contentAngles.name),
    db.select({ contentAngleId: schema.authorContentAngles.contentAngleId, authorId: schema.authorContentAngles.authorId }).from(schema.authorContentAngles),
  ]);

  const authorMap = new Map(allAuthors.map((a) => [a.id, a.name]));
  const anglesWithAuthors = allAngles.map((angle) => ({
    ...angle,
    authorIds: authorAngleLinks.filter((l) => l.contentAngleId === angle.id).map((l) => l.authorId),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="mb-6">
        <Link href="/authors">
          <Button variant="ghost" size="sm" className="pl-1">
            <ArrowLeft className="h-4 w-4" />
            Back to authors
          </Button>
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-semibold text-purple-500 uppercase tracking-widest">Content angles</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Global content angles</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every named angle in the system — from all authors and standalone. Angles without an author can be assigned later.
        </p>
      </header>

      <ContentAnglesManager
        angles={anglesWithAuthors}
        authorMap={Object.fromEntries(authorMap)}
        allAuthors={allAuthors.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
