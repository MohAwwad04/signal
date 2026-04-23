"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { extractSignalsAction, createManualSignalAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Loader2, Sparkles, Radio, PenLine, Hash, X } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["💡", "📊", "✅", "🎯", "📈", "⚠️"];

type Tab = "transcript" | "manual";

export default function NewSignalsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("transcript");

  // — transcript tab state —
  const [transcript, setTranscript] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [date, setDate] = useState("");
  const [extracting, setExtracting] = useState(false);

  // — manual tab state —
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  function addEmoji(emoji: string) {
    const el = contentRef.current;
    if (!el) { setContent((c) => c + emoji); return; }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  }

  function addHashtag(raw: string) {
    const cleaned = raw.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "");
    if (!cleaned || hashtags.includes(cleaned)) return;
    setHashtags((h) => [...h, cleaned]);
  }

  function handleHashtagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addHashtag(hashtagInput);
      setHashtagInput("");
    } else if (e.key === "Backspace" && !hashtagInput && hashtags.length) {
      setHashtags((h) => h.slice(0, -1));
    }
  }

  async function handleExtract() {
    setExtracting(true);
    try {
      const res = await extractSignalsAction(transcript, meetingTitle || undefined, date || undefined);
      toast({ title: `Found ${res.inserted} signal${res.inserted !== 1 ? "s" : ""}`, kind: "success" });
      router.push("/signals");
    } catch (e: any) {
      toast({ title: "Extraction failed", description: e?.message, kind: "error" });
    } finally {
      setExtracting(false);
    }
  }

  async function handleManualSave() {
    setSaving(true);
    try {
      await createManualSignalAction({ title, content, hashtags });
      toast({ title: "Signal saved", kind: "success" });
      router.push("/signals");
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">New signal</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Capture a signal</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Extract from a meeting transcript, or write one manually.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted mb-6 w-fit">
        <button
          onClick={() => setTab("transcript")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            tab === "transcript"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          From transcript
        </button>
        <button
          onClick={() => setTab("manual")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            tab === "manual"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PenLine className="h-3.5 w-3.5" />
          Manual entry
        </button>
      </div>

      {tab === "transcript" && (
        <Card>
          <CardHeader>
            <CardTitle>Meeting transcript</CardTitle>
            <CardDescription>Fathom, Fireflies, Otter — paste the raw text. Claude extracts the high-value moments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mtitle">Meeting title <span className="text-muted-foreground/50">(optional)</span></Label>
                <Input id="mtitle" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Q2 Pipeline Review" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Date <span className="text-muted-foreground/50">(optional)</span></Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Paste the full transcript here..."
                className="min-h-[320px] font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">{transcript.length.toLocaleString()} characters</p>
            </div>
            <div className="flex justify-end">
              <Button disabled={extracting || transcript.length < 100} onClick={handleExtract} size="lg">
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {extracting ? "Extracting…" : "Extract signals"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "manual" && (
        <Card>
          <CardHeader>
            <CardTitle>Manual signal</CardTitle>
            <CardDescription>Write a raw insight directly — a lesson, decision, or observation worth turning into a post.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="sig-title">Title <span className="text-muted-foreground/50">(optional)</span></Label>
              <Input
                id="sig-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Why we stopped doing weekly standups"
                maxLength={120}
              />
            </div>

            {/* Content + emoji toolbar */}
            <div className="space-y-1.5">
              <Label htmlFor="sig-content">Signal content</Label>
              <div className="rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                {/* Emoji toolbar */}
                <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/40 flex-wrap">
                  {QUICK_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => addEmoji(e)}
                      className="text-base leading-none p-1 rounded hover:bg-muted transition-colors"
                      title={e}
                    >
                      {e}
                    </button>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground/50">click to insert</span>
                </div>
                <Textarea
                  ref={contentRef}
                  id="sig-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write the raw insight here. Be specific — include real outcomes, decisions, or lessons from experience. Don't polish it yet."
                  className="min-h-[200px] border-0 rounded-none focus-visible:ring-0 resize-none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{content.length} characters</p>
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <Label>Hashtags</Label>
              <div className="flex flex-wrap items-center gap-1.5 min-h-10 rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
                {hashtags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[12px] font-medium text-blue-600 dark:text-blue-400">
                    #{tag}
                    <button type="button" onClick={() => setHashtags((h) => h.filter((t) => t !== tag))}>
                      <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                    </button>
                  </span>
                ))}
                <input
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKeyDown}
                  onBlur={() => { if (hashtagInput) { addHashtag(hashtagInput); setHashtagInput(""); } }}
                  placeholder={hashtags.length === 0 ? "Type a hashtag and press Enter…" : "Add more…"}
                  className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Press Enter or comma after each tag. No # needed.</p>
            </div>

            <div className="flex justify-end">
              <Button disabled={saving || content.trim().length < 20} onClick={handleManualSave} size="lg">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                {saving ? "Saving…" : "Save signal"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
