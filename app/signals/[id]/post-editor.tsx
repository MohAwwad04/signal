"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  updateSignalContentAction,
  archiveSignalAction,
  applyFrameworkToSignalAction,
  updateSignalBestFrameworkAction,
  scoreSignalAction,
  generatePostAction,
  updatePostContentAction,
} from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Edit2, Check, X, Copy, Trash2, Sparkles, Loader2, Star, ArrowUpRight, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useScores } from "./scores-provider";

type Framework = { id: number; name: string; description: string };

export function PostEditor({
  signalId,
  initialContent,
  authorName,
  authorId,
  frameworks = [],
  bestFrameworkId,
  contentAngles = [],
}: {
  signalId: number;
  initialContent: string;
  authorName?: string | null;
  authorId?: number | null;
  frameworks?: Framework[];
  bestFrameworkId?: number | null;
  contentAngles?: string[];
}) {
  const router = useRouter();
  const { setScores } = useScores();

  // ── signal edit state ──
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  // ── framework state ──
  const [activeFrameworkId, setActiveFrameworkId] = useState<number | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [localBestId, setLocalBestId] = useState<number | null>(bestFrameworkId ?? null);
  const [starringId, setStarringId] = useState<number | null>(null);

  // ── content angle state ──
  const [angle, setAngle] = useState<string>(contentAngles[0] ?? "");
  const [customAngle, setCustomAngle] = useState("");

  // ── generate / result state ──
  const [generating, setGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<{ id: number; content: string } | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  const mode: "signal" | "generated" = generatedPost ? "generated" : "signal";

  // ── signal actions ──
  async function save() {
    setSaving(true);
    try {
      await updateSignalContentAction(signalId, draft);
      setContent(draft);
      setEditing(false);
      toast({ title: "Saved ✓", kind: "success" });
      scoreSignalAction(signalId).then((s) => {
        setScores({ hookStrength: s.hookStrength, specificity: s.specificity, clarity: s.clarity, emotionalResonance: s.emotionalResonance, callToAction: s.callToAction });
      }).catch(() => {});
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  function cancel() { setDraft(content); setEditing(false); }

  async function copy() {
    const text = mode === "generated" ? generatedDraft : (editing ? draft : content);
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", kind: "success" });
  }

  async function archive() {
    await archiveSignalAction(signalId);
    router.push("/signals");
  }

  // ── framework actions ──
  async function applyFramework(fw: Framework) {
    if (applyingId) return;
    if (activeFrameworkId === fw.id) { setDraft(content); setActiveFrameworkId(null); return; }
    setApplyingId(fw.id);
    try {
      const reformatted = await applyFrameworkToSignalAction(content, fw.id);
      setDraft(reformatted);
      setActiveFrameworkId(fw.id);
      setEditing(true);
    } catch (e: any) {
      toast({ title: "Failed to apply framework", description: e.message, kind: "error" });
    } finally {
      setApplyingId(null);
    }
  }

  async function toggleStar(fw: Framework) {
    if (starringId) return;
    setStarringId(fw.id);
    const newBest = localBestId === fw.id ? null : fw.id;
    try {
      await updateSignalBestFrameworkAction(signalId, newBest);
      setLocalBestId(newBest);
      toast({ title: newBest ? `"${fw.name}" starred as best` : "Star removed", kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, kind: "error" });
    } finally {
      setStarringId(null);
    }
  }

  // ── generate ──
  async function generate() {
    if (!authorId) { toast({ title: "Assign an author first", kind: "error" }); return; }
    const finalAngle = (customAngle.trim() || angle || "").trim();
    if (!finalAngle) { toast({ title: "Pick or write a content angle", kind: "error" }); return; }
    setGenerating(true);
    try {
      const post = await generatePostAction({
        signalId,
        authorId,
        frameworkId: localBestId ?? frameworks[0]?.id ?? null,
        contentAngle: finalAngle,
      });
      setGeneratedPost({ id: post.id, content: post.content });
      setGeneratedDraft(post.content);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  // ── save edits to generated post ──
  async function saveGeneratedEdits() {
    if (!generatedPost) return;
    setSavingPost(true);
    try {
      await updatePostContentAction(generatedPost.id, generatedDraft);
      setGeneratedPost((p) => p ? { ...p, content: generatedDraft } : p);
      toast({ title: "Post updated ✓", kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, kind: "error" });
    } finally {
      setSavingPost(false);
    }
  }

  const initials = authorName
    ? authorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const postEdited = mode === "generated" && generatedPost && generatedDraft !== generatedPost.content;

  return (
    <div className="space-y-3">
      {/* ── Main card ── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* LinkedIn-style header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </div>
          <div>
            <div className="text-sm font-semibold">{authorName ?? "Unassigned"}</div>
            <div className="text-xs text-muted-foreground">
              {mode === "generated" ? "Generated post · LinkedIn" : "LinkedIn · Signal"}
            </div>
          </div>
          {mode === "generated" && (
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Generated
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-5 pb-4">
          {mode === "generated" ? (
            <Textarea
              value={generatedDraft}
              onChange={(e) => setGeneratedDraft(e.target.value)}
              className="min-h-[320px] resize-y font-[inherit] text-sm leading-relaxed"
            />
          ) : editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[320px] resize-y font-[inherit] text-sm leading-relaxed"
              autoFocus
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{content}</p>
          )}
        </div>

        <div className="mx-5 border-t border-border" />

        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex gap-2">
            {mode === "generated" ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => { setGeneratedPost(null); setGeneratedDraft(""); }} className="text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to signal
                </Button>
                {postEdited && (
                  <Button size="sm" onClick={saveGeneratedEdits} disabled={savingPost}>
                    <Check className="h-3.5 w-3.5" />
                    {savingPost ? "Saving…" : "Save edits"}
                  </Button>
                )}
              </>
            ) : editing ? (
              <>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Check className="h-3.5 w-3.5" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setDraft(content); setEditing(true); }}>
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            {mode === "generated" && generatedPost ? (
              <Link href={`/posts/${generatedPost.id}`}>
                <Button size="sm" variant="outline" className="text-xs">
                  View post
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={archive}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Framework + angle + generate card ── */}
      <div className="rounded-xl border border-border bg-card/60 px-4 py-3 space-y-4">
        {/* Framework picker */}
        {frameworks.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Reformat with a framework
              <span className="ml-1 text-muted-foreground/60">· ★ star the best one</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {frameworks.map((fw) => {
                const isActive = activeFrameworkId === fw.id;
                const isLoading = applyingId === fw.id;
                const isStarred = localBestId === fw.id;
                const isStarring = starringId === fw.id;
                return (
                  <div key={fw.id} className="flex items-center gap-1">
                    <button
                      onClick={() => applyFramework(fw)}
                      disabled={!!applyingId}
                      title={fw.description}
                      className={cn(
                        "flex items-center gap-1.5 rounded-l-full border px-3 py-1 text-xs font-medium transition-all",
                        isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        applyingId && !isLoading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      {fw.name}
                      {isActive && <X className="h-3 w-3 opacity-60" />}
                    </button>
                    <button
                      onClick={() => toggleStar(fw)}
                      disabled={!!starringId}
                      title={isStarred ? "Remove star" : "Star as best for this signal"}
                      className={cn(
                        "flex items-center rounded-r-full border border-l-0 px-2 py-1 transition-all",
                        isStarred ? "border-amber-400 bg-amber-400/10 text-amber-500" : "border-border bg-muted text-muted-foreground hover:text-amber-500 hover:border-amber-400/50",
                        starringId && !isStarring && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isStarring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className={cn("h-3 w-3", isStarred && "fill-current")} />}
                    </button>
                  </div>
                );
              })}
            </div>
            {localBestId && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" />
                {frameworks.find((f) => f.id === localBestId)?.name} is starred as best for this signal.
              </p>
            )}
          </div>
        )}

        {/* Content angle picker */}
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Content angle</div>
          {contentAngles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {contentAngles.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => { setAngle(a); setCustomAngle(""); }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    angle === a && !customAngle
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
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
            className="text-xs min-h-[60px] resize-none"
          />
        </div>

        {/* Generate button */}
        <div className="flex justify-end">
          <Button onClick={generate} disabled={generating || !authorId}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating…" : "Generate post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
