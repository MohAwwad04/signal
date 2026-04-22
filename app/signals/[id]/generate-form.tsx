"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { generatePostAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Loader2, Sparkles, Star } from "lucide-react";

type Author = { id: number; name: string; role: string | null };
type Framework = { id: number; name: string; description: string; bestFor: string[] };

export function SignalGenerateForm({
  signalId,
  contentAngles,
  recommendedAuthorId,
  authors,
  frameworks,
  contentType,
  bestFrameworkId,
}: {
  signalId: number;
  contentAngles: string[];
  recommendedAuthorId: number | null;
  authors: Author[];
  frameworks: Framework[];
  contentType: string;
  bestFrameworkId?: number | null;
}) {
  const router = useRouter();
  const [authorId, setAuthorId] = useState<number | null>(recommendedAuthorId ?? authors[0]?.id ?? null);
  const [angle, setAngle] = useState<string>(contentAngles[0] ?? "");
  const [customAngle, setCustomAngle] = useState("");

  const defaultFrameworkId = useMemo(() => {
    if (bestFrameworkId) return bestFrameworkId;
    return frameworks.find((f) => f.bestFor?.includes(contentType))?.id ?? frameworks[0]?.id ?? null;
  }, [frameworks, contentType, bestFrameworkId]);

  const [frameworkId, setFrameworkId] = useState<number | null>(defaultFrameworkId);
  const [loading, setLoading] = useState(false);

  async function onGenerate() {
    if (!authorId || !frameworkId) {
      toast({ title: "Pick an author and a framework first.", kind: "error" });
      return;
    }
    const finalAngle = (customAngle.trim() || angle || "").trim();
    if (!finalAngle) {
      toast({ title: "Pick or write a content angle.", kind: "error" });
      return;
    }
    setLoading(true);
    try {
      const post = await generatePostAction({
        signalId,
        authorId,
        frameworkId,
        contentAngle: finalAngle,
      });
      router.push(`/posts/${post.id}`);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  const isRecommendedByType = (f: Framework) => f.bestFor?.includes(contentType);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-semibold">Generate a post</span>
      </div>

      {/* Author */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Author</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {authors.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAuthorId(a.id)}
              className={
                "rounded-md border px-3 py-2 text-left text-sm transition-colors " +
                (authorId === a.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border hover:border-primary/40")
              }
            >
              <div className="font-medium">{a.name}</div>
              {a.role && <div className="text-[11px] text-muted-foreground">{a.role}</div>}
              {recommendedAuthorId === a.id && (
                <Badge variant="default" className="mt-1 text-[10px]">Recommended</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Framework */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Framework</Label>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {frameworks.map((f) => {
            const isStarred = bestFrameworkId === f.id;
            const isRecByType = isRecommendedByType(f);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFrameworkId(f.id)}
                className={
                  "rounded-md border p-3 text-left transition-colors " +
                  (frameworkId === f.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="flex items-center gap-1">
                    {isStarred && (
                      <span title="Best framework for this signal" className="flex items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        Best
                      </span>
                    )}
                    {isRecByType && !isStarred && <Badge variant="default" className="text-[10px]">Suggested</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content angle */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content angle</Label>
        {contentAngles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {contentAngles.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => { setAngle(a); setCustomAngle(""); }}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (angle === a && !customAngle
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-primary/40")
                }
              >
                {a}
              </button>
            ))}
          </div>
        )}
        <Textarea
          value={customAngle}
          onChange={(e) => setCustomAngle(e.target.value)}
          placeholder="Or write your own angle…"
          className="mt-2"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Generate post
        </Button>
      </div>
    </div>
  );
}
