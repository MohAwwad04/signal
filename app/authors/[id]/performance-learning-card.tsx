"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { learnFromPerformanceAction } from "@/lib/actions";
import { Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export function PerformanceLearningCard({
  authorId,
  hints,
  updatedAt,
}: {
  authorId: number;
  hints: string | null;
  updatedAt: Date | null;
}) {
  const [loading, setLoading] = useState(false);
  const [currentHints, setCurrentHints] = useState(hints);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt);

  async function handleRefresh() {
    setLoading(true);
    try {
      const result = await learnFromPerformanceAction(authorId);
      if (result.updated) {
        toast({ title: "Patterns updated", description: result.message, kind: "success" });
        setCurrentUpdatedAt(new Date());
        // Page will revalidate — hints will refresh on next load
        window.location.reload();
      } else {
        toast({ title: "No update", description: result.message, kind: "info" });
      }
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-base">Performance patterns</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading} className="h-7 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
        <CardDescription>
          Extracted from top-performing published posts. Feeds back into signal extraction to surface better content.
          {currentUpdatedAt && (
            <span className="ml-1 text-muted-foreground/60">Last updated {timeAgo(currentUpdatedAt)}.</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentHints ? (
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{currentHints}</pre>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No patterns yet. Publish posts with analytics data, then click Refresh.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
