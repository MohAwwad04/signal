"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { updateAuthorAction } from "@/lib/actions";
import { Pencil, Check, X, Linkedin } from "lucide-react";

export function LinkedinUrlEditor({ authorId, initialUrl }: { authorId: number; initialUrl: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateAuthorAction(authorId, { linkedinUrl: value.trim() || undefined });
      toast({ title: "LinkedIn URL saved", kind: "success" });
      setEditing(false);
    } catch {
      toast({ title: "Failed to save", kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://linkedin.com/in/your-profile"
          className="h-8 text-sm max-w-xs"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        />
        <Button size="sm" variant="ghost" onClick={save} disabled={saving} className="h-8 w-8 p-0">
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(initialUrl ?? ""); }} className="h-8 w-8 p-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Linkedin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
      {value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate max-w-xs">
          {value.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      ) : (
        <span className="text-muted-foreground italic">No LinkedIn URL</span>
      )}
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-6 w-6 p-0 ml-1">
        <Pencil className="h-3 w-3" />
      </Button>
    </div>
  );
}
