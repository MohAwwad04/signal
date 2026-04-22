"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateFrameworkAction, deleteFrameworkAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import type { Framework } from "@/lib/db/schema";

export function FrameworkCard({ framework: f }: { framework: Framework }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(f.name);
  const [description, setDescription] = useState(f.description);
  const [promptTemplate, setPromptTemplate] = useState(f.promptTemplate);
  const [bestFor, setBestFor] = useState(((f.bestFor as string[] | null) ?? []).join(", "));

  async function save() {
    if (!name || !description || !promptTemplate) return;
    setSaving(true);
    try {
      await updateFrameworkAction(f.id, {
        name,
        description,
        promptTemplate,
        bestFor: bestFor.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast({ title: "Framework updated", kind: "success" });
      setEditing(false);
      router.refresh();
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setName(f.name);
    setDescription(f.description);
    setPromptTemplate(f.promptTemplate);
    setBestFor(((f.bestFor as string[] | null) ?? []).join(", "));
    setEditing(false);
  }

  async function remove() {
    if (!confirm(`Delete framework "${f.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteFrameworkAction(f.id);
      toast({ title: "Framework deleted", kind: "success" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e.message, kind: "error" });
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-muted-foreground">Editing framework</span>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={save} disabled={saving || !name || !description || !promptTemplate} className="h-7">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving} className="h-7">
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Prompt template</Label>
          <Textarea value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} className="mt-1 min-h-[120px] text-xs font-mono" />
        </div>
        <div>
          <Label className="text-xs">Best for (comma-separated)</Label>
          <Input value={bestFor} onChange={(e) => setBestFor(e.target.value)} className="mt-1" placeholder="customer_quote, success_metric" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-purple-400/30 hover:shadow-glow-sm">
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-base font-semibold">{f.name}</span>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={remove} disabled={deleting} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{f.description}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {((f.bestFor as string[] | null) ?? []).map((b) => <Badge key={b} variant="secondary">{b.replaceAll("_", " ")}</Badge>)}
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">{f.promptTemplate}</pre>
    </div>
  );
}
