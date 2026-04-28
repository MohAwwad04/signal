"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateSignalContentAction,
  archiveSignalAction,
  updateSignalBestFrameworkAction,
  scoreSignalAction,
  scoreContentAction,
  generatePostAction,
  updatePostContentAction,
  submitForReviewAction,
  getAuthorRecommendationAction,
  getAnglesForSignalEditorAction,
  getActiveAuthorsAction,
} from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import {
  Edit2, Check, X, Copy, Trash2, Sparkles, Loader2, Star,
  ArrowUpRight, ArrowLeft, Send, Search, ChevronDown, ChevronUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useScores } from "./scores-provider";
import type { AngleWithAuthor } from "./page";

type Framework = { id: number; name: string; description: string; bestFor?: string[]; contentType?: string };

export function PostEditor({
  signalId,
  initialContent,
  authorName: initialAuthorName,
  allAuthors = [],
  frameworks = [],
  bestFrameworkId,
  signalAngles = [],
  anglesWithAuthor = [],
  globalAngles = [],
  recommendedAngle,
  isAdmin,
  isSuperAdmin,
}: {
  signalId: number;
  initialContent: string;
  authorName?: string | null;
  allAuthors?: { id: number; name: string; role?: string | null }[];
  frameworks?: Framework[];
  bestFrameworkId?: number | null;
  signalAngles?: string[];
  anglesWithAuthor?: AngleWithAuthor[];
  globalAngles?: string[];
  recommendedAngle?: string | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const { scores, setScores, currentAuthorId, setCurrentAuthorId: _setCurrentAuthorId } = useScores();
  // Snapshot of signal scores to restore when leaving generated-post view
  const [signalScoresSnapshot, setSignalScoresSnapshot] = useState<typeof scores | null>(null);

  // ── signal edit state ──
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  // ── framework state (for generation) ──
  const defaultFrameworkId = useMemo(() => {
    if (bestFrameworkId) return bestFrameworkId;
    const contentType = frameworks[0]?.contentType;
    return frameworks.find((f) => contentType && f.bestFor?.includes(contentType))?.id ?? frameworks[0]?.id ?? null;
  }, [bestFrameworkId, frameworks]);

  const [selectedFrameworkId, setSelectedFrameworkId] = useState<number | null>(defaultFrameworkId);
  const [localBestId, setLocalBestId] = useState<number | null>(bestFrameworkId ?? null);
  const [starringId, setStarringId] = useState<number | null>(null);

  // ── live authors (fetched on mount) ──
  const [liveAuthors, setLiveAuthors] = useState<{ id: number; name: string; role: string | null }[]>(
    allAuthors.map((a) => ({ ...a, role: a.role ?? null }))
  );

  // ── angle state ──
  const [liveAngles, setLiveAngles] = useState<AngleWithAuthor[]>(anglesWithAuthor);
  const [anglesLoading, setAnglesLoading] = useState(true);
  const [angleSearch, setAngleSearch] = useState("");
  const [filterAuthor, setFilterAuthor] = useState<string>("all");
  const [showAuthorFilter, setShowAuthorFilter] = useState(false);
  const [customAngle, setCustomAngle] = useState("");

  useEffect(() => {
    getActiveAuthorsAction().then(setLiveAuthors).catch(() => {});
    if (!isAdmin && !isSuperAdmin) { setAnglesLoading(false); return; }
    getAnglesForSignalEditorAction()
      .then(setLiveAngles)
      .catch(() => {})
      .finally(() => setAnglesLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── generate / result state ──
  const [generating, setGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<{ id: number; content: string } | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [savingPost, setSavingPost] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [sentToReview, setSentToReview] = useState(false);
  const [activeAngle, setActiveAngle] = useState<string>(recommendedAngle ?? signalAngles[0] ?? "");

  // ── author-aware recommendation state ──
  const [authorRecAngle, setAuthorRecAngle] = useState<string | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  // Per-author cache: Map<authorId, { frameworkId, angle }>
  const recCacheRef = useRef<Map<number, { frameworkId: number | null; angle: string | null }>>(new Map());
  // Race protection: only apply result from the most-recent request
  const recReqIdRef = useRef(0);

  useEffect(() => {
    if (!currentAuthorId || (!isAdmin && !isSuperAdmin)) return;
    // Skip if this is the initial author and we already have a signal-level recommendation
    const cached = recCacheRef.current.get(currentAuthorId);
    if (cached) {
      if (cached.frameworkId) setSelectedFrameworkId(cached.frameworkId);
      setAuthorRecAngle(cached.angle);
      return;
    }
    const reqId = ++recReqIdRef.current;
    setLoadingRec(true);
    getAuthorRecommendationAction(signalId, currentAuthorId)
      .then((rec) => {
        if (reqId !== recReqIdRef.current) return; // stale response
        recCacheRef.current.set(currentAuthorId, rec);
        if (rec.frameworkId) setSelectedFrameworkId(rec.frameworkId);
        setAuthorRecAngle(rec.angle);
      })
      .catch(() => { /* degrade silently */ })
      .finally(() => { if (reqId === recReqIdRef.current) setLoadingRec(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAuthorId]);

  const mode: "signal" | "generated" = generatedPost ? "generated" : "signal";

  // ── signal actions ──
  async function save() {
    setSaving(true);
    try {
      await updateSignalContentAction(signalId, draft);
      setContent(draft);
      setEditing(false);
      toast({ title: "Saved ✓", kind: "success" });
      scoreContentAction(draft).then(async (s) => {
        setScores({ hookStrength: s.hookStrength, specificity: s.specificity, clarity: s.clarity, emotionalResonance: s.emotionalResonance, callToAction: s.callToAction });
        await scoreSignalAction(signalId);
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

  // ── framework star ──
  async function toggleStar(fw: Framework) {
    if (starringId) return;
    setStarringId(fw.id);
    const newBest = localBestId === fw.id ? null : fw.id;
    try {
      await updateSignalBestFrameworkAction(signalId, newBest);
      setLocalBestId(newBest);
      if (newBest) setSelectedFrameworkId(newBest);
      toast({ title: newBest ? `"${fw.name}" starred as best` : "Star removed", kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed to update", description: e.message, kind: "error" });
    } finally {
      setStarringId(null);
    }
  }

  // ── generate ──
  async function generate(angleOverride?: string) {
    if (!currentAuthorId) { toast({ title: "Assign an author first", kind: "error" }); return; }
    const finalAngle = (angleOverride ?? customAngle.trim() ?? activeAngle ?? "").trim();
    if (!finalAngle) { toast({ title: "Pick or write a content angle", kind: "error" }); return; }
    const fwId = selectedFrameworkId ?? frameworks[0]?.id;
    if (!fwId) { toast({ title: "Select a framework", kind: "error" }); return; }
    setGenerating(true);
    try {
      const post = await generatePostAction({
        signalId,
        authorId: currentAuthorId,
        frameworkId: fwId,
        contentAngle: finalAngle,
      });
      setGeneratedPost({ id: post.id, content: post.content });
      setGeneratedDraft(post.content);
      // Switch score panel to show the generated post's scores
      setSignalScoresSnapshot((prev) => prev ?? scores);
      setScores({
        hookStrength: post.hookStrengthScore ?? null,
        specificity: post.specificityScore ?? null,
        clarity: post.clarityScore ?? null,
        emotionalResonance: post.emotionalResonanceScore ?? null,
        callToAction: post.callToActionScore ?? null,
      });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  function selectAngle(name: string) {
    setActiveAngle(name);
    setCustomAngle("");
    generate(name);
  }

  // ── send to review ──
  async function sendToReview() {
    if (!generatedPost) return;
    setSendingReview(true);
    try {
      if (generatedDraft !== generatedPost.content) {
        await updatePostContentAction(generatedPost.id, generatedDraft);
        setGeneratedPost((p) => p ? { ...p, content: generatedDraft } : p);
      }
      await submitForReviewAction(generatedPost.id);
      setSentToReview(true);
      toast({ title: "Sent to review ✓", kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, kind: "error" });
    } finally {
      setSendingReview(false);
    }
  }

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

  // ── angle filtering ──
  const authorNames = useMemo(() => {
    const names = Array.from(new Set(liveAngles.map((a) => a.authorName)));
    return names.sort();
  }, [liveAngles]);

  const filteredAnglesWithAuthor = useMemo(() => {
    return liveAngles.filter((a) => {
      if (filterAuthor !== "all" && a.authorName !== filterAuthor) return false;
      if (angleSearch.trim()) return a.name.toLowerCase().includes(angleSearch.toLowerCase());
      return true;
    });
  }, [liveAngles, filterAuthor, angleSearch]);

  const filteredSignalAngles = useMemo(() => {
    if (!angleSearch.trim()) return signalAngles;
    return signalAngles.filter((a) => a.toLowerCase().includes(angleSearch.toLowerCase()));
  }, [signalAngles, angleSearch]);

  // Deduplicate: don't show in author angles what's already shown as signal angle
  const signalAngleSet = new Set(signalAngles);
  const uniqueAuthorAngles = filteredAnglesWithAuthor.filter((a) => !signalAngleSet.has(a.name));

  // Group by author name for display
  const authorGroups = useMemo(() => {
    const map = new Map<string, AngleWithAuthor[]>();
    for (const a of uniqueAuthorAngles) {
      const list = map.get(a.authorName) ?? [];
      list.push(a);
      map.set(a.authorName, list);
    }
    return Array.from(map.entries());
  }, [uniqueAuthorAngles]);

  const authorName = currentAuthorId
    ? (liveAuthors.find((a) => a.id === currentAuthorId)?.name ?? initialAuthorName)
    : initialAuthorName;

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
                <Button size="sm" variant="ghost" onClick={() => {
                  setGeneratedPost(null);
                  setGeneratedDraft("");
                  if (signalScoresSnapshot) { setScores(signalScoresSnapshot); setSignalScoresSnapshot(null); }
                }} className="text-xs">
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
              <div className="flex gap-2">
                {!sentToReview ? (
                  <Button size="sm" onClick={sendToReview} disabled={sendingReview}>
                    {sendingReview
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />}
                    {sendingReview ? "Sending…" : "Send to user"}
                  </Button>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Sent to user
                  </span>
                )}
                <Link href={`/posts/${generatedPost.id}`}>
                  <Button size="sm" variant="outline" className="text-xs">
                    View post
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={archive}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Framework + angle card ── */}
      <div className="rounded-xl border border-border bg-card/60 px-4 py-3 space-y-4">

        {/* Framework picker */}
        {frameworks.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Framework
              <span className="ml-1 text-muted-foreground/60">· ★ star the best</span>
              {loadingRec && <Loader2 className="ml-1 h-3 w-3 animate-spin text-muted-foreground/60" />}
            </div>
            <div className="flex flex-wrap gap-2">
              {frameworks.map((fw) => {
                const isSelected = selectedFrameworkId === fw.id;
                const isStarred = localBestId === fw.id;
                const isStarring = starringId === fw.id;
                return (
                  <div key={fw.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedFrameworkId(fw.id)}
                      title={fw.description}
                      className={cn(
                        "flex items-center gap-1.5 rounded-l-full border px-3 py-1 text-xs font-medium transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {fw.name}
                      {isStarred && (
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      )}
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
          </div>
        )}

        {/* Content angle picker */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Content angle
              <span className="ml-1.5 text-muted-foreground/60">· click to generate</span>
              {anglesLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/60" />}
            </div>

            {/* Filter by author — admin/superadmin only, when there are multiple authors */}
            {(isAdmin || isSuperAdmin) && authorNames.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAuthorFilter((v) => !v)}
                  className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  {filterAuthor === "all" ? "All users" : filterAuthor}
                  {showAuthorFilter ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showAuthorFilter && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-popover shadow-md">
                    {[{ label: "All users", value: "all" }, ...authorNames.map((n) => ({ label: n, value: n }))].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setFilterAuthor(opt.value); setShowAuthorFilter(false); }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors",
                          filterAuthor === opt.value && "text-primary font-medium"
                        )}
                      >
                        {filterAuthor === opt.value && <Check className="h-3 w-3" />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search input */}
          {(liveAngles.length > 6 || signalAngles.length > 6) && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={angleSearch}
                onChange={(e) => setAngleSearch(e.target.value)}
                placeholder="Search angles…"
                className="h-7 pl-7 text-xs"
              />
            </div>
          )}

          {/* Signal's own angles (with recommended badge on first) */}
          {filteredSignalAngles.length > 0 && (
            <div className="mb-2">
              {(isAdmin || isSuperAdmin) && liveAngles.length > 0 && (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">From signal</div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {filteredSignalAngles.map((a) => {
                  const isActive = activeAngle === a && !customAngle;
                  const isAuthorRec = authorRecAngle === a;
                  const isSignalRec = !isAuthorRec && a === recommendedAngle;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => selectAngle(a)}
                      disabled={generating}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                        isActive
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        generating && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {a}
                      {isAuthorRec && (
                        <span className="ml-0.5 rounded-full bg-blue-400/20 px-1 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                          for {authorName?.split(" ")[0]}
                        </span>
                      )}
                      {isSignalRec && (
                        <span className="ml-0.5 rounded-full bg-amber-400/20 px-1 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                          AI pick
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Author-grouped angles */}
          {authorGroups.length > 0 && (
            <div className="space-y-2">
              {authorGroups.map(([groupAuthorName, angles]) => (
                <div key={groupAuthorName}>
                  {(isAdmin || isSuperAdmin) && (
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{groupAuthorName}</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {angles.map((a) => {
                      const isActive = activeAngle === a.name && !customAngle;
                      const isAuthorRec = authorRecAngle === a.name;
                      return (
                        <button
                          key={a.name}
                          type="button"
                          onClick={() => selectAngle(a.name)}
                          disabled={generating}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                            isActive
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            generating && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {a.name}
                          {isAuthorRec && (
                            <span className="ml-0.5 rounded-full bg-blue-400/20 px-1 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                              for {authorName?.split(" ")[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No angles */}
          {filteredSignalAngles.length === 0 && authorGroups.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No angles match your search.</p>
          )}

          {/* Custom angle */}
          <div className="mt-2 flex items-end gap-2">
            <Textarea
              value={customAngle}
              onChange={(e) => { setCustomAngle(e.target.value); if (e.target.value) setActiveAngle(""); }}
              placeholder="Or write your own angle…"
              className="text-xs min-h-[60px] resize-none flex-1"
            />
            <Button
              size="sm"
              onClick={() => generate()}
              disabled={generating || !customAngle.trim()}
              className="shrink-0 self-end"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Apply
            </Button>
          </div>

          {/* Generating indicator */}
          {generating && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating post…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
