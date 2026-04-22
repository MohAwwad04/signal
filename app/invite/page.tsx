"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserPlus } from "lucide-react";
import { Suspense } from "react";

function InviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    bio: "",
    styleNotes: "",
    contentAngles: "",
  });

  async function submit() {
    if (!form.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invite/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-4 w-4 text-cyan-500" />
          <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Welcome</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Set up your profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This becomes your voice profile — the system learns how you write from your edits over time.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jane Smith"
            />
          </Field>
          <Field label="Bio">
            <Textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="A sentence or two about what you do."
            />
          </Field>
          <Field label="Content preferences" hint="Topics or themes you like to post about — comma separated">
            <Textarea
              value={form.contentAngles}
              onChange={(e) => setForm({ ...form, contentAngles: e.target.value })}
              placeholder="e.g. B2B sales, product launches, hiring lessons"
              rows={2}
            />
          </Field>
          <Field label="Style notes" hint="How you like to write — Claude will follow these">
            <Textarea
              value={form.styleNotes}
              onChange={(e) => setForm({ ...form, styleNotes: e.target.value })}
              placeholder="e.g. no emojis, short punchy lines, no hashtags"
              rows={2}
            />
          </Field>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end pt-1">
            <Button onClick={submit} disabled={loading || !form.name.trim()} size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "Setting up…" : "Complete setup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense>
      <InviteForm />
    </Suspense>
  );
}
