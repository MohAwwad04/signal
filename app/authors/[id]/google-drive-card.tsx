"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

export function GoogleDriveCard({
  authorId,
  googleUserEmail,
  googleConnectedAt,
  googleLastSyncedAt,
  isConnected,
}: {
  authorId: number;
  googleUserEmail: string | null;
  googleConnectedAt: Date | null;
  googleLastSyncedAt: Date | null;
  isConnected: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const g = searchParams.get("google");
    if (g === "connected") {
      toast({ title: "Google Drive connected successfully!", kind: "success" });
    } else if (g === "error") {
      const reason = searchParams.get("reason") ?? "unknown error";
      toast({ title: "Google connection failed", description: reason, kind: "error" });
    }
  }, [searchParams]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/google/sync/${authorId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: data.synced
            ? `Synced ${data.synced} signals from ${data.newMeetings} new transcripts`
            : "No new transcripts found",
          kind: "success",
        });
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

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/google/oauth/disconnect", {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Meet transcripts</CardTitle>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Connected
              {googleUserEmail && (
                <> as <span className="font-medium">{googleUserEmail}</span></>
              )}
            </div>
            {googleLastSyncedAt && (
              <p className="text-xs text-muted-foreground">Last sync: {timeAgo(googleLastSyncedAt)}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Sync now"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? "..." : "Disconnect"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect Google to auto-import Gemini transcripts from Google Meet into signals.
            </p>
            <p className="text-xs text-muted-foreground">
              Requires a Google account with Gemini transcription enabled in Meet.
            </p>
            <Button
              size="sm"
              onClick={() => { window.location.href = `/api/google/oauth/initiate?authorId=${authorId}`; }}
            >
              Connect Google
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
