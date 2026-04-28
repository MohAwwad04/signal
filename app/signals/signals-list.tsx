"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { Linkedin, ArrowUpRight, FileText, Archive, X, CheckSquare } from "lucide-react";
import { GroupTitleEdit } from "./group-title-edit";
import { bulkArchiveSignalsAction } from "@/lib/actions";

export type SignalItem = {
  id: number;
  status: string;
  rawContent: string;
  recommendedAuthorId: number | null;
  contentAngles: string[] | null;
  hashtags: string[] | null;
  title: string | null;
  createdAtMs: number;
};

export type SignalGroup = {
  key: string;
  displayTitle: string;
  transcriptId: number | null;
  dateStr: string | null;
  signals: SignalItem[];
};

interface Props {
  groups: SignalGroup[];
  authorMap: Record<number, string>;
  draftCountMap: Record<number, number>;
}

export function SignalsList({ groups, authorMap, draftCountMap }: Props) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function selectAll() {
    setSelected(new Set(groups.flatMap((g) => g.signals.map((s) => s.id))));
  }

  function handleArchive() {
    startTransition(async () => {
      await bulkArchiveSignalsAction(Array.from(selected));
      exitSelectMode();
    });
  }

  const totalSignals = groups.reduce((sum, g) => sum + g.signals.length, 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {totalSignals} signal{totalSignals !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Select all
              </button>
              <Button size="sm" variant="ghost" onClick={exitSelectMode} className="h-7 gap-1 text-xs">
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectMode(true)}
              className="h-7 gap-1 text-xs"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Select
            </Button>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.key}>
            {/* Group header */}
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                {group.transcriptId ? (
                  <GroupTitleEdit transcriptId={group.transcriptId} title={group.displayTitle} />
                ) : (
                  <span className="text-sm font-semibold truncate">{group.displayTitle}</span>
                )}
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {group.signals.length} signal{group.signals.length !== 1 ? "s" : ""}
                </span>
              </div>
              {group.dateStr && (
                <span className="shrink-0 text-[11px] text-muted-foreground/60">{group.dateStr}</span>
              )}
              <div className="flex-1 h-px bg-border/60" />
            </div>

            {/* Signal cards */}
            <div className="grid gap-2">
              {group.signals.map((s) => {
                const authorName = s.recommendedAuthorId ? authorMap[s.recommendedAuthorId] : null;
                const firstLine =
                  s.rawContent.split("\n").find((l) => l.trim().length > 0) ?? s.rawContent;
                const taggedAngles = s.contentAngles ?? [];
                const hashtags = s.hashtags ?? [];
                const previewHashtags = hashtags.slice(0, 4);
                const previewAngles = !previewHashtags.length ? taggedAngles.slice(0, 4) : [];
                const previewTitle =
                  !previewHashtags.length && !previewAngles.length && s.title
                    ? s.title.trim().split(/\s+/).slice(0, 5).join(" ")
                    : null;
                const isSelected = selected.has(s.id);

                const meta = (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge
                      variant={
                        s.status === "unused"
                          ? "warning"
                          : s.status === "used"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {s.status}
                    </Badge>
                    {authorName && (
                      <span className="flex items-center gap-1">
                        <Linkedin className="h-3 w-3" />
                        {authorName}
                      </span>
                    )}
                    {taggedAngles.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-purple-500/8 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {previewHashtags.length > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        {previewHashtags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70"
                          >
                            #{tag}
                          </span>
                        ))}
                      </>
                    )}
                    {previewAngles.length > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        {previewAngles.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground/70"
                          >
                            {tag}
                          </span>
                        ))}
                      </>
                    )}
                    {previewTitle && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="italic text-muted-foreground/50 truncate max-w-[220px]">
                          {previewTitle}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground/40">·</span>
                    <span>{timeAgo(new Date(s.createdAtMs))}</span>
                  </div>
                );

                if (selectMode) {
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelect(s.id)}
                      className={`group flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 transition-all duration-200 select-none ${
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-border hover:border-primary/20"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 transition-colors flex items-center justify-center ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="h-2.5 w-2.5 text-primary-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">{firstLine}</p>
                        {meta}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={s.id}
                    className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-glow-sm hover:-translate-y-0.5"
                  >
                    <Link href={`/signals/${s.id}`} className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{firstLine}</p>
                      {meta}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={`/signals/${s.id}`}>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-border bg-background/95 backdrop-blur-sm px-5 py-3 shadow-xl">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={handleArchive}
            className="gap-1.5"
          >
            <Archive className="h-3.5 w-3.5" />
            {pending ? "Archiving…" : `Archive ${selected.size}`}
          </Button>
        </div>
      )}
    </div>
  );
}
