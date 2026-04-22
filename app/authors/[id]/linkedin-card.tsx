"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { analyzeLinkedinProfileAction, analyzeLinkedinPostsFromTextAction } from "@/lib/actions";

export function LinkedInCard({
  authorId,
  linkedinMemberName,
  linkedinConnectedAt,
  linkedinLastSyncedAt,
  isConnected,
}: {
  authorId: number;
  linkedinMemberName: string | null;
  linkedinConnectedAt: Date | null;
  linkedinLastSyncedAt: Date | null;
  isConnected: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [analyzingPaste, setAnalyzingPaste] = useState(false);

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

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const result = await analyzeLinkedinProfileAction(authorId);
      if (result.ok) {
        toast({ title: result.message, kind: "success" });
        router.refresh();
      } else {
        toast({ title: "API access limited", description: result.message, kind: "error" });
        setPasteOpen(true);
      }
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, kind: "error" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAnalyzePaste() {
    if (!pastedText.trim()) return;
    setAnalyzingPaste(true);
    try {
      const message = await analyzeLinkedinPostsFromTextAction(authorId, pastedText);
      toast({ title: message, kind: "success" });
      setPasteOpen(false);
      setPastedText("");
      router.refresh();
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, kind: "error" });
    } finally {
      setAnalyzingPaste(false);
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

  const pasteSection = (
    <div className="space-y-2 pt-1">
      {pasteOpen ? (
        <>
          <p className="text-xs text-muted-foreground">
            Paste your LinkedIn posts below (separate multiple posts with a blank line). Claude will analyze them to fill your content angles, frameworks, and voice profile.
          </p>
          <Textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={"Paste your LinkedIn posts here...\n\n---\n\nPaste another post here..."}
            rows={8}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAnalyzePaste} disabled={analyzingPaste || !pastedText.trim()}>
              {analyzingPaste ? "Analyzing…" : "Analyze posts"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPasteOpen(false); setPastedText(""); }}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <button
          onClick={() => setPasteOpen(true)}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Paste posts manually instead
        </button>
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
              <p className="text-xs text-muted-foreground">
                Last sync: {timeAgo(linkedinLastSyncedAt)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Syncs analytics for published posts that have a LinkedIn URL attached.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync analytics"}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? "Analyzing posts…" : "Analyze my posts"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "..." : "Disconnect"}
              </Button>
            </div>
            {pasteSection}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect this author&apos;s LinkedIn account to automatically pull post analytics (likes, comments, impressions).
            </p>
            <p className="text-xs text-muted-foreground">
              Requires LinkedIn app with <strong>r_member_social</strong> scope approved.{" "}
              <a
                href="/LINKEDIN_SETUP.md"
                className="underline underline-offset-2"
                target="_blank"
              >
                Setup guide
              </a>
            </p>
            <Button
              size="sm"
              onClick={() => {
                window.location.href = `/api/linkedin/oauth/initiate?authorId=${authorId}`;
              }}
            >
              Connect LinkedIn
            </Button>
            {pasteSection}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
