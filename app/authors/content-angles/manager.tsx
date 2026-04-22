"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createContentAngleAction, deleteContentAngleAction, addContentAngleToAuthorAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Plus, Trash2, Tag, User, Loader2, Link as LinkIcon } from "lucide-react";

type AngleWithAuthors = { id: number; name: string; authorIds: number[] };
type Author = { id: number; name: string };

export function ContentAnglesManager({
  angles: initialAngles,
  authorMap,
  allAuthors,
}: {
  angles: AngleWithAuthors[];
  authorMap: Record<number, string>;
  allAuthors: Author[];
}) {
  const [angles, setAngles] = useState(initialAngles);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [linkingAngleId, setLinkingAngleId] = useState<number | null>(null);
  const [linkingAuthorId, setLinkingAuthorId] = useState<number | null>(null);

  async function create() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await createContentAngleAction(trimmed);
      setAngles((prev) =>
        prev.some((a) => a.id === created.id)
          ? prev
          : [...prev, { id: created.id, name: created.name, authorIds: [] }]
      );
      setNewName("");
      toast({ title: `"${trimmed}" created`, kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, kind: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Delete angle "${name}"? It will be removed from all authors.`)) return;
    setDeletingId(id);
    try {
      await deleteContentAngleAction(id);
      setAngles((prev) => prev.filter((a) => a.id !== id));
      toast({ title: `"${name}" deleted`, kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, kind: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  async function linkToAuthor(angleId: number, authorId: number) {
    setLinkingAuthorId(authorId);
    try {
      await addContentAngleToAuthorAction(authorId, angleId);
      setAngles((prev) =>
        prev.map((a) =>
          a.id === angleId && !a.authorIds.includes(authorId)
            ? { ...a, authorIds: [...a.authorIds, authorId] }
            : a
        )
      );
      toast({ title: "Angle added to author", kind: "success" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, kind: "error" });
    } finally {
      setLinkingAuthorId(null);
      setLinkingAngleId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Create new */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Create standalone angle</h2>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. founder insights, technical deep-dive…"
            className="h-8 text-sm"
            disabled={creating}
          />
          <Button size="sm" onClick={create} disabled={!newName.trim() || creating} className="h-8">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </Button>
        </div>
      </div>

      {/* Angles list */}
      {angles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
            <Tag className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-sm font-medium">No content angles yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create one above, or add angles to authors from their profile pages.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {angles.map((angle) => {
            const authorNames = angle.authorIds.map((id) => authorMap[id]).filter(Boolean);
            const unlinkedAuthors = allAuthors.filter((a) => !angle.authorIds.includes(a.id));
            const isLinking = linkingAngleId === angle.id;

            return (
              <div key={angle.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{angle.name}</span>
                      {authorNames.length === 0 && (
                        <Badge variant="secondary" className="text-[10px]">Standalone</Badge>
                      )}
                    </div>
                    {authorNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {authorNames.map((name) => (
                          <span key={name} className="flex items-center gap-1 rounded-full bg-cyan-500/8 px-2 py-0.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                            <User className="h-2.5 w-2.5" />
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
                    {authorNames.length === 0 && (
                      <p className="text-xs text-muted-foreground">Not assigned to any author yet.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unlinkedAuthors.length > 0 && (
                      <div className="relative">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => setLinkingAngleId(isLinking ? null : angle.id)}
                        >
                          <LinkIcon className="h-3 w-3" />
                          Add to author
                        </Button>
                        {isLinking && (
                          <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-border bg-popover shadow-lg">
                            {unlinkedAuthors.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => linkToAuthor(angle.id, a.id)}
                                disabled={linkingAuthorId === a.id}
                                className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
                              >
                                {linkingAuthorId === a.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <User className="h-3 w-3 text-cyan-500" />
                                }
                                {a.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(angle.id, angle.name)}
                      disabled={deletingId === angle.id}
                    >
                      {deletingId === angle.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
