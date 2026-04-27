"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAuthorContentAnglesAction, addContentAngleToAuthorAction, createContentAngleAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { X, Plus, Star } from "lucide-react";

type ContentAngle = { id: number; name: string };

export function ContentAngles({
  authorId,
  initialAngles,
  allGlobalAngles,
}: {
  authorId: number;
  initialAngles: string[];
  allGlobalAngles: ContentAngle[];
}) {
  const [angles, setAngles] = useState<string[]>(initialAngles);
  useEffect(() => { setAngles(initialAngles); }, [initialAngles.join(",")]);
  const [newAngle, setNewAngle] = useState("");
  const [saving, setSaving] = useState(false);

  // Suggestions: global angles that contain the input and aren't already added
  const suggestions = newAngle.trim().length > 1
    ? allGlobalAngles.filter(
        (g) =>
          g.name.toLowerCase().includes(newAngle.toLowerCase()) &&
          !angles.includes(g.name)
      )
    : [];

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

  async function addNew() {
    const trimmed = newAngle.trim();
    if (!trimmed || angles.includes(trimmed)) return;

    setSaving(true);
    try {
      // Create (or find) the global angle, then link to author
      const angle = await createContentAngleAction(trimmed);
      await addContentAngleToAuthorAction(authorId, angle.id);
      const updated = [...angles, trimmed];
      setAngles(updated);
      setNewAngle("");
      toast({ title: `"${trimmed}" added`, kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed to add angle", description: e.message, kind: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function addExisting(global: ContentAngle) {
    if (angles.includes(global.name)) return;
    setSaving(true);
    try {
      await addContentAngleToAuthorAction(authorId, global.id);
      const updated = [...angles, global.name];
      setAngles(updated);
      setNewAngle("");
      toast({ title: `"${global.name}" added from global pool`, kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, kind: "error" });
    } finally {
      setSaving(false);
    }
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
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={newAngle}
            onChange={(e) => setNewAngle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNew()}
            placeholder="e.g. founder lessons, technical insights…"
            className="h-8 text-sm"
            disabled={saving}
          />
          <Button size="sm" onClick={addNew} disabled={!newAngle.trim() || saving} className="h-8">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Suggestions from global pool */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-border bg-popover shadow-lg">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
              Existing angles — add to this author
            </div>
            {suggestions.slice(0, 6).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => addExisting(s)}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
              >
                <Star className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto text-muted-foreground rounded-full bg-muted px-1.5 py-0.5">global</span>
              </button>
            ))}
            <div className="px-3 py-1.5 border-t border-border">
              <button
                type="button"
                onClick={addNew}
                className="text-xs text-primary hover:underline"
              >
                Create &ldquo;{newAngle}&rdquo; as new angle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
