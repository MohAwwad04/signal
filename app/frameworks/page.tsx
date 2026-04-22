import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { NewFrameworkForm } from "./new-form";
import { FrameworkCard } from "./framework-card";
import { Layers } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FrameworksPage() {
  const frameworks = await db.select().from(schema.frameworks).orderBy(desc(schema.frameworks.createdAt)).catch(() => []);
  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-semibold text-purple-500 uppercase tracking-widest">Frameworks</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Post frameworks</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Post structures the generator can use. Add your own — the prompt template tells Claude how to apply it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          {frameworks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10">
                <Layers className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-sm font-medium">No frameworks yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create one on the right, or seed defaults via the seed script.</p>
            </div>
          )}
          {frameworks.map((f) => (
            <FrameworkCard key={f.id} framework={f} />
          ))}
        </div>

        <aside>
          <NewFrameworkForm />
        </aside>
      </div>
    </div>
  );
}
