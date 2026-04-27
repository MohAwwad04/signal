import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Radio, FileEdit, Zap, Sparkles, Brain, GitBranch, LogIn } from "lucide-react";

export default async function HomePage() {
  return (
    <div className="min-h-screen">

      {/* Sign in button */}
      <div className="fixed top-5 right-6 z-50">
        <Link href="/login">
          <Button variant="outline" size="sm" className="gap-2">
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Button>
        </Link>
      </div>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-20 md:px-10 md:pt-20 md:pb-28">

        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-cyan-500/8 blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[600px] rounded-full bg-violet-600/6 blur-[90px]" />
        </div>

        {/* Badge */}
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            AI-powered content automation
          </span>
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-3xl text-center text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Every meeting is a{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              LinkedIn post
            </span>
            <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-blue-400/0 via-cyan-400/60 to-blue-500/0" />
          </span>{" "}
          waiting to happen
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-center text-base text-muted-foreground leading-relaxed md:text-lg">
          Signal listens to your meetings, extracts the insights worth sharing,
          and turns them into polished LinkedIn posts — in your voice, automatically.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signals/new">
            <Button size="lg" className="gap-2 px-6">
              <Radio className="h-4 w-4" />
              Capture a signal
            </Button>
          </Link>
          <Link href="/drafts">
            <Button size="lg" variant="outline" className="gap-2 px-6">
              <FileEdit className="h-4 w-4" />
              View drafts
            </Button>
          </Link>
        </div>

        {/* ── Pipeline illustration ── */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-0 items-start">

            {/* Step 1 — Transcript */}
            <div className="relative">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15">
                    <Radio className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Meeting</span>
                </div>
                <div className="space-y-1.5">
                  {["Sarah: We cut churn by 40% after changing the onboarding flow.",
                    "John: The key was removing 3 steps from day-one setup.",
                    "Sarah: Users who hit the aha-moment in 5 min retained at 2×..."].map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${i === 0 ? "bg-blue-400" : i === 1 ? "bg-cyan-400" : "bg-blue-300"}`} />
                      <p className="text-[10px] leading-relaxed text-muted-foreground">{line}</p>
                    </div>
                  ))}
                  <div className="mt-2 flex items-start gap-2 opacity-40">
                    <div className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground">Mark: How did you measure...</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                  </div>
                  <span className="text-[9px] text-muted-foreground">3,241 chars</span>
                </div>
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 md:hidden">
                <ArrowDown />
              </div>
            </div>

            {/* Connector + AI badge (desktop) */}
            <div className="hidden md:flex flex-col items-center justify-center gap-2 pt-10 px-2">
              <div className="h-px w-full bg-gradient-to-r from-border via-blue-500/40 to-border" />
              <div className="flex items-center justify-center gap-2 -mt-3">
                <div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1">
                  <Sparkles className="h-3 w-3 text-blue-400" />
                  <span className="text-[10px] font-semibold text-blue-400">Claude AI</span>
                </div>
              </div>
            </div>

            {/* Step 2 — Signal extracted */}
            <div className="relative mt-4 md:mt-0">
              <div className="rounded-2xl border border-cyan-500/30 bg-card p-4 shadow-lg shadow-cyan-500/5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
                      <Zap className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Signal</span>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-400">unused</span>
                </div>
                <p className="text-[11px] font-semibold text-foreground/90 leading-snug mb-2">
                  How we cut churn 40% by redesigning day-one onboarding
                </p>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  We removed 3 friction steps from the onboarding flow. Users who hit their aha-moment in under 5 min retained at 2× the rate. The fix wasn't features — it was getting out of the way.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {["saas", "productgrowth", "retention"].map((tag) => (
                    <span key={tag} className="text-[9px] text-muted-foreground/60">#{tag}</span>
                  ))}
                </div>
                <div className="mt-2.5 grid grid-cols-5 gap-1">
                  {[82, 91, 78, 70, 65].map((v, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: signal → post */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:mt-8">

            {/* Step 3 — Generated Post */}
            <div className="rounded-2xl border border-violet-500/20 bg-card p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
                    <Brain className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Generated post</span>
                </div>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-semibold text-blue-400">draft</span>
              </div>
              <div className="space-y-2 text-[11px] leading-relaxed text-foreground/80">
                <p className="font-semibold">We lost customers not because of our product — but because of our onboarding.</p>
                <p className="text-muted-foreground">Then we ran an experiment: remove 3 steps from day-one setup.</p>
                <p className="text-muted-foreground">💡 Users who reached their aha-moment in under 5 minutes retained at <span className="text-foreground font-medium">2× the rate</span>.</p>
                <p className="text-muted-foreground">📊 Churn dropped 40% in the following quarter.</p>
                <p className="text-muted-foreground">The lesson: friction on day one is a silent killer. Get out of the way faster.</p>
                <p className="text-muted-foreground">What's the one step you'd remove from your onboarding if you had to?</p>
              </div>
              <div className="mt-3 text-[9px] text-muted-foreground/50">#saas #productgrowth #retention</div>
            </div>

            {/* Step 4 — LinkedIn preview */}
            <div className="rounded-2xl border border-emerald-500/20 bg-card p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                    <Send className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Published</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground">2d ago</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">live</span>
                </div>
              </div>
              {/* LinkedIn mock */}
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500" />
                  <div>
                    <p className="text-[10px] font-semibold">Sarah Chen</p>
                    <p className="text-[9px] text-muted-foreground">Head of Product · 2d</p>
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-foreground/70 line-clamp-3">
                  We lost customers not because of our product — but because of our onboarding. Then we ran an experiment...
                </p>
                <div className="mt-2.5 flex items-center gap-3 text-[9px] text-muted-foreground border-t border-border pt-2">
                  <span className="flex items-center gap-1">👍 <span className="font-semibold text-foreground">847</span></span>
                  <span>·</span>
                  <span>62 comments</span>
                  <span>·</span>
                  <span>34 reposts</span>
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                {[
                  { label: "Impressions", val: "12.4k" },
                  { label: "Likes", val: "847" },
                  { label: "Comments", val: "62" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                    <p className="text-[11px] font-bold text-foreground">{m.val}</p>
                    <p className="text-[8px] text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Signal ── */}
      <section className="px-6 pb-16 md:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-2 text-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Why Signal</span>
          </div>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight md:text-3xl">
            Built for people with insights,<br />
            <span className="text-muted-foreground font-normal">not time to write.</span>
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <Radio className="h-5 w-5" />,
                color: "blue",
                title: "Meetings are your content",
                body: "Every conversation has insights worth sharing. Signal automatically extracts the moments that actually qualify — decisions, lessons, counterintuitive outcomes. Never a blank page again.",
              },
              {
                icon: <Brain className="h-5 w-5" />,
                color: "violet",
                title: "Your voice, not AI slop",
                body: "Signal learns from every edit you make. The more you refine, the more it sounds like you — not a chatbot. Voice profiles are built silently in the background.",
              },
              {
                icon: <GitBranch className="h-5 w-5" />,
                color: "cyan",
                title: "Built for teams",
                body: "Multiple authors, one workspace. Admins review and approve before anything goes live. Full draft → review → publish pipeline with role-based access.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-glow-sm"
              >
                <div className={`mb-4 inline-flex rounded-xl p-2.5 ${
                  f.color === "blue" ? "bg-blue-500/10" : f.color === "violet" ? "bg-violet-500/10" : "bg-cyan-500/10"
                }`}>
                  <span className={
                    f.color === "blue" ? "text-blue-400" : f.color === "violet" ? "text-violet-400" : "text-cyan-400"
                  }>{f.icon}</span>
                </div>
                <h3 className="mb-2 text-sm font-semibold">{f.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

function ArrowDown() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="text-muted-foreground/40">
      <path d="M8 0v16M2 10l6 8 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

