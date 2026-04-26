# Signal — Claude Session Primer

## What This App Does

Signal is a LinkedIn post generation SaaS for teams. It:
1. Ingests meeting transcripts (manual paste, Fathom, Google Meet, LinkedIn)
2. Extracts high-value moments ("signals") using Claude
3. Generates LinkedIn posts in each author's learned voice using post structure frameworks
4. Scores, refines, and learns from every edit and published post's performance
5. Hands approved posts to designers via generated briefs + SVG mockups

Core innovation: **auto-learning voice**. Every manual or AI-assisted edit is stored and fed back into Claude to improve the next draft. The system gets smarter over time per author.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router, React 18, TypeScript 5.7 |
| Database | Neon PostgreSQL (serverless) + Drizzle ORM 0.36 |
| AI | Anthropic SDK (`claude-sonnet-4-6`) |
| Auth | Custom cookie-based (NOT NextAuth) |
| Styling | Tailwind CSS 3.4 + Radix UI + shadcn-style components |
| Email | SendGrid HTTP API |
| Integrations | Fathom (video), LinkedIn OAuth, Google Drive/Meet |

---

## Project Structure

```
app/
  api/
    auth/          login, logout, me
    cron/          fathom-sync, linkedin-sync, google-sync, cleanup-archived
    fathom/        webhook, oauth callback
    linkedin/      oauth callback
    google/        oauth callback
    invite/        validate token, complete registration
  signals/         Signal listing + filtering (grouped by meeting)
  posts/[id]/      Post editor (approve, reject, refine, design brief)
  drafts/          User's own posts awaiting review
  authors/         Author management
  frameworks/      Post structure templates
  analytics/       Performance dashboard
  settings/        User settings
  login/           Login page
  invite/          Invite acceptance page
  page.tsx         Dashboard (root after login)
  layout.tsx       Root layout

lib/
  claude.ts        ALL Claude prompts (~2600 lines) — every AI call lives here
  actions.ts       ALL server actions (~2000 lines) — every mutation lives here
  db/
    schema.ts      13 Drizzle table definitions
    index.ts       Drizzle + Neon client instance
  session.ts       getCurrentUser() — cached, role-aware
  auth.ts          Superadmin email constant, token hashing
  fathom.ts        Fathom API (token refresh, meetings, transcripts)
  linkedin.ts      LinkedIn OAuth, token refresh, posts fetch
  google.ts        Google OAuth, token refresh, Meet transcripts
  email.ts         SendGrid invite emails
  password.ts      scryptSync hash + verify
  utils.ts         Shared helpers

components/
  ui/              Primitive components (button, badge, card, dialog, toast…)
  sidebar.tsx      Role-aware navigation
  shell.tsx        Page wrapper
  team-manager.tsx User management UI

middleware.ts      Protects all routes; public: /login, /invite, /api/auth, /api/fathom/webhook
scripts/seed.ts    Seeds default frameworks + example author
```

---

## Database Schema (13 Tables)

| Table | Purpose |
|-------|---------|
| `transcripts` | Raw meeting transcript text + source metadata |
| `signals` | Extracted content moments; has scores + status |
| `authors` | People the AI writes for; stores voice profile, OAuth tokens, performance hints |
| `contentAngles` | Global topic tag pool |
| `authorContentAngles` | Many-to-many: authors ↔ content angles |
| `frameworks` | Post structure templates (Hook·Story·Lesson, BAB, etc.) |
| `posts` | Generated posts; has status lifecycle + scores |
| `edits` | Every before/after edit pair (manual or assisted) per post/signal |
| `analytics` | Impressions, likes, comments, shares, clicks per post |
| `designBriefs` | Design brief + 1080×1080 SVG per approved post |
| `users` | Team members with role (superadmin/admin/user) |
| `sessions` | Login sessions — one active per email |
| `authTokens` | Invite tokens (one-time use) |
| `oauthStates` | CSRF state for OAuth flows (fathom/linkedin/google) |

**Post status lifecycle:** `draft` → `in_review` → `approved` / `rejected` → `published`

**Signal status lifecycle:** `unused` → `drafting` → `used` / `archived`

---

## Authentication & Roles

- Cookies: `signal_auth` (httpOnly session token) + `signal_email` (normalized)
- Single session per email — old sessions deleted on login
- Hardcoded superadmin: `moh.awwad243@gmail.com`
- Env var `ALLOWED_EMAILS` — comma-separated emails that get superadmin role
- `AUTH_SECRET` — shared password for env admins (bypasses DB password check)
- DB users have `role` (admin/user) + optional `authorId`

**Role access:**

| Role | How identified | What they see |
|------|---------------|---------------|
| **superadmin** | hardcoded email or `ALLOWED_EMAILS` env | Everything; TeamManager on /authors (no author cards) |
| **admin** | `users.role = 'admin'` | Their own authors + invited users' authors; signals, drafts, frameworks |
| **user** | `users.role = 'user'` | Only /drafts (their posts) + /authors (themselves only) |

Session object from `lib/session.ts → getCurrentUser()`:
```ts
{ email, role, authorId, isAdmin, isSuperAdmin }
```

---

## The Two Pillars: claude.ts & actions.ts

### `lib/claude.ts` — All AI Calls

Every function calls the Anthropic SDK directly. All prompts live here — never scatter API calls elsewhere.

| Function | What it does | Temp | Max tokens |
|----------|-------------|------|-----------|
| `generatePostsFromTranscript()` | Mines transcript → up to 5 signals with matched authors/angles | 0.7 | 4000 |
| `generatePost()` | Signal + voice + framework → full LinkedIn post | 0.85 | 1500 |
| `scorePost()` | Returns JSON scores: hookStrength, specificity, clarity, emotionalResonance, callToAction (0–100) | 0.2 | 600 |
| `refinePost()` | Final quality pass: fix weak hooks, remove AI phrases, vary sentence length | 0.5 | 2000 |
| `assistedEdit()` | User instruction → AI edits post preserving voice | 0.7 | 2000 |
| `learnVoiceFromEdits()` | Before/after edit pairs → 5–10 voice rule bullets | 0.3 | 1000 |
| `learnFromPerformance()` | Top posts → 6–12 hook/angle/structure patterns | 0.3 | 1000 |
| `reformatPostWithFramework()` | Restructures content to match framework template | 0.5 | 2000 |
| `generateDesignBrief()` | Returns JSON: objective, audience, tone, keyMessages, designDirection, SVG | 0.7 | 5000 |
| `analyzeLinkedinPageContent()` | Profile scrape → contentAngles, preferredFrameworks, voiceProfile, styleNotes | 0.3 | 2000 |

**Key implementation details:**
- Retry logic: 3 attempts, 1s exponential backoff, skip on 4xx errors
- JSON parsing: regex extraction handles markdown code blocks around JSON
- Forbidden phrases: 100+ AI-sounding phrases explicitly blocked in generation prompts
- Supports Arabic/English mixed transcripts with contextual homophone handling
- Scoring is intentionally skeptical — most posts score 20–50, reserves 70+ for exceptional

### `lib/actions.ts` — All Business Logic

40+ server actions. No separate REST API layer — Next.js server actions handle everything.

Key patterns:
- `requireAuth()` — throws if not logged in
- `requireAdmin()` — throws if not admin/superadmin
- `revalidatePath()` called after every mutation
- Try-catch with `.catch(() => [])` for read queries

**Signal workflow:**
- `extractSignalsAction(transcript, meetingTitle?, meetingDate?)` — calls Claude, stores transcript, inserts signals, auto-scores each
- `createManualSignalAction(data)` — user manually adds signal
- `scoreSignalAction(id)` — re-score existing signal
- `archiveSignalAction(id)` / `deleteSignalPermanentlyAction(id)`

**Post workflow:**
- `generatePostAction(input)` — signal + author + framework → draft post with scores
- `updatePostContentAction(postId, newContent, instruction?)` — edit post, logs before/after
- `assistedEditAction(postId, instruction)` — AI-powered edit
- `submitForReviewAction(postId)` / `submitSignalDraftsForReviewAction(signalId)`
- `approvePostAction(postId)` — triggers voice + performance learning
- `rejectPostAction(postId, notes)` / `reopenPostAction(postId)`
- `markPublishedAction(postId, linkedinUrl?)` — mark published, record analytics
- `generateDesignBriefAction(postId)` — design brief + SVG

**Learning actions:**
- `learnFromPerformanceAction(authorId)` — re-analyze top 3–5 posts, update performance hints
- Voice learning fires automatically on `approvePostAction`

---

## API Routes

All in `app/api/`. Key routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Login (AUTH_SECRET for env admins, DB password for users) |
| `/api/auth/logout` | POST | Clear cookies |
| `/api/auth/me` | GET | Returns `{ name, isAdmin, isSuperAdmin }` for sidebar |
| `/api/invite/validate` | POST | Check if invite token is valid |
| `/api/invite/complete` | POST | Activate user, set password + author |
| `/api/linkedin/oauth/callback` | GET | LinkedIn connect |
| `/api/fathom/oauth/callback` | GET | Fathom connect |
| `/api/fathom/webhook` | POST | Fathom sends meeting transcript/metadata |
| `/api/google/oauth/callback` | GET | Google Meet connect |
| `/api/cron/fathom-sync` | POST | Sync meetings from Fathom for all authors |
| `/api/cron/linkedin-sync` | POST | Fetch post analytics from LinkedIn |
| `/api/cron/google-sync` | POST | Sync Google Meet transcripts |
| `/api/cron/cleanup-archived` | POST | Clean up old archived items |

---

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...           # Neon pooled connection string
ALLOWED_EMAILS=email1@...,email2@...  # Superadmin emails
AUTH_SECRET=...                       # Shared password for env admins
APP_BASE_URL=https://...              # Used for OAuth redirect URIs

# Fathom integration
FATHOM_CLIENT_ID=...
FATHOM_CLIENT_SECRET=...
FATHOM_AUTHORIZE_URL=...
FATHOM_TOKEN_URL=...
FATHOM_API_BASE_URL=...
FATHOM_WEBHOOK_SECRET=...
FATHOM_SCOPES=public_api

# LinkedIn integration
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...

# Google integration
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email
SENDGRID_API_KEY=...

# Optional
CRON_SECRET=...                       # Protects cron endpoints
```

---

## How to Run

```bash
npm install
cp .env.example .env.local            # Fill in required vars
npm run db:push                        # Create tables on Neon
npx tsx scripts/seed.ts               # Seed frameworks + example author
npm run dev                            # http://localhost:3000
```

```bash
npm run build     # drizzle-kit push --force && next build
npm run start     # Production server
npm run db:studio # Drizzle Studio (browser DB UI)
npm run lint      # ESLint
```

---

## Git Remotes & Deployment

```
origin    https://github.com/superwae/signal    (upstream — pull from here)
mohawwad  https://github.com/MohAwwad04/signal  (fork — push to here by default)
```

- **Deploy:** `npx vercel --prod` or `git push mohawwad main` (Vercel is linked to mohawwad fork)
- **Never push to `origin` (superwae/signal)** unless explicitly asked

---

## Key Conventions

- **No separate API layer** — use server actions in `actions.ts` for all mutations
- **All AI prompts** live in `claude.ts` — never scatter Anthropic API calls elsewhere
- **No alert/confirm/prompt** — use inline modals + toast system
- Toast: `toast({ title, description?, kind: "success"|"error"|"info" })`
- Server action naming: `*Action` suffix (e.g., `generatePostAction`)
- DB type inference: `typeof schema.posts.$inferSelect`
- Path alias: `@/*` maps to project root
- Server actions body limit: 5mb (set in `next.config.mjs`)
- Optimistic updates via `revalidatePath()` after every mutation

## User Invite Flow

1. Superadmin/admin adds user email in TeamManager → invite email sent (SendGrid)
2. User clicks link → `/invite?token=` → sets password + profile → auto-login → `/`
3. User (non-admin) lands on `/drafts` — sees posts assigned to their author for review
4. Admin generates posts from `/signals/[id]` → submits for review → user approves/rejects/edits at `/posts/[id]`
