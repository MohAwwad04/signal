"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function SignalLogoLarge() {
  return (
    <svg width="52" height="52" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <circle cx="14" cy="15" r="10" fill="url(#sb2)" />
      <path d="M8 22 L6 27 L13 24" fill="url(#sb2)" />
      <rect x="10"   y="13"  width="1.8" height="4"   rx="0.9" fill="white" opacity="0.7" />
      <rect x="13"   y="11"  width="1.8" height="8"   rx="0.9" fill="white" />
      <rect x="16"   y="12"  width="1.8" height="6"   rx="0.9" fill="white" opacity="0.85" />
      <rect x="18.8" y="14"  width="1.8" height="2.5" rx="0.9" fill="white" opacity="0.55" />
      <path d="M25 6.5 L26 9.5 L29 10.5 L26 11.5 L25 14.5 L24 11.5 L21 10.5 L24 9.5 Z" fill="url(#cg2)" opacity="0.95" />
      <path d="M27 21.5 L27.7 24 L30 24.5 L27.7 25 L27 27.5 L26.3 25 L24 24.5 L26.3 24 Z" fill="url(#cg2)" opacity="0.7" />
      <defs>
        <linearGradient id="sb2" x1="4" y1="5" x2="24" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" /><stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="cg2" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
          <stop stopColor="#22D3EE" /><stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "Login failed");
      }
      router.push(search.get("next") || "/");
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(215,52%,7%)] p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyan-500/8 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4" style={{ animation: "float 3s ease-in-out infinite" }}>
            <div className="absolute inset-0 rounded-2xl bg-blue-500/25 blur-xl scale-110" />
            <SignalLogoLarge />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Signal</h1>
          <p className="text-sm text-blue-300/50 mt-1 tracking-widest uppercase text-[10px] font-medium">
            content automation
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 shadow-glow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-blue-200/40 mt-0.5">Sign in to your team workspace</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-blue-200/60 text-xs font-medium">Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="you@company.com"
                required
                className="bg-white/[0.06] border-white/10 text-white placeholder:text-blue-300/25 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-blue-200/60 text-xs font-medium">Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="bg-white/[0.06] border-white/10 text-white placeholder:text-blue-300/25 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : null
              }
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-blue-300/25 mt-6">
          Shared team access · Ask Wael for the password
        </p>
      </div>
    </div>
  );
}
