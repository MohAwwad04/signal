"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAuthorAction } from "@/lib/actions";
import { toast } from "@/components/ui/toaster";
import { Loader2, UserPlus } from "lucide-react";

export default function NewAuthorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", bio: "", linkedinUrl: "", styleNotes: "" });

  async function submit() {
    if (!form.name) return;
    setLoading(true);
    try {
      const a = await createAuthorAction(form);
      toast({ title: "Author created", kind: "success" });
      router.push(`/authors/${a.id}`);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, kind: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-4 w-4 text-cyan-500" />
          <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Authors</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">New author</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Add someone to write in the voice of. The voice profile builds up from edits over time.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="CTO, Head of Sales, ..." />
          </Field>
          <Field label="LinkedIn URL">
            <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="Bio">
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="A sentence or two about what they do." />
          </Field>
          <Field label="Style notes (optional)">
            <Textarea
              value={form.styleNotes}
              onChange={(e) => setForm({ ...form, styleNotes: e.target.value })}
              placeholder="e.g. 'hates emojis', 'uses hashtags', 'short lines'..."
            />
          </Field>
          <div className="flex justify-end pt-1">
            <Button onClick={submit} disabled={loading || !form.name} size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "Creating…" : "Create author"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
