"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { scrapeLinkedinProfileAction } from "@/lib/actions";

export function LinkedInCard({
  authorId,
  linkedinMemberName,
  linkedinConnectedAt,
  linkedinLastSyncedAt,
  isConnected,
  linkedinUrl,
}: {
  authorId: number;
  linkedinMemberName: string | null;
  linkedinConnectedAt: Date | null;
  linkedinLastSyncedAt: Date | null;
  isConnected: boolean;
  linkedinUrl: string | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    const li = searchParams.get("linkedin");
    if (li === "connected") {
      toast({ title: "LinkedIn connected successfully!", kind: "success" });
    } else if (li === "error") {
      const reason = searchParams.get("reason") ?? "unknown error";
      toast({ title: "LinkedIn connection failed", description: reason, kind: "error" });
    }
  }, [searchParams]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/linkedin/sync/${authorId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `Synced ${data.synced ?? 0} of ${data.total ?? 0} posts from LinkedIn`, kind: "success" });
        router.refresh();
      } else {
        toast({ title: "Sync failed", description: data.error, kind: "error" });
      }
    } catch {
      toast({ title: "Sync request failed", kind: "error" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleScrape() {
    setScraping(true);
    try {
      const result = await scrapeLinkedinProfileAction(authorId);
      if (result.ok) {
        toast({ title: result.message, kind: "success" });
        router.refresh();
      } else {
        toast({ title: "Could not read LinkedIn profile", description: result.message, kind: "error" });
      }
    } catch {
      toast({ title: "Could not read LinkedIn profile", kind: "error" });
    } finally {
      setScraping(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/linkedin/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId }),
      });
      router.refresh();
    } catch {
      toast({ title: "Disconnect failed", kind: "error" });
    } finally {
      setDisconnecting(false);
    }
  }

  const analyzeSection = (
    <div className="space-y-2 border-t border-border/50 pt-3 mt-1">
      <p className="text-xs font-medium">Auto-fill profile from LinkedIn</p>
      <p className="text-xs text-muted-foreground">
        Reads the LinkedIn profile to fill in content angles, preferred frameworks, and voice profile.
      </p>
      <Button size="sm" variant="secondary" onClick={handleScrape} disabled={scraping}>
        {scraping ? "Reading LinkedIn…" : "Auto-fill from LinkedIn"}
      </Button>
      {!linkedinUrl && (
        <p className="text-xs text-amber-500">
          No LinkedIn URL detected yet — add it in the profile header above, then click Auto-fill.
        </p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">LinkedIn integration</CardTitle>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Connected
              {linkedinMemberName && (
                <> as <span className="font-medium">{linkedinMemberName}</span></>
              )}
            </div>
            {linkedinLastSyncedAt && (
              <p className="text-xs text-muted-foreground">Last sync: {timeAgo(linkedinLastSyncedAt)}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync analytics"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "..." : "Disconnect"}
              </Button>
            </div>
            {analyzeSection}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect this author&apos;s LinkedIn account to automatically pull post analytics (likes, comments, impressions).
            </p>
            <p className="text-xs text-muted-foreground">
              Requires LinkedIn app with <strong>r_member_social</strong> scope approved.{" "}
              <a href="/LINKEDIN_SETUP.md" className="underline underline-offset-2" target="_blank">
                Setup guide
              </a>
            </p>
            <Button size="sm" onClick={() => { window.location.href = `/api/linkedin/oauth/initiate?authorId=${authorId}`; }}>
              Connect LinkedIn
            </Button>
            {analyzeSection}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
