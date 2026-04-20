"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateSignalContentAction, archiveSignalAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Edit2, Check, X, Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function PostEditor({
  signalId,
  initialContent,
  authorName,
}: {
  signalId: number;
  initialContent: string;
  authorName?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);

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
    await navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard", kind: "success" });
  }

  async function archive() {
    await archiveSignalAction(signalId);
    router.push("/signals");
  }

  const initials = authorName
    ? authorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
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
  );
}
