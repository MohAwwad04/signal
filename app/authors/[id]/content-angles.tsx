"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAuthorContentAnglesAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { X, Plus } from "lucide-react";

export function ContentAngles({
  authorId,
  initialAngles,
}: {
  authorId: number;
  initialAngles: string[];
}) {
  const defaults = initialAngles.length ? initialAngles : ["general insight"];
  const [angles, setAngles] = useState<string[]>(defaults);
  const [newAngle, setNewAngle] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(updated: string[]) {
    setSaving(true);
    try {
      await updateAuthorContentAnglesAction(authorId, updated);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  function add() {
    const trimmed = newAngle.trim();
    if (!trimmed || angles.includes(trimmed)) return;
    const updated = [...angles, trimmed];
    setAngles(updated);
    setNewAngle("");
    persist(updated);
  }

  function remove(angle: string) {
    if (angles.length <= 1) {
      toast({ title: "At least one content angle is required.", kind: "error" });
      return;
    }
    const updated = angles.filter((a) => a !== angle);
    setAngles(updated);
    persist(updated);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {angles.map((a) => (
          <span
            key={a}
            className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium"
          >
            {a}
            <button
              type="button"
              onClick={() => remove(a)}
              disabled={saving || angles.length <= 1}
              className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
              aria-label={`Remove ${a}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={newAngle}
          onChange={(e) => setNewAngle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. founder lessons, technical insights…"
          className="h-8 text-sm"
          disabled={saving}
        />
        <Button size="sm" onClick={add} disabled={!newAngle.trim() || saving}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
