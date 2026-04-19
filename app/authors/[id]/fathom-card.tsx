"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

export function FathomCard({
  authorId,
  fathomUserEmail,
  fathomConnectedAt,
  fathomLastSyncedAt,
  isConnected,
}: {
  authorId: number;
  fathomUserEmail: string | null;
  fathomConnectedAt: Date | null;
  fathomLastSyncedAt: Date | null;
  isConnected: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const fathom = searchParams.get("fathom");
    if (fathom === "connected") {
      setToast("Fathom connected successfully!");
    } else if (fathom === "error") {
      const reason = searchParams.get("reason") ?? "unknown error";
      setToast(`Fathom connection failed: ${reason}`);
    }
  }, [searchParams]);

  const connected = isConnected;

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/fathom/sync/${authorId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setToast(`Synced ${data.synced ?? 0} signals from ${data.newMeetings ?? 0} new meetings`);
        router.refresh();
      } else {
        setToast(data.error ?? "Sync failed");
      }
    } catch {
      setToast("Sync request failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/fathom/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId }),
      });
      router.refresh();
    } catch {
      setToast("Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      {toast && (
        <div className="mb-4 rounded-md border bg-muted px-4 py-3 text-sm">
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fathom integration</CardTitle>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Connected
                {fathomUserEmail && (
                  <> as <span className="font-medium">{fathomUserEmail}</span></>
                )}
              </div>
              {fathomLastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {timeAgo(fathomLastSyncedAt)}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSync} disabled={syncing}>
                  {syncing ? "Syncing..." : "Sync now"}
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
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Link this author&apos;s Fathom account so their meetings auto-import.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = `/api/fathom/oauth/initiate?authorId=${authorId}`;
                }}
              >
                Connect Fathom
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
