"use client";

import { useRef, useState, useTransition } from "react";
import { renameTranscriptGroupAction } from "@/lib/actions";
import { Pencil } from "lucide-react";

export function GroupTitleEdit({
  transcriptId,
  title,
}: {
  transcriptId: number;
  title: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) { setEditing(false); setValue(title); return; }
    startTransition(async () => {
      await renameTranscriptGroupAction(transcriptId, trimmed);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setValue(title); } }}
        disabled={pending}
        className="text-sm font-semibold bg-transparent border-b border-primary/50 outline-none min-w-0 max-w-[280px]"
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="group/title flex items-center gap-1.5 min-w-0 text-left"
      title="Click to rename"
    >
      <span className="text-sm font-semibold truncate">{value}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover/title:text-muted-foreground/50 transition-colors" />
    </button>
  );
}
