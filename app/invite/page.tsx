"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, UserPlus, ArrowRight, KeyRound } from "lucide-react";

function InviteForm() {
  const token = useSearchParams().get("token") ?? "";
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [profile, setProfile] = useState({ name: "", bio: "", contentAngles: "", styleNotes: "" });

  function nextStep() {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError("");
    setStep(2);
  }

  async function submit() {
    if (!profile.name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/invite/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, ...profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      window.location.href = "/";
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {[1, 2].map((s) => (
            <div key={s} className={`h-1.5 w-12 rounded-full transition-colors ${step >= s ? "bg-cyan-500" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="h-4 w-4 text-cyan-500" />
                <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Step 1 of 2</span>
              </div>
              <CardTitle>Set your password</CardTitle>
              <CardDescription>You'll use this to sign in anytime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nextStep()}
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nextStep()}
                  placeholder="Repeat your password"
                />
              </Field>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end pt-1">
                <Button onClick={nextStep} disabled={!password || !confirm}>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="h-4 w-4 text-cyan-500" />
                <span className="text-xs font-semibold text-cyan-500 uppercase tracking-widest">Step 2 of 2</span>
              </div>
              <CardTitle>Set up your profile</CardTitle>
              <CardDescription>This becomes your voice — the AI learns from your edits over time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Name *">
                <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Jane Smith" />
              </Field>
              <Field label="Bio">
                <Textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="A sentence or two about what you do." />
              </Field>
              <Field label="Content preferences" hint="Topics you like to post about — comma separated">
                <Textarea
                  value={profile.contentAngles}
                  onChange={(e) => setProfile({ ...profile, contentAngles: e.target.value })}
                  placeholder="e.g. B2B sales, product launches, hiring lessons"
                  rows={2}
                />
              </Field>
              <Field label="Style notes" hint="How you like to write — Claude will follow these">
                <Textarea
                  value={profile.styleNotes}
                  onChange={(e) => setProfile({ ...profile, styleNotes: e.target.value })}
                  placeholder="e.g. no emojis, short punchy lines, no hashtags"
                  rows={2}
                />
              </Field>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={() => { setStep(1); setError(""); }}>Back</Button>
                <Button onClick={submit} disabled={loading || !profile.name.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {loading ? "Setting up…" : "Complete setup"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export default function InvitePage() {
  return <Suspense><InviteForm /></Suspense>;
}
