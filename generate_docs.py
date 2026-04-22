"""Generate a comprehensive PDF documentation for the Signal project."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
import datetime

OUTPUT = "Signal_Project_Documentation.pdf"

# ── Colors ──────────────────────────────────────────────────────────────────
DARK_BG   = colors.HexColor("#0f1117")
PRIMARY   = colors.HexColor("#6366f1")
CYAN      = colors.HexColor("#22d3ee")
TEXT      = colors.HexColor("#e2e8f0")
MUTED     = colors.HexColor("#94a3b8")
CODE_BG   = colors.HexColor("#1e2130")
BORDER    = colors.HexColor("#334155")
GREEN     = colors.HexColor("#4ade80")
YELLOW    = colors.HexColor("#fbbf24")
RED       = colors.HexColor("#f87171")

# ── Styles ───────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, **kw)

styles = {
    "title": S("title",
        fontSize=34, textColor=PRIMARY, spaceAfter=6,
        fontName="Helvetica-Bold", alignment=TA_CENTER, leading=40),
    "subtitle": S("subtitle",
        fontSize=15, textColor=MUTED, spaceAfter=24,
        fontName="Helvetica", alignment=TA_CENTER, leading=20),
    "h1": S("h1",
        fontSize=22, textColor=PRIMARY, spaceBefore=20, spaceAfter=8,
        fontName="Helvetica-Bold", leading=28),
    "h2": S("h2",
        fontSize=16, textColor=CYAN, spaceBefore=16, spaceAfter=6,
        fontName="Helvetica-Bold", leading=22),
    "h3": S("h3",
        fontSize=13, textColor=TEXT, spaceBefore=12, spaceAfter=4,
        fontName="Helvetica-Bold", leading=18),
    "h4": S("h4",
        fontSize=11, textColor=YELLOW, spaceBefore=10, spaceAfter=3,
        fontName="Helvetica-Bold", leading=16),
    "body": S("body",
        fontSize=10, textColor=TEXT, spaceAfter=6,
        fontName="Helvetica", leading=16, alignment=TA_JUSTIFY),
    "body_small": S("body_small",
        fontSize=9, textColor=MUTED, spaceAfter=4,
        fontName="Helvetica", leading=14),
    "code": S("code",
        fontSize=8, textColor=GREEN, spaceAfter=2,
        fontName="Courier", leading=12, backColor=CODE_BG,
        leftIndent=10, rightIndent=10, spaceBefore=2),
    "code_comment": S("code_comment",
        fontSize=8, textColor=MUTED, spaceAfter=0,
        fontName="Courier-Oblique", leading=12, backColor=CODE_BG,
        leftIndent=10, rightIndent=10),
    "label": S("label",
        fontSize=9, textColor=CYAN, spaceAfter=2,
        fontName="Helvetica-Bold", leading=13),
    "file_path": S("file_path",
        fontSize=10, textColor=YELLOW, spaceBefore=6, spaceAfter=2,
        fontName="Courier-Bold", leading=14),
    "bullet": S("bullet",
        fontSize=10, textColor=TEXT, spaceAfter=3,
        fontName="Helvetica", leading=15, leftIndent=16,
        bulletIndent=6),
    "toc_entry": S("toc_entry",
        fontSize=10, textColor=TEXT, spaceAfter=3,
        fontName="Helvetica", leading=14, leftIndent=0),
    "toc_sub": S("toc_sub",
        fontSize=9, textColor=MUTED, spaceAfter=2,
        fontName="Helvetica", leading=13, leftIndent=20),
}

def hr():
    return HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=8, spaceBefore=4)

def sp(h=8):
    return Spacer(1, h)

def h1(t):  return Paragraph(t, styles["h1"])
def h2(t):  return Paragraph(t, styles["h2"])
def h3(t):  return Paragraph(t, styles["h3"])
def h4(t):  return Paragraph(t, styles["h4"])
def p(t):   return Paragraph(t, styles["body"])
def ps(t):  return Paragraph(t, styles["body_small"])
def fp(t):  return Paragraph(t, styles["file_path"])
def lbl(t): return Paragraph(t, styles["label"])
def bul(t): return Paragraph(f"• {t}", styles["bullet"])

def code_block(lines):
    items = []
    for line in lines:
        stripped = line.rstrip()
        if not stripped:
            items.append(Spacer(1, 3))
        elif stripped.lstrip().startswith("//") or stripped.lstrip().startswith("#"):
            items.append(Paragraph(stripped.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;"),
                                   styles["code_comment"]))
        else:
            items.append(Paragraph(stripped.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;"),
                                   styles["code"]))
    return items

def info_table(rows):
    """2-col table: label | value"""
    data = [[Paragraph(k, styles["label"]), Paragraph(v, styles["body"])] for k, v in rows]
    t = Table(data, colWidths=[4*cm, 12*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), CODE_BG),
        ("GRID", (0,0), (-1,-1), 0.5, BORDER),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]))
    return t

def schema_table(columns):
    """Schema column table: name | type | notes"""
    header = [Paragraph(h, styles["label"]) for h in ["Column", "Type", "Notes"]]
    data = [header]
    for col in columns:
        data.append([Paragraph(c, styles["body_small"]) for c in col])
    t = Table(data, colWidths=[4.5*cm, 3.5*cm, 8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), PRIMARY),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("BACKGROUND", (0,1), (-1,-1), CODE_BG),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [CODE_BG, colors.HexColor("#161b2e")]),
        ("GRID", (0,0), (-1,-1), 0.5, BORDER),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
    ]))
    return t

# ── Page styling ──────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # top bar
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, h-3, w, 3, fill=1, stroke=0)
    # bottom line
    canvas.setFillColor(BORDER)
    canvas.rect(0, 1.5*cm-2, w, 1, fill=1, stroke=0)
    # page number
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(w/2, 0.8*cm, f"Signal Project Documentation  ·  Page {doc.page}")
    canvas.restoreState()

def on_first_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.restoreState()

# ── Build story ───────────────────────────────────────────────────────────────
story = []

# ════════════════════════════════════════════════════════════
# COVER PAGE
# ════════════════════════════════════════════════════════════
story += [
    sp(60),
    Paragraph("Signal", styles["title"]),
    Paragraph("Content Automation Platform", styles["subtitle"]),
    sp(10),
    Paragraph("Complete Technical Documentation", ParagraphStyle(
        "ctd", fontSize=13, textColor=MUTED, fontName="Helvetica",
        alignment=TA_CENTER, spaceAfter=4)),
    Paragraph(f"Generated {datetime.date.today().strftime('%B %d, %Y')}", ParagraphStyle(
        "date", fontSize=10, textColor=BORDER, fontName="Helvetica",
        alignment=TA_CENTER, spaceAfter=0)),
    sp(30),
    hr(),
    sp(10),
    Paragraph(
        "Turn meeting transcripts into LinkedIn posts that sound like you — "
        "with AI-powered drafting, voice learning, scoring, and analytics.",
        ParagraphStyle("tagline", fontSize=12, textColor=TEXT, fontName="Helvetica-Oblique",
                       alignment=TA_CENTER, leading=20)),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ════════════════════════════════════════════════════════════
story += [
    h1("Table of Contents"),
    hr(),
    sp(4),
]
toc = [
    ("1", "Project Overview & Architecture", [
        "Tech Stack", "Folder Structure", "Data Flow"]),
    ("2", "Configuration Files", [
        "package.json", "next.config.mjs", "drizzle.config.ts",
        "tailwind.config.ts", "tsconfig.json", "vercel.json", "postcss.config.mjs"]),
    ("3", "Middleware  (middleware.ts)", []),
    ("4", "Database Layer", [
        "lib/db/index.ts — Connection", "lib/db/schema.ts — Tables & Enums"]),
    ("5", "Library Modules", [
        "lib/utils.ts", "lib/claude.ts", "lib/fathom.ts", "lib/linkedin.ts"]),
    ("6", "Server Actions  (lib/actions.ts)", [
        "Signals", "Authors", "Frameworks", "Posts", "Design Briefs", "Analytics", "Dashboard"]),
    ("7", "App Pages (Next.js App Router)", [
        "Root Layout", "Dashboard", "Login", "Signals", "Authors", "Posts",
        "Analytics", "Frameworks"]),
    ("8", "API Routes", [
        "Auth", "Fathom OAuth & Sync", "LinkedIn OAuth & Sync", "Cron Jobs", "Webhooks"]),
    ("9", "Components", [
        "UI Primitives", "Layout (Shell, Sidebar)", "Feature Components"]),
    ("10", "Seed Script  (scripts/seed.ts)", []),
    ("11", "End-to-End Data Flow", []),
]
for num, title, subs in toc:
    story.append(Paragraph(f"<b>{num}.</b>  {title}", styles["toc_entry"]))
    for s in subs:
        story.append(Paragraph(f"– {s}", styles["toc_sub"]))
story += [PageBreak()]

# ════════════════════════════════════════════════════════════
# 1. PROJECT OVERVIEW
# ════════════════════════════════════════════════════════════
story += [
    h1("1. Project Overview & Architecture"),
    hr(),
    p("Signal is a full-stack content automation platform that turns meeting transcripts into "
      "polished LinkedIn posts. The system captures raw insights ('signals') from meetings, "
      "uses Claude AI to draft posts in each author's voice, scores them, iterates with "
      "assisted edits, and tracks post performance via LinkedIn analytics."),
    sp(6),
    h2("1.1  Tech Stack"),
    info_table([
        ("Framework",    "Next.js 14 (App Router) — server-side rendering + Server Actions"),
        ("Language",     "TypeScript 5.7 — strict mode throughout"),
        ("Database",     "Neon Postgres (serverless) via Drizzle ORM"),
        ("AI Engine",    "Anthropic Claude claude-sonnet-4-6 (claude.ts wraps every prompt)"),
        ("Auth",         "Cookie-based shared password (middleware.ts) + Allowlist emails"),
        ("Styling",      "Tailwind CSS 3 + custom shadcn-style UI components"),
        ("Integrations", "Fathom (meeting transcripts via OAuth) + LinkedIn (analytics via OAuth)"),
        ("Deploy",       "Vercel with 3 daily Cron Jobs defined in vercel.json"),
    ]),
    sp(10),
    h2("1.2  Folder Structure"),
    sp(4),
    *code_block([
        "D:/signal/",
        "├── app/                    ← Next.js App Router pages + API routes",
        "│   ├── layout.tsx          ← Root HTML shell (font, theme, sidebar)",
        "│   ├── page.tsx            ← Dashboard (stats + recent posts)",
        "│   ├── login/              ← Login page",
        "│   ├── signals/            ← Signal list, new, detail, archive",
        "│   ├── authors/            ← Author list + detail (OAuth cards)",
        "│   ├── posts/[id]/         ← Post editor + review workflow",
        "│   ├── analytics/          ← Performance dashboard",
        "│   ├── frameworks/         ← Post structure templates",
        "│   └── api/                ← REST API routes",
        "│       ├── auth/           ← Login / logout",
        "│       ├── fathom/         ← OAuth + sync + webhook",
        "│       ├── linkedin/       ← OAuth + analytics sync",
        "│       └── cron/           ← Daily automation jobs",
        "├── components/",
        "│   ├── ui/                 ← Button, Card, Badge, Input, Textarea, Toast…",
        "│   ├── shell.tsx           ← Page wrapper",
        "│   ├── sidebar.tsx         ← Navigation sidebar",
        "│   └── theme-provider.tsx  ← Dark/light mode context",
        "├── lib/",
        "│   ├── db/",
        "│   │   ├── index.ts        ← Neon + Drizzle client singleton",
        "│   │   └── schema.ts       ← All table definitions + TypeScript types",
        "│   ├── actions.ts          ← All Next.js Server Actions (the core logic)",
        "│   ├── claude.ts           ← Every Claude AI prompt lives here",
        "│   ├── fathom.ts           ← Fathom API client (OAuth refresh + meetings)",
        "│   ├── linkedin.ts         ← LinkedIn API client (OAuth refresh + metrics)",
        "│   └── utils.ts            ← cn(), formatDate(), timeAgo()",
        "├── scripts/",
        "│   └── seed.ts             ← One-time DB seed (frameworks + default author)",
        "├── middleware.ts           ← Auth gate for all routes",
        "├── drizzle.config.ts       ← Drizzle Kit config (schema path, DB URL)",
        "├── next.config.mjs         ← Next.js config (Server Actions body limit 5 MB)",
        "├── tailwind.config.ts      ← Custom theme (colors, shadows, animations)",
        "├── vercel.json             ← 3 Cron Job schedules",
        "└── package.json            ← Dependencies + npm scripts",
    ]),
    sp(10),
    h2("1.3  End-to-End Data Flow"),
    sp(4),
    p("The platform follows a linear pipeline from raw meeting content to published LinkedIn post:"),
    sp(4),
    *code_block([
        "Meeting Transcript (paste or Fathom webhook)",
        "        │",
        "        ▼",
        "  extractSignalsAction()  ─── Claude: generatePostsFromTranscript()",
        "        │  Creates rows in `signals` table (status: unused)",
        "        ▼",
        "  Signal Detail Page  ─── Author selects framework + content angle",
        "        │",
        "        ▼",
        "  generatePostAction()  ─── Claude: generatePost() → scorePost()",
        "        │  Creates row in `posts` table (status: draft)",
        "        │  Auto-retries once if both scores < 45",
        "        ▼",
        "  Post Editor  ─── Manual edits or assistedEditAction()",
        "        │  Every edit saved to `edits` table",
        "        │  After 2+ edits → learnVoiceFromEdits() updates author.voiceProfile",
        "        ▼",
        "  submitForReviewAction()  (status: in_review)",
        "        │",
        "        ▼",
        "  approvePostAction() / rejectPostAction()",
        "        │",
        "        ▼",
        "  generateDesignBriefAction()  ─── Claude: SVG mock + brief",
        "        │",
        "        ▼",
        "  markPublishedAction()  ─── Extracts LinkedIn URN from URL",
        "        │  Updates signal status → used",
        "        ▼",
        "  Daily Cron: linkedin-sync  ─── Pulls likes/comments/impressions",
        "        │  Inserts row in `analytics` table",
        "        ▼",
        "  Analytics Dashboard  ─── Performance by author and post",
    ]),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 2. CONFIGURATION FILES
# ════════════════════════════════════════════════════════════
story += [
    h1("2. Configuration Files"),
    hr(),

    h2("2.1  package.json"),
    p("Defines project metadata, dependencies, and npm scripts. Key scripts:"),
    info_table([
        ("npm run dev",          "Start Next.js development server"),
        ("npm run build",        "Run drizzle-kit push --force (sync schema to DB), then next build"),
        ("npm run db:push",      "Push Drizzle schema to Neon Postgres without generating migrations"),
        ("npm run db:studio",    "Launch Drizzle Studio (visual DB explorer)"),
        ("npx tsx scripts/seed.ts", "Seed initial frameworks and a default author"),
    ]),
    sp(6),
    p("<b>Key production dependencies:</b>"),
    bul("@anthropic-ai/sdk ^0.32.1 — Claude API client"),
    bul("@neondatabase/serverless ^0.10.4 — Neon HTTP driver (works in edge/serverless)"),
    bul("drizzle-orm ^0.36.4 — Type-safe SQL ORM"),
    bul("next 14.2.18 — App Router framework"),
    bul("@radix-ui/* — Accessible headless UI primitives (Dialog, Select, Tabs, Toast…)"),
    bul("zod ^3.24.1 — Runtime schema validation"),
    bul("lucide-react — Icon library"),
    sp(10),

    h2("2.2  next.config.mjs"),
    p("Minimal Next.js config with one important setting:"),
    *code_block([
        "experimental: {",
        "  serverActions: { bodySizeLimit: '5mb' }",
        "}",
    ]),
    p("The 5 MB body limit is raised to accommodate large meeting transcripts "
      "pasted directly into the extract-signals form (default is 1 MB)."),
    sp(10),

    h2("2.3  drizzle.config.ts"),
    p("Tells Drizzle Kit where to find the schema and how to connect to the database:"),
    info_table([
        ("schema",   "./lib/db/schema.ts — single source of truth for all tables"),
        ("out",      "./drizzle — migration files directory (not used in push mode)"),
        ("dialect",  "postgresql"),
        ("url",      "process.env.DATABASE_URL (Neon pooled connection string)"),
    ]),
    sp(10),

    h2("2.4  tailwind.config.ts"),
    p("Extends the default Tailwind theme with:"),
    bul("<b>Custom colors</b> — border, input, ring, background, foreground, primary, secondary, "
        "destructive, muted, accent, card, cyan — all driven by CSS variables (HSL) for "
        "light/dark theming."),
    bul("<b>Border radius scale</b> — sm/md/lg/xl/2xl all computed from a single --radius CSS variable."),
    bul("<b>Font family</b> — Inter loaded from Google Fonts, assigned to var(--font-inter)."),
    bul("<b>Custom shadows</b> — glow, glow-sm, glow-cyan, inner-glow for neon-style effects."),
    bul("<b>Custom animations</b> — glow-pulse, shimmer, slide-up, fade-in, sparkle, float "
        "(all defined as keyframes and mapped to animation classes)."),
    bul("Plugin: tailwindcss-animate for enter/exit transition utilities."),
    sp(10),

    h2("2.5  tsconfig.json"),
    p("Standard Next.js TypeScript config with:"),
    info_table([
        ("target", "ES2020"),
        ("strict", "true — all strict checks enabled"),
        ("moduleResolution", "bundler — modern resolution for Next.js 14"),
        ("paths", "@/* → ./* — absolute imports from project root"),
        ("jsx", "preserve — Next.js handles JSX transform"),
    ]),
    sp(10),

    h2("2.6  vercel.json — Cron Jobs"),
    p("Defines three daily automated tasks that run on Vercel's cron infrastructure:"),
    schema_table([
        ["Path", "Schedule", "Purpose"],
        ["/api/cron/fathom-sync", "0 8 * * *  (8 AM UTC)", "Sync all connected authors' Fathom meetings"],
        ["/api/cron/linkedin-sync", "0 9 * * *  (9 AM UTC)", "Sync LinkedIn post analytics for all authors"],
        ["/api/cron/cleanup-archived", "0 3 * * *  (3 AM UTC)", "Delete archived signals older than 7 days"],
    ]),
    sp(10),

    h2("2.7  postcss.config.mjs"),
    p("Standard PostCSS config: runs tailwindcss plugin then autoprefixer for vendor prefixes."),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 3. MIDDLEWARE
# ════════════════════════════════════════════════════════════
story += [
    h1("3. Middleware  (middleware.ts)"),
    hr(),
    p("Runs on every request via the Next.js Edge Runtime. Acts as the authentication gate "
      "for the entire application."),
    sp(6),
    h2("3.1  How It Works"),
    p("1. <b>Public path check</b> — a hard-coded list of paths that never require auth:"),
    *code_block([
        "const PUBLIC_PATHS = [",
        "  '/login', '/api/auth/login',",
        "  '/api/fathom/webhook', '/api/fathom/oauth/callback',",
        "  '/api/linkedin/oauth/callback', '/api/cron',",
        "]",
    ]),
    p("2. <b>Static asset bypass</b> — /_next/* and /favicon are always allowed through."),
    p("3. <b>Cookie check</b> — reads the <b>signal_auth</b> cookie and compares it against "
      "a hash of the AUTH_SECRET environment variable using hashToken()."),
    p("4. <b>Dev mode</b> — if AUTH_SECRET is not set, all traffic is allowed (useful for local development)."),
    p("5. <b>Redirect</b> — unauthenticated requests are redirected to /login?next=<original_path>."),
    sp(6),
    h2("3.2  hashToken() Function"),
    *code_block([
        "function hashToken(s: string) {",
        "  let h = 5381;",
        "  for (let i = 0; i < s.length; i++)",
        "    h = ((h << 5) + h) ^ s.charCodeAt(i);",
        "  return `h_${(h >>> 0).toString(36)}`;",
        "}",
    ]),
    p("This is a djb2-style hash — fast, deterministic, and Edge Runtime compatible "
      "(no crypto module needed). It is NOT security-grade; it is lightweight obfuscation "
      "suitable for a small-team internal tool."),
    sp(6),
    h2("3.3  Matcher Config"),
    *code_block([
        "export const config = {",
        "  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],",
        "}",
    ]),
    p("Runs on all paths EXCEPT Next.js static assets and image optimisation routes."),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 4. DATABASE LAYER
# ════════════════════════════════════════════════════════════
story += [
    h1("4. Database Layer"),
    hr(),

    h2("4.1  lib/db/index.ts — Connection"),
    p("Creates a singleton Drizzle + Neon client. Uses a global variable in development "
      "to avoid creating a new connection on every hot-reload:"),
    *code_block([
        "const sql = global.__sqlClient ?? neon(process.env.DATABASE_URL ?? 'postgres://placeholder');",
        "if (process.env.NODE_ENV !== 'production') global.__sqlClient = sql;",
        "export const db = drizzle(sql, { schema });",
    ]),
    p("The neon() driver communicates over HTTP rather than a persistent TCP connection, "
      "making it compatible with Vercel serverless functions."),
    sp(10),

    h2("4.2  lib/db/schema.ts — Tables & Enums"),
    p("Defines the complete database schema using Drizzle ORM's type-safe table builders. "
      "All types are inferred and exported for use throughout the app."),
    sp(6),

    h3("Enums"),
    *code_block([
        "signalStatus: 'unused' | 'drafting' | 'used' | 'archived'",
        "postStatus:   'draft'  | 'in_review' | 'approved' | 'rejected' | 'published'",
    ]),
    sp(6),

    h3("Table: signals"),
    p("Stores raw content extracted from meeting transcripts — the starting point of every post."),
    schema_table([
        ["id", "serial PK", "Auto-increment primary key"],
        ["rawContent", "text NOT NULL", "The extracted post or insight text"],
        ["contentType", "varchar(64)", "Category: post, success_metric, quote, etc."],
        ["vertical", "varchar(64)", "Industry vertical (optional)"],
        ["source", "varchar(64)", "Origin: manual, fathom, fireflies"],
        ["sourceMeetingId", "varchar(128)", "External meeting ID from source system"],
        ["sourceMeetingTitle", "text", "Human-readable meeting title"],
        ["sourceMeetingDate", "timestamp", "When the meeting occurred"],
        ["speaker", "varchar(128)", "Who said it (from transcript)"],
        ["contentAngles", "jsonb[]", "List of suggested content angles"],
        ["recommendedAuthorId", "integer", "FK → authors.id (AI recommendation)"],
        ["status", "signalStatus", "Lifecycle: unused → drafting → used / archived"],
        ["notes", "text", "Free-form notes"],
        ["archivedAt", "timestamp", "Set when archived; used for 7-day cleanup"],
        ["createdAt", "timestamp", "Auto-set on insert"],
    ]),
    sp(8),

    h3("Table: authors"),
    p("People whose LinkedIn voice the system writes in. "
      "Stores both profile data and OAuth tokens for Fathom + LinkedIn."),
    schema_table([
        ["id", "serial PK", ""],
        ["name", "varchar(128)", "Full name"],
        ["role", "varchar(128)", "Job title (used to match signals to authors)"],
        ["bio", "text", "Background used in generation prompts"],
        ["linkedinUrl", "text", "Profile URL (informational)"],
        ["voiceProfile", "text", "Auto-learned writing style rules (updated by Claude)"],
        ["styleNotes", "text", "Manual style guardrails set by user"],
        ["preferredFrameworks", "jsonb[]", "Array of framework IDs"],
        ["contentAngles", "jsonb[]", "Topics/themes this author posts about"],
        ["active", "boolean", "Soft-delete flag"],
        ["fathomAccessToken", "text", "OAuth 2.0 access token for Fathom API"],
        ["fathomRefreshToken", "text", "Used to refresh when access token expires"],
        ["fathomTokenExpiresAt", "timestamp", "Expiry of Fathom access token"],
        ["fathomUserId / Email", "varchar", "Fathom account identity"],
        ["linkedinAccessToken", "text", "OAuth 2.0 access token for LinkedIn API"],
        ["linkedinRefreshToken", "text", "Used to refresh when access token expires"],
        ["linkedinTokenExpiresAt", "timestamp", "Expiry of LinkedIn access token"],
        ["linkedinMemberId/Name", "varchar", "LinkedIn account identity"],
    ]),
    sp(8),

    h3("Table: frameworks"),
    p("Reusable post structures. Each framework is a named prompt template that Claude "
      "follows when writing or reformatting a post."),
    schema_table([
        ["id", "serial PK", ""],
        ["name", "varchar(128)", "Display name: Hook·Story·Lesson, Data Drop, etc."],
        ["description", "text", "Short plain-text description"],
        ["promptTemplate", "text", "The actual prompt fragment injected into Claude calls"],
        ["bestFor", "jsonb[]", "Signal content types this framework works well with"],
    ]),
    sp(8),

    h3("Table: posts"),
    p("A generated (and possibly edited) LinkedIn post. One post per signal/author/framework combination."),
    schema_table([
        ["id", "serial PK", ""],
        ["signalId", "integer FK", "→ signals.id (SET NULL on delete)"],
        ["authorId", "integer FK", "→ authors.id (SET NULL on delete)"],
        ["frameworkId", "integer FK", "→ frameworks.id (SET NULL on delete)"],
        ["contentAngle", "text", "The specific angle used for this post"],
        ["content", "text", "Current post text (may be edited)"],
        ["originalContent", "text", "First Claude draft — never overwritten, used for edit diff"],
        ["hookStrengthScore", "integer 0-100", "Hook quality score from Claude scoring"],
        ["specificityScore", "integer 0-100", "Specificity/credibility score"],
        ["status", "postStatus", "Lifecycle status"],
        ["reviewerNotes", "text", "Notes from approver or reviewer"],
        ["scheduledFor", "timestamp", "Planned publish time (informational)"],
        ["publishedAt", "timestamp", "Set when marked published"],
        ["linkedinPostUrn", "varchar(256)", "LinkedIn URN for analytics sync"],
        ["createdAt / updatedAt", "timestamp", "Audit timestamps"],
    ]),
    sp(8),

    h3("Table: edits"),
    p("Audit log of every change to a post or signal. Used as training data for Claude to "
      "learn each author's voice profile."),
    schema_table([
        ["id", "serial PK", ""],
        ["postId", "integer FK", "→ posts.id (CASCADE delete)"],
        ["signalId", "integer FK", "→ signals.id (CASCADE delete)"],
        ["authorId", "integer FK", "→ authors.id"],
        ["before", "text", "Text before the edit"],
        ["after", "text", "Text after the edit"],
        ["editType", "varchar(32)", "manual | assisted:<instruction_prefix>"],
        ["instruction", "text", "The instruction given for assisted edits"],
    ]),
    sp(8),

    h3("Table: analytics"),
    p("Performance metrics for published posts, pulled from LinkedIn or entered manually."),
    schema_table([
        ["id", "serial PK", ""],
        ["postId", "integer FK", "→ posts.id (CASCADE delete)"],
        ["impressions", "integer", "Total views"],
        ["likes", "integer", "Reaction count"],
        ["comments", "integer", "Comment count"],
        ["shares", "integer", "Repost count"],
        ["clicks", "integer", "Click count"],
        ["source", "varchar(32)", "manual | linkedin"],
        ["capturedAt", "timestamp", "When this analytics row was created"],
    ]),
    sp(8),

    h3("Table: designBriefs"),
    p("Claude-generated design briefs for approved posts. Includes an SVG mock."),
    schema_table([
        ["id", "serial PK", ""],
        ["postId", "integer FK", "→ posts.id (CASCADE delete)"],
        ["objective", "text", "Brief marketing objective"],
        ["targetAudience", "text", "Who this post is for"],
        ["tone", "text", "Tone descriptor"],
        ["keyMessages", "jsonb[]", "2-4 key messages"],
        ["designDirection", "text", "Layout, typography, imagery guidance"],
        ["svg", "text", "A valid 1080×1080 SVG mock of the carousel image"],
    ]),
    sp(8),

    h3("Table: authTokens"),
    p("Magic-link auth tokens. Stores email, hashed token, expiry, and used-at timestamp. "
      "Has a unique index on token for fast lookup."),
    sp(6),

    h3("Table: oauthStates"),
    p("CSRF protection for OAuth flows (Fathom and LinkedIn). A random state string is "
      "stored before redirecting to the provider; the callback verifies it matches. "
      "Has a unique index on state."),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 5. LIBRARY MODULES
# ════════════════════════════════════════════════════════════
story += [
    h1("5. Library Modules"),
    hr(),

    # ── utils.ts ──────────────────────────────────────────────
    h2("5.1  lib/utils.ts"),
    p("Tiny utility module with three exports:"),
    h4("cn(...inputs)"),
    p("Merges Tailwind CSS class names. Combines clsx (conditional class joining) with "
      "tailwind-merge (deduplication of conflicting Tailwind classes). Used everywhere in UI components."),
    *code_block([
        "export function cn(...inputs: ClassValue[]) {",
        "  return twMerge(clsx(inputs));",
        "}",
    ]),
    h4("formatDate(d)"),
    p("Formats a Date or ISO string as 'Apr 22, 2026' using the en-US locale."),
    h4("timeAgo(d)"),
    p("Returns a relative time string: 'just now', '5m ago', '3h ago', '2d ago', or falls "
      "back to formatDate() for dates older than 30 days."),
    sp(10),

    # ── claude.ts ─────────────────────────────────────────────
    h2("5.2  lib/claude.ts — AI Engine"),
    p("Central module for all Claude AI calls. Every prompt in the system lives here. "
      "Uses claude-sonnet-4-6 model."),
    sp(4),

    h3("Architecture: client() and textCall()"),
    p("<b>client()</b> — Creates a new Anthropic() instance, reading ANTHROPIC_API_KEY from env. "
      "Throws a clear error if the key is missing."),
    p("<b>textCall()</b> — Internal wrapper around anthropic.messages.create(). "
      "Takes system + user strings, maxTokens, and temperature. Returns the first text block."),
    p("<b>extractJson()</b> — Strips markdown code fences from Claude responses, then "
      "finds the first JSON object or array with a regex. Used for structured responses."),
    sp(6),

    h3("GLOBAL_RULES constant"),
    p("A system prompt preamble injected into every generation call. Key rules:"),
    bul("No fluff. No generic advice."),
    bul("Prioritize specific numbers, real outcomes, mistakes, lessons."),
    bul("Content must sound like real experience, not theory."),
    bul("Reject anything obvious, cliché, broad, or unverifiable."),
    bul("Prefer contrarian takes, measurable impact, strong opinions."),
    bul("If input is weak → fewer results or skip. Never fill with generic content."),
    sp(6),

    h3("generatePostsFromTranscript()"),
    p("Given a raw meeting transcript, extracts 1-3 ready-to-use LinkedIn posts. "
      "Builds the prompt dynamically with:"),
    bul("<b>anglesHint</b> — injects author content angles to focus extraction"),
    bul("<b>authorHint</b> — asks Claude to recommend which author role each post fits"),
    bul("<b>voiceHint</b> — injects learned voice profiles per role so drafts match each author"),
    p("Parses the output by splitting on 'POST N:' markers and extracting "
      "RECOMMENDED_FOR: [role] lines."),
    sp(6),

    h3("reformatPostWithFramework()"),
    p("Takes existing post content and a framework, and restructures the post to follow "
      "the framework's structure — preserving ALL original ideas, emojis, and hashtags."),
    sp(6),

    h3("generatePost()"),
    p("Generates a single post from a signal for a specific author + framework. "
      "Input includes:"),
    bul("signalRawContent — the raw signal text"),
    bul("contentAngle — specific angle to write about"),
    bul("author — name, role, bio, voiceProfile, styleNotes"),
    bul("framework — name and promptTemplate"),
    bul("topPerformingHooks — first lines of the author's top-liked past posts (for style continuity)"),
    p("Enforces strict rules: 120-220 words, no buzzwords, no hashtags, "
      "anchored to signal facts only."),
    sp(6),

    h3("assistedEdit()"),
    p("Applies a specific natural-language instruction to edit an existing post. "
      "Passes the author's voice profile to preserve their style. "
      "Returns only the edited post text."),
    sp(6),

    h3("scorePost()"),
    p("Scores a post on two dimensions (0-100 each):"),
    bul("<b>hook_strength</b> — do the first 1-2 lines stop a scroll? Specific/surprising = high; generic/corporate = low."),
    bul("<b>specificity</b> — does the post use concrete numbers, names, moments? Abstract = low."),
    p("Returns JSON with scores and a one-sentence feedback note. Uses temperature=0.2 for consistent scoring."),
    sp(6),

    h3("learnVoiceFromEdits()"),
    p("Given the current voice profile and a list of before/after edit pairs, "
      "produces an updated voice profile as 5-10 bullet-style rules (under 200 words). "
      "Merges with the existing profile and drops contradicted rules."),
    sp(6),

    h3("generateDesignBrief()"),
    p("Given post text and author name, returns a JSON design brief with:"),
    bul("objective, targetAudience, tone, keyMessages"),
    bul("designDirection — paragraph describing layout, typography, imagery"),
    bul("svg — a valid 1080×1080 SVG mock for the carousel image (3 colors max)"),
    sp(10),

    # ── fathom.ts ─────────────────────────────────────────────
    h2("5.3  lib/fathom.ts — Fathom Integration"),
    p("Handles all interaction with the Fathom meeting recording API."),
    sp(4),

    h3("getValidFathomToken(authorId)"),
    p("Retrieves a valid Fathom access token for an author. Logic:"),
    bul("1. Read current token from DB"),
    bul("2. If token expires more than 5 minutes from now → return it as-is"),
    bul("3. Otherwise → POST to FATHOM_TOKEN_URL with the refresh_token"),
    bul("4. On 401 → clear all Fathom tokens from DB (user must reconnect)"),
    bul("5. On 5xx → throw a transient error (tokens preserved for retry)"),
    bul("6. On success → update DB with new access_token and expiry, return new token"),
    sp(6),

    h3("fetchRecordingTranscript(token, recordingId)"),
    p("Internal helper. Fetches the transcript for a specific Fathom recording. "
      "Returns lines formatted as 'Speaker: text\\n...'. Falls back to empty string on error."),
    sp(6),

    h3("fetchFathomMeetings(token, limit=10)"),
    p("Fetches recent meetings from the Fathom API. For each meeting, fetches the full "
      "transcript via fetchRecordingTranscript(). Returns an array of FathomMeeting objects "
      "with id, title, date, and transcript."),
    sp(6),

    h3("fetchFathomUser(token)"),
    p("Infers the user's identity from the first meeting's recorded_by field "
      "(Fathom has no /user profile endpoint)."),
    sp(10),

    # ── linkedin.ts ────────────────────────────────────────────
    h2("5.4  lib/linkedin.ts — LinkedIn Integration"),
    p("Handles OAuth token management and analytics fetching from the LinkedIn API."),
    sp(4),

    h3("getValidLinkedinToken(authorId)"),
    p("Same pattern as Fathom: checks expiry, refreshes via OAuth 2.0 refresh_token grant, "
      "clears tokens on 401, preserves on 5xx."),
    sp(6),

    h3("fetchLinkedinProfile(accessToken)"),
    p("Calls LinkedIn's OIDC /v2/userinfo endpoint. Returns { id: sub, name }."),
    sp(6),

    h3("extractLinkedinPostUrn(url)"),
    p("Parses a LinkedIn post URL into a URN string. Supports three URL formats:"),
    *code_block([
        "// Format 1: /feed/update/urn:li:activity:...",
        "// Format 2: /feed/update/urn:li:ugcPost:...",
        "// Format 3: /posts/username_...-activity-{numericId}-{hash}/",
        "//   → extracts numericId and builds urn:li:activity:{numericId}",
    ]),
    sp(6),

    h3("fetchLinkedinPostMetrics(accessToken, postUrn)"),
    p("Calls the LinkedIn REST socialMetadata endpoint. Requires r_member_social scope "
      "(Community Management API). Returns likes, comments, shares, impressions. "
      "Returns null on error rather than throwing."),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 6. SERVER ACTIONS
# ════════════════════════════════════════════════════════════
story += [
    h1("6. Server Actions  (lib/actions.ts)"),
    hr(),
    p("All mutations go through Next.js Server Actions — no separate API layer for internal calls. "
      "Every action is marked 'use server' and called directly from Client or Server components. "
      "Each action calls revalidatePath() to invalidate the Next.js cache for affected routes."),
    sp(8),

    h2("6.1  Signals"),

    h3("extractSignalsAction(transcript, meetingTitle?, meetingDate?)"),
    p("The primary entry point. Orchestrates the full extract pipeline:"),
    bul("Validates transcript is at least 100 chars"),
    bul("Fetches all active authors (roles + contentAngles + voiceProfiles)"),
    bul("Calls generatePostsFromTranscript() with the transcript + author context"),
    bul("Maps each generated post to a signal row, matching recommendedAuthorRole to an author ID"),
    bul("Inserts all signals in one DB call"),
    bul("Invalidates /signals and / cache"),
    sp(6),

    h3("updateSignalContentAction(id, content)"),
    p("Saves a manual edit to a signal's rawContent. Side effects:"),
    bul("Records the edit in the edits table (if signal has a recommendedAuthorId)"),
    bul("If the author has 2+ edits → triggers learnVoiceFromEdits() to update their voice profile"),
    sp(6),

    h3("createSignalAction(input)"),
    p("Creates a single signal manually (for use in the 'new signal' form without a transcript)."),
    sp(6),

    h3("applyFrameworkToSignalAction(content, frameworkId)"),
    p("Reformats a signal's content using a framework's prompt template. Returns the new text "
      "(does NOT save it — the UI calls updateSignalContentAction separately)."),
    sp(6),

    h3("archiveSignalAction(id) / deleteSignalPermanentlyAction(id) / restoreSignalAction(id)"),
    p("Lifecycle management: archive sets status='archived' + archivedAt timestamp. "
      "Delete permanently removes the row. Restore sets status='unused' + clears archivedAt."),
    sp(10),

    h2("6.2  Authors"),

    h3("createAuthorAction(input)"),
    p("Creates a new author with name, role, bio, linkedinUrl, and styleNotes."),
    sp(4),

    h3("updateAuthorAction(id, patch)"),
    p("Partial update of any author fields (name, role, bio, linkedinUrl, styleNotes, active)."),
    sp(4),

    h3("updateAuthorContentAnglesAction(authorId, angles)"),
    p("Replaces the author's content angles list. Validates at least one angle is provided."),
    sp(10),

    h2("6.3  Frameworks"),

    h3("createFrameworkAction(input)"),
    p("Creates a new post structure framework with name, description, promptTemplate, and bestFor list."),
    sp(10),

    h2("6.4  Posts"),

    h3("generatePostAction(input)"),
    p("Core generation pipeline:"),
    bul("1. Load signal, author, and framework from DB"),
    bul("2. Fetch author's top 3 published posts by likes — extract first lines as topHooks"),
    bul("3. Call generatePost() → scorePost()"),
    bul("4. If hookStrength < 45 OR specificity < 45 → regenerate and keep the better draft"),
    bul("5. Insert post row with scores"),
    bul("6. Update signal status to 'drafting'"),
    sp(6),

    h3("updatePostContentAction(postId, newContent, instruction?)"),
    p("Saves a manual or assisted edit. Full side-effect chain:"),
    bul("Update posts.content + posts.updatedAt"),
    bul("Insert into edits table (type: 'manual' or 'assisted:<instruction>')"),
    bul("Re-score the new content → update hookStrengthScore + specificityScore"),
    bul("Fetch last 5 edits for this author → call learnVoiceFromEdits() → update voiceProfile"),
    sp(6),

    h3("assistedEditAction(postId, instruction)"),
    p("Calls assistedEdit() (Claude) with the current content + instruction + author voice. "
      "Then calls updatePostContentAction() to save + trigger all side effects."),
    sp(6),

    h3("submitForReviewAction / approvePostAction / rejectPostAction"),
    p("Status transitions. Approve accepts optional reviewer notes. Reject requires notes."),
    sp(6),

    h3("markPublishedAction(postId, linkedinUrl?)"),
    p("Sets status='published', publishedAt=now. If a LinkedIn URL is provided, "
      "calls extractLinkedinPostUrn() and stores the URN. Also updates the parent signal to 'used'."),
    sp(6),

    h3("setLinkedinPostUrlAction(postId, linkedinUrl)"),
    p("Saves/updates the LinkedIn URN for an already-published post. "
      "Throws if the URL can't be parsed into a valid URN."),
    sp(10),

    h2("6.5  Design Briefs"),

    h3("generateDesignBriefAction(postId)"),
    p("Idempotent — returns existing brief if one already exists. Otherwise calls "
      "generateDesignBrief() (Claude) and stores the result including the SVG mock."),
    sp(10),

    h2("6.6  Analytics"),

    h3("recordAnalyticsAction(postId, metrics)"),
    p("Manually records an analytics snapshot (impressions, likes, comments, shares, clicks) "
      "for a post. Source is set to 'manual'."),
    sp(10),

    h2("6.7  Dashboard"),

    h3("getDashboardStats()"),
    p("Runs 5 parallel DB queries and returns:"),
    bul("signalCounts — grouped by status"),
    bul("postCounts — grouped by status"),
    bul("authorCount — active authors only"),
    bul("recentPosts — 5 most recently updated"),
    bul("topAuthors — published post count per author"),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 7. APP PAGES
# ════════════════════════════════════════════════════════════
story += [
    h1("7. App Pages  (Next.js App Router)"),
    hr(),

    h2("7.1  Root Layout  (app/layout.tsx)"),
    p("The HTML shell for the entire application:"),
    bul("Loads Inter font from Google Fonts via next/font (assigned to --font-inter CSS var)"),
    bul("Sets page metadata (title, description, icons)"),
    bul("Renders dark mode HTML element (className='dark')"),
    bul("Wraps children in ThemeProvider → Shell → children"),
    bul("Adds a Toaster component at the root level for global toast notifications"),
    sp(10),

    h2("7.2  Dashboard  (app/page.tsx)"),
    p("Server component. Calls getDashboardStats() and renders:"),
    bul("Stat cards — unused signals, draft posts, in-review posts, published posts, active authors"),
    bul("Recent posts list — last 5 updated posts with status badges"),
    bul("Top authors by published post count"),
    sp(10),

    h2("7.3  Login  (app/login/page.tsx)"),
    p("Simple email + password form. On submit calls POST /api/auth/login. "
      "On success, redirects to the 'next' query param or to '/'."),
    sp(10),

    h2("7.4  Signals"),

    h3("app/signals/page.tsx"),
    p("Lists all signals with status !== 'archived'. Shows status badges, source, "
      "meeting title, date, and a link to the signal detail page. "
      "Includes quick-filter tabs (All / Unused / Drafting / Used)."),
    sp(4),

    h3("app/signals/new/page.tsx"),
    p("Two modes:"),
    bul("<b>Transcript mode</b> — paste a meeting transcript and call extractSignalsAction(). "
        "Shows extracted signals inline."),
    bul("<b>Manual mode</b> — fill a form and call createSignalAction() for a single signal."),
    sp(4),

    h3("app/signals/[id]/page.tsx"),
    p("Signal detail page. Shows:"),
    bul("Signal content with inline editing (calls updateSignalContentAction on blur)"),
    bul("Meeting metadata (title, date, source)"),
    bul("Recommended author"),
    bul("Generate Post form (choose author, framework, content angle)"),
    bul("List of posts already generated from this signal"),
    sp(4),

    h3("app/signals/[id]/post-editor.tsx"),
    p("Client component. Renders the signal's rawContent in a textarea. "
      "Provides an 'Apply Framework' button that calls applyFrameworkToSignalAction() "
      "and updates the textarea in place."),
    sp(4),

    h3("app/signals/[id]/generate-form.tsx"),
    p("Client component. Form with:"),
    bul("Author selector (dropdown of active authors)"),
    bul("Framework selector (dropdown of all frameworks)"),
    bul("Content angle input (text)"),
    bul("On submit → calls generatePostAction() → redirects to /posts/[id]"),
    sp(4),

    h3("app/signals/archive/page.tsx"),
    p("Lists archived signals. Shows archival date and age. "
      "Provides Restore and Delete Permanently buttons. "
      "Includes a note that signals are auto-deleted after 7 days."),
    sp(10),

    h2("7.5  Authors"),

    h3("app/authors/page.tsx"),
    p("Lists all authors with name, role, active status, "
      "and counts of posts per author (draft, published)."),
    sp(4),

    h3("app/authors/new/page.tsx"),
    p("Form to create a new author. Fields: name, role, bio, LinkedIn URL, style notes. "
      "Calls createAuthorAction() on submit."),
    sp(4),

    h3("app/authors/[id]/page.tsx"),
    p("Author detail page. Shows:"),
    bul("Editable profile fields (calls updateAuthorAction on change)"),
    bul("Voice Profile card — the AI-learned style rules (auto-updated from edits)"),
    bul("Content Angles component"),
    bul("Fathom integration card"),
    bul("LinkedIn integration card"),
    bul("Recent posts and edits from this author"),
    sp(4),

    h3("app/authors/[id]/linkedin-card.tsx"),
    p("LinkedIn OAuth integration UI. Shows:"),
    bul("Connected status with member name and last sync time"),
    bul("'Connect LinkedIn' button → calls /api/linkedin/oauth/initiate"),
    bul("'Sync now' button → calls /api/linkedin/sync/[authorId]"),
    bul("'Disconnect' button → calls /api/linkedin/oauth/disconnect"),
    sp(4),

    h3("app/authors/[id]/fathom-card.tsx"),
    p("Fathom OAuth integration UI. Same pattern as LinkedIn card. "
      "Also shows a list of recent meetings that can be individually synced."),
    sp(4),

    h3("app/authors/[id]/content-angles.tsx"),
    p("Editable tag-style list of content angles. "
      "Calls updateAuthorContentAnglesAction on save."),
    sp(10),

    h2("7.6  Posts  (app/posts/[id]/)"),

    h3("page.tsx"),
    p("Server component. Loads post + signal + author + framework + edits + design brief. "
      "Renders the Editor client component."),
    sp(4),

    h3("editor.tsx"),
    p("The most complex client component. Features:"),
    bul("Full-height textarea for editing the post content"),
    bul("<b>Scoring bar</b> — hook strength and specificity scores displayed as progress bars. "
        "Scores update after every save."),
    bul("<b>Assisted edit panel</b> — type an instruction, press Enter → calls assistedEditAction() → "
        "updates content + scores."),
    bul("<b>Status workflow buttons</b> — Submit for Review, Approve, Reject (with notes modal), "
        "Mark as Published (with LinkedIn URL input)."),
    bul("<b>Design Brief</b> — 'Generate Design Brief' button calls generateDesignBriefAction(). "
        "Shows SVG preview inline."),
    bul("<b>Version history</b> — shows the diff between originalContent and current content, "
        "plus a list of all edits with type and instruction."),
    bul("<b>Signal context</b> — collapsed sidebar showing the source signal text."),
    sp(10),

    h2("7.7  Analytics  (app/analytics/page.tsx)"),
    p("Performance dashboard with:"),
    bul("Total impressions, likes, comments, shares across all posts"),
    bul("Per-author breakdown"),
    bul("Post-level table with hook score, specificity score, and latest analytics"),
    bul("'Sync LinkedIn' button (calls sync-button.tsx client component)"),
    bul("Manual analytics entry form per post"),
    sp(4),

    h3("app/analytics/sync-button.tsx"),
    p("Client component button. On click → calls /api/linkedin/sync/all (or iterates per author) "
      "to pull fresh metrics from LinkedIn."),
    sp(10),

    h2("7.8  Frameworks  (app/frameworks/page.tsx)"),
    p("Lists all frameworks with name, description, and bestFor tags. "
      "Includes a 'New Framework' form (new-form.tsx) that calls createFrameworkAction()."),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 8. API ROUTES
# ════════════════════════════════════════════════════════════
story += [
    h1("8. API Routes  (app/api/)"),
    hr(),

    h2("8.1  Authentication"),

    h3("POST /api/auth/login"),
    p("Accepts { email, password } JSON body. Logic:"),
    bul("Validates email is in ALLOWED_EMAILS env var (comma-separated list)"),
    bul("Validates password matches AUTH_SECRET"),
    bul("Sets signal_auth cookie with hashToken(AUTH_SECRET) value, httpOnly, sameSite:lax"),
    bul("Returns 200 on success, 401 on wrong credentials, 400 on missing fields"),
    sp(4),

    h3("POST /api/auth/logout"),
    p("Clears the signal_auth cookie and redirects to /login."),
    sp(10),

    h2("8.2  Fathom OAuth & Sync"),

    h3("GET /api/fathom/oauth/initiate"),
    p("Starts the Fathom OAuth 2.0 authorization code flow:"),
    bul("Generates a random state string"),
    bul("Stores state + authorId + provider='fathom' in oauthStates table with 10-min expiry"),
    bul("Redirects to Fathom's authorization URL with state, client_id, redirect_uri, scopes"),
    sp(4),

    h3("GET /api/fathom/oauth/callback"),
    p("Handles the redirect from Fathom after user authorization:"),
    bul("Reads code + state from query params"),
    bul("Verifies state matches DB record and hasn't expired"),
    bul("Exchanges code for access + refresh tokens"),
    bul("Fetches Fathom user identity"),
    bul("Updates author row with tokens + fathomUserId + fathomConnectedAt"),
    bul("Redirects to /authors/[id]"),
    sp(4),

    h3("POST /api/fathom/oauth/disconnect"),
    p("Clears all Fathom token fields for the given author."),
    sp(4),

    h3("GET /api/fathom/sync/[authorId]"),
    p("Fetches recent Fathom meetings and extracts signals:"),
    bul("Calls getValidFathomToken() (refreshes if needed)"),
    bul("Fetches meetings via fetchFathomMeetings()"),
    bul("For each meeting with a transcript → calls generatePostsFromTranscript()"),
    bul("Deduplicates by sourceMeetingId to avoid re-processing same meeting"),
    bul("Inserts new signals, updates fathomLastSyncedAt"),
    sp(4),

    h3("POST /api/fathom/webhook"),
    p("Accepts meeting completion webhooks from Fathom. Validates x-webhook-secret header. "
      "Normalizes various Fathom payload shapes to extract transcript + title + date. "
      "Calls extractSignalsAction() with the extracted data."),
    sp(10),

    h2("8.3  LinkedIn OAuth & Sync"),

    h3("GET /api/linkedin/oauth/initiate"),
    p("Same pattern as Fathom initiate. Redirects to LinkedIn's OAuth authorization URL. "
      "Scopes requested: openid profile email r_member_social."),
    sp(4),

    h3("GET /api/linkedin/oauth/callback"),
    p("Exchanges authorization code for LinkedIn tokens. Fetches profile via fetchLinkedinProfile(). "
      "Stores linkedinAccessToken, linkedinRefreshToken, linkedinTokenExpiresAt, "
      "linkedinMemberId, linkedinMemberName, linkedinConnectedAt."),
    sp(4),

    h3("POST /api/linkedin/oauth/disconnect"),
    p("Clears all LinkedIn token fields for the given author."),
    sp(4),

    h3("GET /api/linkedin/sync/[authorId]"),
    p("Syncs LinkedIn post analytics for a single author:"),
    bul("Gets valid token via getValidLinkedinToken()"),
    bul("Queries posts table for this author's published posts that have a linkedinPostUrn"),
    bul("For each post → calls fetchLinkedinPostMetrics()"),
    bul("Inserts a new analytics row with source='linkedin'"),
    bul("Updates author.linkedinLastSyncedAt"),
    sp(10),

    h2("8.4  Cron Jobs  (run by Vercel)"),

    h3("GET /api/cron/fathom-sync  (daily 8 AM UTC)"),
    p("Loops over all authors with fathomAccessToken set and calls the Fathom sync logic "
      "for each. Continues on per-author errors (logs and skips)."),
    sp(4),

    h3("GET /api/cron/linkedin-sync  (daily 9 AM UTC)"),
    p("Loops over all authors with linkedinAccessToken set and calls the LinkedIn sync logic "
      "for each. Continues on per-author errors."),
    sp(4),

    h3("GET /api/cron/cleanup-archived  (daily 3 AM UTC)"),
    p("Permanently deletes signals where status='archived' AND archivedAt < NOW() - 7 days. "
      "Uses Drizzle's lt() operator to filter."),
    *code_block([
        "await db.delete(schema.signals).where(",
        "  and(",
        "    eq(schema.signals.status, 'archived'),",
        "    lt(schema.signals.archivedAt, sevenDaysAgo)",
        "  )",
        ");",
    ]),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 9. COMPONENTS
# ════════════════════════════════════════════════════════════
story += [
    h1("9. Components"),
    hr(),

    h2("9.1  UI Primitives  (components/ui/)"),
    p("Shadcn-style headless components built on Radix UI primitives with Tailwind styling. "
      "All accept className and use the cn() utility for class merging."),
    sp(4),
    schema_table([
        ["Component", "Based on", "Purpose"],
        ["button.tsx", "HTML button", "Primary, secondary, ghost, destructive variants via CVA"],
        ["card.tsx", "div", "Card, CardHeader, CardContent, CardFooter composable"],
        ["badge.tsx", "span", "Status badges with color variants"],
        ["input.tsx", "HTML input", "Styled text input"],
        ["textarea.tsx", "HTML textarea", "Styled textarea with auto-resize"],
        ["label.tsx", "Radix Label", "Form field labels"],
        ["dialog.tsx", "Radix Dialog", "Modal dialogs"],
        ["select.tsx", "Radix Select", "Dropdown selects"],
        ["tabs.tsx", "Radix Tabs", "Tab navigation"],
        ["toast.tsx", "Radix Toast", "Toast notification primitives"],
        ["toaster.tsx", "toast.tsx", "Renders active toasts as a fixed overlay"],
        ["dropdown-menu.tsx", "Radix DropdownMenu", "Contextual dropdown menus"],
    ]),
    sp(10),

    h2("9.2  Layout Components"),

    h3("components/shell.tsx"),
    p("Wrapper component that renders the Sidebar and a main content area. "
      "Adapts layout between mobile (stacked) and desktop (side-by-side)."),
    sp(6),

    h3("components/sidebar.tsx"),
    p("Fixed left navigation sidebar. Contains:"),
    bul("Signal logo + app name"),
    bul("Navigation links: Dashboard, Signals, Authors, Analytics, Frameworks"),
    bul("Each link highlights when its path is active (usePathname hook)"),
    bul("Bottom section: GitHub link or settings"),
    sp(6),

    h3("components/theme-provider.tsx"),
    p("Thin wrapper around next-themes ThemeProvider. "
      "Enables dark/light/system theme switching persisted in localStorage."),
    sp(10),

    h2("9.3  Feature Components"),
    p("Larger components embedded in specific pages:"),
    schema_table([
        ["Component", "Page", "Purpose"],
        ["post-editor.tsx", "/signals/[id]", "Signal content editing + framework apply"],
        ["generate-form.tsx", "/signals/[id]", "Author/framework/angle selection for generation"],
        ["editor.tsx", "/posts/[id]", "Full post editor with scoring, assisted edits, publish workflow"],
        ["linkedin-card.tsx", "/authors/[id]", "LinkedIn OAuth connect/disconnect/sync UI"],
        ["fathom-card.tsx", "/authors/[id]", "Fathom OAuth connect/disconnect/sync UI"],
        ["content-angles.tsx", "/authors/[id]", "Editable content angle tags"],
        ["sync-button.tsx", "/analytics", "Trigger LinkedIn analytics sync"],
        ["new-form.tsx", "/frameworks", "Create new framework form"],
    ]),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 10. SEED SCRIPT
# ════════════════════════════════════════════════════════════
story += [
    h1("10. Seed Script  (scripts/seed.ts)"),
    hr(),
    p("A one-time setup script run with: npx tsx scripts/seed.ts"),
    p("Skips gracefully if data already exists."),
    sp(6),
    h2("Seeded Frameworks (5 defaults)"),
    schema_table([
        ["Framework", "Best For", "Structure"],
        ["Hook · Story · Lesson",
         "quotes, buying signals, insights, lessons",
         "Hook → Specific story (3-5 lines) → Named lesson → Response invitation"],
        ["Before · After · Bridge",
         "success metrics, transformations",
         "Before state (concrete) → After state (concrete) → The one thing that changed it"],
        ["Counter-take",
         "technical insights, objections",
         "Common wisdom → Why it's wrong (with example) → Better rule. Under 140 words."],
        ["Data drop",
         "success metrics",
         "Single striking number → What it means → Why it matters → What it implies"],
        ["Quote carousel",
         "customer quotes",
         "Scene-setting → Indented quote → 2-sentence reflection. No CTA."],
    ]),
    sp(8),
    h2("Seeded Author (1 default)"),
    info_table([
        ("Name", "Wael Salameh"),
        ("Role", "Founder"),
        ("Bio", "Engineer turned founder. Writes like a technical person explaining things over coffee."),
        ("Style Notes", "Short lines. Specific numbers. No hashtags. No 'excited to share'."),
    ]),
    PageBreak(),
]

# ════════════════════════════════════════════════════════════
# 11. END-TO-END DATA FLOW SUMMARY
# ════════════════════════════════════════════════════════════
story += [
    h1("11. End-to-End Data Flow Summary"),
    hr(),
    p("This section traces a complete journey from transcript to published post."),
    sp(6),

    h3("Step 1 — Capture"),
    p("A user pastes a meeting transcript at /signals/new, or Fathom sends a webhook, "
      "or a daily Cron job syncs new meetings. The transcript enters extractSignalsAction()."),
    sp(4),

    h3("Step 2 — AI Extraction"),
    p("Claude reads the transcript and produces 1-3 draft posts. Each draft is matched to "
      "an author role based on content fit. Author voice profiles are injected to pre-style "
      "the drafts. Each draft becomes a signal row in the DB (status: unused)."),
    sp(4),

    h3("Step 3 — Signal Review"),
    p("The user sees the extracted signals at /signals. They can edit the rawContent inline, "
      "apply a framework to reshape the text, or click 'Generate Post'."),
    sp(4),

    h3("Step 4 — Post Generation"),
    p("generatePostAction() fetches signal + author + framework, pulls the author's top 3 "
      "performing hooks, and calls generatePost(). The result is scored by scorePost(). "
      "If scores are below 45, one retry is made automatically, and the better draft is kept. "
      "The post is saved with its scores (status: draft)."),
    sp(4),

    h3("Step 5 — Editing & Voice Learning"),
    p("The editor at /posts/[id] shows the draft and its scores. The user can:"),
    bul("Edit manually → updatePostContentAction() saves, re-scores, and updates voice profile"),
    bul("Give an instruction → assistedEditAction() asks Claude to apply the specific change"),
    p("After each edit, the edits table grows. Once 2+ edits exist, learnVoiceFromEdits() "
      "runs to distill writing patterns into the author's voiceProfile. This profile is "
      "injected into future generation calls, making each draft sound more like the author."),
    sp(4),

    h3("Step 6 — Review Workflow"),
    p("submitForReviewAction() moves the post to in_review. A reviewer can approve "
      "(with optional notes) or reject (with required notes). Rejected posts go back to the "
      "editor for revision."),
    sp(4),

    h3("Step 7 — Design Brief"),
    p("Once approved, generateDesignBriefAction() sends the post to Claude and gets back a "
      "structured brief + an SVG mock (1080×1080) for a designer to iterate on."),
    sp(4),

    h3("Step 8 — Publish"),
    p("markPublishedAction() sets status=published, records publishedAt, and stores the "
      "LinkedIn post URN extracted from the post URL. The parent signal moves to 'used'."),
    sp(4),

    h3("Step 9 — Analytics Loop"),
    p("Daily at 9 AM UTC, the linkedin-sync cron job calls fetchLinkedinPostMetrics() for "
      "every published post with a URN. Likes, comments, impressions, and shares are stored "
      "in the analytics table. The Analytics dashboard aggregates these by author and post. "
      "The top 3 posts by likes feed back into Step 4 as topPerformingHooks, creating a "
      "feedback loop that improves future posts over time."),
    sp(10),

    hr(),
    p("This completes the full documentation of the Signal project. Every file, table, "
      "function, and data flow has been documented above."),
    Paragraph(f"Generated by Claude Code on {datetime.date.today().strftime('%B %d, %Y')}",
              ParagraphStyle("footer", fontSize=9, textColor=MUTED,
                             fontName="Helvetica-Oblique", alignment=TA_CENTER, spaceAfter=0)),
]

# ── Build PDF ─────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm,
    rightMargin=2*cm,
    topMargin=2.5*cm,
    bottomMargin=2*cm,
    title="Signal Project Documentation",
    author="Claude Code",
    subject="Technical documentation for the Signal content automation platform",
)

doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
print(f"PDF generated: {OUTPUT}")
