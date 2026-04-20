"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSignalContentAction, archiveSignalAction, applyFrameworkToSignalAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Edit2, Check, X, Copy, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Framework = { id: number; name: string; description: string };

export function PostEditor({
  signalId,
  initialContent,
  authorName,
  frameworks = [],
}: {
  signalId: number;
  initialContent: string;
  authorName?: string | null;
  frameworks?: Framework[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [activeFrameworkId, setActiveFrameworkId] = useState<number | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    try {
      await updateSignalContentAction(signalId, draft);
      setContent(draft);
      setEditing(false);
      toast({ title: "Saved ✓", kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(content);
    setEditing(false);
  }

  async function copy() {
    await navigator.clipboard.writeText(editing ? draft : content);
    toast({ title: "Copied to clipboard", kind: "success" });
  }

  async function archive() {
    await archiveSignalAction(signalId);
    router.push("/signals");
  }

  async function applyFramework(fw: Framework) {
    if (applyingId) return;
    if (activeFrameworkId === fw.id) {
      // toggle off — reset to saved content
      setDraft(content);
      setActiveFrameworkId(null);
      if (!editing) setEditing(false);
      return;
    }
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

  const initials = authorName
    ? authorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* LinkedIn-style header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {initials}
          </div>
          <div>
            <div className="text-sm font-semibold">{authorName ?? "Unassigned"}</div>
            <div className="text-xs text-muted-foreground">LinkedIn · Just now</div>
          </div>
        </div>

        {/* Post body */}
        <div className="px-5 pb-4">
          {editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[320px] resize-y font-[inherit] text-sm leading-relaxed"
              autoFocus
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {content}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-border" />

        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex gap-2">
            {editing ? (
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
            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={archive}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Framework picker */}
      {frameworks.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Reformat with a framework
          </div>
          <div className="flex flex-wrap gap-2">
            {frameworks.map((fw) => {
              const isActive = activeFrameworkId === fw.id;
              const isLoading = applyingId === fw.id;
              return (
                <button
                  key={fw.id}
                  onClick={() => applyFramework(fw)}
                  disabled={!!applyingId}
                  title={fw.description}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    applyingId && !isLoading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {fw.name}
                  {isActive && <X className="h-3 w-3 opacity-60" />}
                </button>
              );
            })}
          </div>
          {activeFrameworkId && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Post reformatted — edit freely or save to keep this version.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
