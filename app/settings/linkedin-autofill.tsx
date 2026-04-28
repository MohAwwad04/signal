"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { updateAuthorAction, scrapeLinkedinProfileAction } from "@/lib/actions";
import { Linkedin, Sparkles } from "lucide-react";

export function LinkedinAutofill({
  authorId,
  initialUrl,
}: {
  authorId: number;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [loading, setLoading] = useState(false);

  async function handleAutofill() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast({ title: "Enter a LinkedIn URL first", kind: "error" });
      return;
    }
    if (!trimmed.includes("linkedin.com/in/")) {
      toast({ title: "That doesn't look like a LinkedIn profile URL", kind: "error" });
      return;
    }

    setLoading(true);
    try {
      // Save URL first (in case it changed)
      await updateAuthorAction(authorId, { linkedinUrl: trimmed });

      // Now scrape + analyze
      const result = await scrapeLinkedinProfileAction(authorId);
      if (result.ok) {
        toast({ title: "Profile updated", description: result.message, kind: "success" });
        // Reload so the new voice profile / angles appear
        window.location.reload();
      } else {
        toast({ title: "Could not read LinkedIn profile", description: result.message, kind: "error" });
      }
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e?.message, kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Linkedin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://linkedin.com/in/your-profile"
          className="h-8 text-sm max-w-xs"
          disabled={loading}
          onKeyDown={(e) => { if (e.key === "Enter") handleAutofill(); }}
        />
      </div>
      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAutofill}
          disabled={loading || !url.trim()}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? "Reading LinkedIn…" : "Auto-fill from LinkedIn"}
        </Button>
      </div>
    </div>
  );
}
