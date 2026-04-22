"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateSignalAuthorAction,
  updateSignalContentAnglesAction,
} from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { User, Tag, FileText, BarChart2, ChevronDown, ChevronUp, Check, X, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Author = { id: number; name: string; role: string | null };
type ContentAngle = { id: number; name: string };

/* ─── Author Card ─── */
export function AuthorCard({
  signalId,
  author,
  allAuthors,
}: {
  signalId: number;
  author: Author | null;
  allAuthors: Author[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function selectAuthor(authorId: number | null) {
    setSaving(true);
    try {
      await updateSignalAuthorAction(signalId, authorId);
      toast({ title: "Author updated", kind: "success" });
      router.refresh();
    } catch {
      toast({ title: "Failed to update author", kind: "error" });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  const initials = author
    ? author.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-cyan-500" />
          Author
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!editing ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initials}
              </div>
              <div>
                <div className="text-sm font-medium">{author?.name ?? "Unassigned"}</div>
                {author?.role && <div className="text-[11px] text-muted-foreground">{author.role}</div>}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 text-xs">
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid gap-1.5">
              <button
                type="button"
                onClick={() => selectAuthor(null)}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors",
                  !author ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                )}
              >
                <span className="font-medium text-muted-foreground">None</span>
              </button>
              {allAuthors.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => selectAuthor(a.id)}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors",
                    author?.id === a.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  <div>
                    <div className="font-medium">{a.name}</div>
                    {a.role && <div className="text-muted-foreground">{a.role}</div>}
                  </div>
                  {author?.id === a.id && <Check className="ml-auto h-3 w-3 text-primary" />}
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 w-full text-xs">
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Content Angles Card (signal-level tagging) ─── */
export function SignalAnglesCard({
  signalId,
  signalAngles,
  allAngles,
}: {
  signalId: number;
  signalAngles: string[];
  allAngles: ContentAngle[];
}) {
  const router = useRouter();
  const [angles, setAngles] = useState<string[]>(signalAngles);
  const [newAngle, setNewAngle] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestions = newAngle.trim().length > 1
    ? allAngles.filter((a) =>
        a.name.toLowerCase().includes(newAngle.toLowerCase()) && !angles.includes(a.name)
      )
    : [];

  async function persist(updated: string[]) {
    setSaving(true);
    try {
      await updateSignalContentAnglesAction(signalId, updated);
      router.refresh();
    } catch {
      toast({ title: "Failed to update angles", kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  function add(name: string) {
    const trimmed = name.trim();
    if (!trimmed || angles.includes(trimmed)) return;
    const updated = [...angles, trimmed];
    setAngles(updated);
    setNewAngle("");
    persist(updated);
  }

  function remove(angle: string) {
    const updated = angles.filter((a) => a !== angle);
    setAngles(updated);
    persist(updated);
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-purple-500" />
          Content angles
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {angles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {angles.map((a) => (
              <span key={a} className="flex items-center gap-1 rounded-full border border-border bg-purple-500/8 px-2.5 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                {a}
                <button
                  type="button"
                  onClick={() => remove(a)}
                  disabled={saving}
                  className="text-purple-400 hover:text-destructive transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative">
          <div className="flex gap-1.5">
            <Input
              value={newAngle}
              onChange={(e) => setNewAngle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { add(newAngle); }
              }}
              placeholder="Tag an angle…"
              className="h-7 text-xs"
              disabled={saving}
            />
            <Button size="sm" onClick={() => add(newAngle)} disabled={!newAngle.trim() || saving} className="h-7 px-2">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-border bg-popover shadow-md">
              {suggestions.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => add(s.name)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-left"
                >
                  <Star className="h-3 w-3 text-amber-500" />
                  {s.name}
                  <span className="ml-auto text-muted-foreground">existing</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {angles.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Tag this signal with content angles to enable filtering.</p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Transcript Card ─── */
export function TranscriptCard({ transcript }: { transcript: string }) {
  const [open, setOpen] = useState(false);
  const preview = transcript.slice(0, 280);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            Source transcript
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          <pre className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed max-h-72 overflow-y-auto">
            {transcript}
          </pre>
        </CardContent>
      )}
      {!open && (
        <CardContent>
          <p className="text-xs text-muted-foreground line-clamp-3">{preview}{transcript.length > 280 ? "…" : ""}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1.5 text-[11px] text-primary hover:underline"
          >
            Show full transcript
          </button>
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Stats Panel ─── */
export function SignalStatsPanel({
  hookStrength,
  specificity,
  analytics,
  postCount,
}: {
  hookStrength: number | null;
  specificity: number | null;
  analytics: { impressions: number; likes: number; comments: number; shares: number };
  postCount: number;
}) {
  const hasScores = hookStrength !== null || specificity !== null;
  const hasAnalytics = analytics.impressions > 0 || analytics.likes > 0 || analytics.comments > 0 || analytics.shares > 0;
  const maxStat = Math.max(analytics.impressions, analytics.likes, analytics.comments, analytics.shares, 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
          Signal quality
          {postCount > 0 && <Badge variant="secondary" className="ml-auto text-[10px]">{postCount} post{postCount !== 1 ? "s" : ""}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasScores && postCount === 0 && (
          <p className="text-xs text-muted-foreground">Generate a post to see quality scores.</p>
        )}

        {hasScores && (
          <div className="space-y-3">
            <QualityBar label="Hook strength" value={hookStrength ?? 0} />
            <QualityBar label="Specificity" value={specificity ?? 0} />
          </div>
        )}

        {hasAnalytics && (
          <>
            <div className="border-t border-border/50 pt-3">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn performance</p>
              <div className="space-y-2.5">
                <AnalyticsBar label="Impressions" value={analytics.impressions} max={maxStat} color="bg-blue-500" />
                <AnalyticsBar label="Likes" value={analytics.likes} max={maxStat} color="bg-amber-500" />
                <AnalyticsBar label="Comments" value={analytics.comments} max={maxStat} color="bg-emerald-500" />
                <AnalyticsBar label="Shares" value={analytics.shares} max={maxStat} color="bg-purple-500" />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function QualityBar({ label, value }: { label: string; value: number }) {
  const rating = (value / 20).toFixed(1);
  const color =
    value >= 75 ? "from-emerald-500 to-emerald-400"
    : value >= 50 ? "from-amber-500 to-amber-400"
    : "from-red-500 to-red-400";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {rating}<span className="text-muted-foreground">/5</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function AnalyticsBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${color} transition-all duration-500 opacity-80`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
