"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Author = { id: number; name: string };
type ContentAngle = { id: number; name: string };

export function SignalFilterBar({
  authors,
  angles,
}: {
  authors: Author[];
  angles: ContentAngle[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const qParam = searchParams.get("q") ?? "";
  const authorId = searchParams.get("author") ?? "";
  const angle = searchParams.get("angle") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const [localQ, setLocalQ] = useState(qParam);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local search in sync if URL changes (e.g. clear button)
  useEffect(() => { setLocalQ(qParam); }, [qParam]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value); else params.delete(key);
      startTransition(() => router.push(`/signals?${params.toString()}`));
    },
    [router, searchParams]
  );

  function handleSearchChange(value: string) {
    setLocalQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam("q", value), 350);
  }

  const hasFilters = qParam || authorId || angle || from || to;

  function clearAll() {
    setLocalQ("");
    startTransition(() => router.push("/signals"));
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search signals…"
          value={localQ}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Author filter */}
      <select
        value={authorId}
        onChange={(e) => updateParam("author", e.target.value)}
        className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All authors</option>
        {authors.map((a) => (
          <option key={a.id} value={String(a.id)}>
            {a.name}
          </option>
        ))}
      </select>

      {/* Content angle filter */}
      <select
        value={angle}
        onChange={(e) => updateParam("angle", e.target.value)}
        className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All angles</option>
        {angles.map((a) => (
          <option key={a.id} value={a.name}>
            {a.name}
          </option>
        ))}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          onChange={(e) => updateParam("from", e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => updateParam("to", e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 gap-1 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
