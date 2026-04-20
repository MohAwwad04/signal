"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { extractSignalsAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Loader2, Sparkles, Radio } from "lucide-react";

export default function NewSignalsPage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExtract() {
    setLoading(true);
    try {
      const res = await extractSignalsAction(transcript, title || undefined, date || undefined);
      toast({ title: `Found ${res.inserted} signals`, kind: "success" });
      router.push("/signals");
    } catch (e: any) {
      toast({ title: "Extraction failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-widest">New signal</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Capture signals</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Paste a transcript. Claude reads it and pulls out every moment that could become a post.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Meeting transcript</CardTitle>
          <CardDescription>Fathom, Fireflies, Otter — whatever you use. Paste the raw text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Meeting title <span className="text-muted-foreground/50">(optional)</span></Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q2 Pipeline Review" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date <span className="text-muted-foreground/50">(optional)</span></Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transcript">Transcript</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the full transcript here..."
              className="min-h-[320px] font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">{transcript.length.toLocaleString()} characters</p>
          </div>
          <div className="flex justify-end">
            <Button disabled={loading || transcript.length < 100} onClick={handleExtract} size="lg">
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />
              }
              {loading ? "Extracting…" : "Extract signals"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
