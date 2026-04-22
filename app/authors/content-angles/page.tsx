import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Tag } from "lucide-react";
import { ContentAnglesManager } from "./manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContentAnglesPage() {
  const [allAngles, allAuthors] = await Promise.all([
    db.select().from(schema.contentAngles).orderBy(schema.contentAngles.name),
    db.select({ id: schema.authors.id, name: schema.authors.name }).from(schema.authors).where(eq(schema.authors.active, true)),
  ]);

  // For each angle: which authors have it
  const authorAngleLinks = await db
    .select({
      contentAngleId: schema.authorContentAngles.contentAngleId,
      authorId: schema.authorContentAngles.authorId,
    })
    .from(schema.authorContentAngles);

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
          All named angles in the system. Angles can belong to one or many authors, or exist standalone for future use.
        </p>
      </header>

      <ContentAnglesManager
        angles={anglesWithAuthors}
        authorMap={Object.fromEntries(authorMap)}
        allAuthors={allAuthors}
      />
    </div>
  );
}
