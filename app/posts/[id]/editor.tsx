"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Post, Author, DesignBrief } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import {
  assistedEditAction,
  updatePostContentAction,
  submitForReviewAction,
  approvePostAction,
  reopenPostAction,
  rejectPostAction,
  markPublishedAction,
  generateDesignBriefAction,
  recordAnalyticsAction,
  setLinkedinPostUrlAction,
} from "@/lib/actions";
import { Loader2, Scissors, Gauge, RefreshCw, Send, Check, X, Image as ImageIcon, BarChart3, FileEdit } from "lucide-react";

export function PostEditor({
  post,
  author,
  brief: initialBrief,
}: {
  post: Post;
  author: Author | null;
  brief: DesignBrief | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(post.content);
  const [customInstruction, setCustomInstruction] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [brief, setBrief] = useState(initialBrief);
  const [isPending, startTransition] = useTransition();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinUrlInput, setLinkedinUrlInput] = useState(post.linkedinPostUrn ? `(URN: ${post.linkedinPostUrn})` : "");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  useEffect(() => setText(post.content), [post.content]);

  async function saveManualEdit() {
    setLoading("save");
    try {
      await updatePostContentAction(post.id, text);
      toast({ title: "Saved", kind: "success" });
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(null);
    }
  }

  async function runAssisted(instruction: string, label: string) {
    setLoading(label);
    try {
      const updated = await assistedEditAction(post.id, instruction);
      if (updated?.content) setText(updated.content);
      toast({ title: "Edited", kind: "success" });
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast({ title: "Edit failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(null);
    }
  }

  async function submit() {
    setLoading("submit");
    try {
      await submitForReviewAction(post.id);
      toast({ title: "Sent for review", kind: "success" });
      router.push("/drafts");
    } finally {
      setLoading(null);
    }
  }

  async function approve() {
    setLoading("approve");
    try {
      await approvePostAction(post.id);
      toast({ title: "Approved", kind: "success" });
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast({ title: "Failed to approve", description: e?.message, kind: "error" });
    } finally {
      setLoading(null);
    }
  }

  async function reopen() {
    setLoading("reopen");
    try {
      await reopenPostAction(post.id);
      toast({ title: "Post re-opened for editing", kind: "info" });
      startTransition(() => router.refresh());
    } finally {
      setLoading(null);
    }
  }

  async function reject() {
    if (!rejectNotes.trim()) { setShowRejectInput(true); return; }
    setLoading("reject");
    try {
      await rejectPostAction(post.id, rejectNotes);
      toast({ title: "Rejected", kind: "info" });
      setShowRejectInput(false);
      setRejectNotes("");
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast({ title: "Failed to reject", description: e?.message, kind: "error" });
    } finally {
      setLoading(null);
    }
  }

  async function markPublished() {
    setLoading("publish");
    try {
      await markPublishedAction(post.id, linkedinUrl || undefined);
      toast({ title: "Marked as published", kind: "success" });
      startTransition(() => router.refresh());
    } finally {
      setLoading(null);
    }
  }

  async function saveLinkedinUrl() {
    setLoading("linkedin-url");
    try {
      await setLinkedinPostUrlAction(post.id, linkedinUrlInput);
      toast({ title: "LinkedIn URL saved", kind: "success" });
      startTransition(() => router.refresh());
    } catch (e: any) {
      toast({ title: "Invalid URL", description: e?.message, kind: "error" });
    } finally {
      setLoading(null);
    }
  }

  async function genBrief() {
    setLoading("brief");
    try {
      const b = await generateDesignBriefAction(post.id);
      setBrief(b);
      toast({ title: "Design brief ready", kind: "success" });
    } catch (e: any) {
      toast({ title: "Brief failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-6 md:p-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileEdit className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-semibold text-purple-500 uppercase tracking-widest">Post editor</span>
          </div>
          <div className="flex items-center gap-2.5 mb-0.5">
            <StatusBadge status={post.status} />
            {author && <span className="text-sm text-muted-foreground">{author.name}{author.role ? ` · ${author.role}` : ""}</span>}
            {post.contentAngle && <span className="text-sm text-muted-foreground line-clamp-1">· {post.contentAngle}</span>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Post #{post.id}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {post.status === "draft" && (
            <Button onClick={submit} disabled={loading === "submit"}>
              {loading === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send for review
            </Button>
          )}
          {post.status === "in_review" && (
            <>
              {showRejectInput ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Reason for rejection"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && reject()}
                    className="w-56 text-xs"
                    autoFocus
                  />
                  <Button variant="outline" onClick={reject} disabled={loading === "reject" || !rejectNotes.trim()}>
                    {loading === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Reject
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowRejectInput(false); setRejectNotes(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={reject} disabled={loading === "reject"}>
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              )}
              <Button onClick={approve} disabled={loading === "approve"}>
                {loading === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve
              </Button>
            </>
          )}
          {post.status === "rejected" && (
            <Button variant="outline" onClick={reopen} disabled={loading === "reopen"}>
              {loading === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileEdit className="h-4 w-4" />}
              Re-open
            </Button>
          )}
          {post.status === "approved" && (
            <div className="flex items-center gap-2">
              <Input
                placeholder="LinkedIn post URL (optional)"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-64 text-xs"
              />
              <Button onClick={markPublished} disabled={loading === "publish"}>
                {loading === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Mark as published
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Post content</CardTitle>
                <CardDescription>Edit directly, or use assisted edits below.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={saveManualEdit} disabled={loading === "save" || text === post.content}>
                {loading === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Save
              </Button>
            </CardHeader>
            <CardContent>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[360px] font-mono text-sm leading-relaxed"
              />
              <div className="mt-2 text-[11px] text-muted-foreground">
                {text.length} chars · ~{Math.max(1, Math.round(text.split(/\s+/).length))} words
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assisted edits</CardTitle>
              <CardDescription>Claude edits in place, preserving {author?.name ?? "the author"}&apos;s voice.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <AssistButton disabled={!!loading} onClick={() => runAssisted("Make it shorter. Cut any line that isn't specific.", "shorter")} active={loading === "shorter"}>
                  <Scissors className="h-3.5 w-3.5" /> Make it shorter
                </AssistButton>
                <AssistButton disabled={!!loading} onClick={() => runAssisted("Make the hook stronger — the first 1-2 lines should make a thumb stop.", "hook")} active={loading === "hook"}>
                  <Gauge className="h-3.5 w-3.5" /> Stronger hook
                </AssistButton>
                <AssistButton disabled={!!loading} onClick={() => runAssisted("Make it more technical and specific. Drop marketing words.", "tech")} active={loading === "tech"}>
                  More technical
                </AssistButton>
                <AssistButton disabled={!!loading} onClick={() => runAssisted("Make it less technical. Write for a non-technical reader.", "less-tech")} active={loading === "less-tech"}>
                  Less technical
                </AssistButton>
                <AssistButton disabled={!!loading} onClick={() => runAssisted("Add a story element at the top — a specific moment or scene.", "story")} active={loading === "story"}>
                  Add a story
                </AssistButton>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Custom instruction — e.g. 'make the ending less salesy'"
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  disabled={!!loading}
                />
                <Button
                  disabled={!!loading || !customInstruction.trim()}
                  onClick={() => { runAssisted(customInstruction, "custom"); setCustomInstruction(""); }}
                >
                  {loading === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {(post.status === "approved" || post.status === "published") && (
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Design brief</CardTitle>
                  <CardDescription>Claude generates a brief + SVG mock. Hand this to your designer.</CardDescription>
                </div>
                {!brief && (
                  <Button variant="outline" size="sm" onClick={genBrief} disabled={loading === "brief"}>
                    {loading === "brief" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    Generate brief
                  </Button>
                )}
              </CardHeader>
              {brief && (
                <CardContent className="space-y-4">
                  <Field label="Objective">{brief.objective}</Field>
                  <Field label="Audience">{brief.targetAudience}</Field>
                  <Field label="Tone">{brief.tone}</Field>
                  <Field label="Key messages">
                    <ul className="list-disc pl-5 space-y-0.5">
                      {brief.keyMessages?.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </Field>
                  <Field label="Design direction">{brief.designDirection}</Field>
                  {brief.svg && (
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground">SVG mock</div>
                      <div className="overflow-hidden rounded-xl border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`data:image/svg+xml;base64,${btoa(brief.svg)}`} alt="Design mock" className="w-full" />
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {post.status === "published" && <AnalyticsPanel postId={post.id} />}
        </div>

        <aside className="space-y-4">
          {post.status === "published" && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">LinkedIn post URL</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {post.linkedinPostUrn ? (
                  <p className="text-xs text-muted-foreground break-all">URN: {post.linkedinPostUrn}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">No LinkedIn URL linked yet. Add one to enable analytics sync.</p>
                )}
                <Input
                  placeholder="https://www.linkedin.com/posts/..."
                  value={linkedinUrlInput}
                  onChange={(e) => setLinkedinUrlInput(e.target.value)}
                  className="text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveLinkedinUrl}
                  disabled={loading === "linkedin-url" || !linkedinUrlInput.trim() || linkedinUrlInput.startsWith("(URN:")}
                  className="w-full"
                >
                  {loading === "linkedin-url" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Save URL
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Scores</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ScoreBar label="Hook strength" value={post.hookStrengthScore ?? 0} />
              <ScoreBar label="Specificity" value={post.specificityScore ?? 0} />
              <ScoreBar label="Clarity" value={post.clarityScore ?? 0} />
              <ScoreBar label="Emotional resonance" value={post.emotionalResonanceScore ?? 0} />
              <ScoreBar label="Call to action" value={post.callToActionScore ?? 0} />
            </CardContent>
          </Card>
          {post.reviewerNotes && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Reviewer notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm">{post.reviewerNotes}</p></CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Original draft</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{post.originalContent}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function AssistButton({
  children, onClick, disabled, active,
}: { children: React.ReactNode; onClick: () => void; disabled: boolean; active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50")
      }
    >
      {active && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "from-emerald-500 to-emerald-400" : value >= 50 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}/100</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    draft:      { variant: "secondary",   label: "Draft"     },
    in_review:  { variant: "warning",     label: "In review" },
    approved:   { variant: "success",     label: "Approved"  },
    rejected:   { variant: "destructive", label: "Rejected"  },
    published:  { variant: "default",     label: "Published" },
  };
  const m = map[status] ?? { variant: "secondary", label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function AnalyticsPanel({ postId }: { postId: number }) {
  const [impressions, setImpressions] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [shares, setShares] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function save() {
    setLoading(true);
    try {
      await recordAnalyticsAction(postId, { impressions, likes, comments, shares });
      toast({ title: "Metrics saved", kind: "success" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Log performance</CardTitle>
        <CardDescription>Numbers here feed into future generations — the model learns what works.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <NumField label="Impressions" value={impressions} onChange={setImpressions} />
        <NumField label="Likes" value={likes} onChange={setLikes} />
        <NumField label="Comments" value={comments} onChange={setComments} />
        <NumField label="Shares" value={shares} onChange={setShares} />
        <div className="col-span-2 md:col-span-4 flex justify-end">
          <Button onClick={save} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Save metrics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
