"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type Toast = {
  id: number;
  title: string;
  description?: string;
  kind?: "info" | "success" | "error";
};

let externalPush: ((t: Omit<Toast, "id">) => void) | null = null;

export function toast(t: Omit<Toast, "id">) {
  externalPush?.(t);
}

const icons = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
  error:   <XCircle     className="h-4 w-4 text-red-400 shrink-0" />,
  info:    <Info        className="h-4 w-4 text-blue-400 shrink-0" />,
};

const borders = {
  success: "border-emerald-500/25",
  error:   "border-red-500/25",
  info:    "border-blue-500/25",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    externalPush = (t) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { ...t, id }]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 3800);
    };
    return () => { externalPush = null; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((t) => {
        const kind = t.kind ?? "info";
        return (
          <div
            key={t.id}
            className={[
              "pointer-events-auto min-w-[280px] max-w-sm flex items-start gap-3",
              "rounded-2xl border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-glow-sm",
              "animate-slide-up",
              borders[kind],
            ].join(" ")}
          >
            {icons[kind]}
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
