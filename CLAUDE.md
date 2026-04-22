# Signal — Claude Context

## What this is
LinkedIn post generation SaaS. Admins capture signals (key moments from meeting transcripts), generate LinkedIn posts from them via Claude, and manage authors whose voice the AI writes in.

## Stack
- Next.js 14 App Router (server components + server actions)
- Drizzle ORM + Neon PostgreSQL (serverless)
- Cookie-based auth (no NextAuth): `signal_auth` (hashed) + `signal_email`
- Claude API (`claude-sonnet-4-6`) for transcript extraction and post generation
- SendGrid HTTP API for invite emails
- Vercel deployment — use `npx vercel --prod` NOT `git push` (Vercel is linked to wrong repo)
- Push to git remote named `mohawwad` (MohAwwad04/signal), never `origin` (superwae/signal)

## Three-tier access control

| Role | How identified | What they see |
|------|---------------|---------------|
| **superadmin** | hardcoded email `moh.awwad243@gmail.com` or `ALLOWED_EMAILS` env | Everything; only TeamManager on /authors (no cards) |
| **admin** | `users.role = 'admin'` in DB | Their own authors + invited users' authors; signals, drafts, frameworks |
| **user** | `users.role = 'user'` in DB | Only /drafts (their posts to review), /authors (themselves only) |

Session object from `lib/session.ts → getCurrentUser()`:
```ts
{ email, role, authorId, isAdmin, isSuperAdmin }
```

## Key files

- `lib/session.ts` — `getCurrentUser()`, reads cookies, checks roles
- `lib/db/schema.ts` — all tables
- `lib/actions.ts` — all server actions (addUserAction, generatePostAction, etc.)
- `lib/password.ts` — `hashPassword` / `verifyPassword` using `crypto.scryptSync`
- `lib/email.ts` — `sendInviteEmail(to, token)` via SendGrid fetch
- `app/api/auth/login/route.ts` — login handler
- `app/api/auth/logout/route.ts` — clears cookies, redirects to /login
- `app/api/auth/me/route.ts` — returns `{ name, isAdmin, isSuperAdmin }` for sidebar
- `app/api/invite/validate/route.ts` — validates invite token
- `app/api/invite/complete/route.ts` — activates user, sets password + author
- `middleware.ts` — protects all routes except /login, /invite, /api/invite, /api/auth

## User flow
1. Superadmin/admin adds user email in TeamManager → invite email sent (SendGrid)
2. User clicks link → `/invite?token=` → sets password + profile → auto-login → `/`
3. User (non-admin) lands on `/drafts` — sees posts assigned to their author for review
4. Admin generates posts from `/signals/[id]` → submits for review → user approves/rejects/edits at `/posts/[id]`

## DB tables (key ones)
- `users` — email, role, passwordHash, active, authorId (FK→authors), invitedBy
- `authors` — name, role, bio, voiceProfile, styleNotes, contentAngles (jsonb), fathom/linkedin oauth fields
- `signals` — rawContent, recommendedAuthorId, status (unused/drafting/used/archived), source transcript
- `posts` — content, status (draft/in_review/approved/rejected/published), authorId, signalId, scores
- `edits` — before/after/instruction for each Claude edit (feeds voice profile)
- `authTokens` — invite tokens (uuid, email, expiresAt, usedAt)
- `contentAngles` — global angle tags linked to authors via jsonb array on authors

## Toast system
All user-facing messages use `toast()` from `components/ui/toaster.tsx`:
```ts
toast({ title: "...", description?: "...", kind: "success" | "error" | "info" })
```
No `alert()`, `confirm()`, or `window.prompt()` — these were replaced with inline UI patterns.

## Sidebar nav (role-aware)
- **Admin/superadmin**: Dashboard, Signals, Drafts, Authors, Analytics, Frameworks
- **Regular user**: Dashboard, My posts (/drafts), Profile (/authors)

## Deployment
```bash
cd /d/signal
npx vercel --prod
```
Never `git push origin` — origin points to superwae/signal which Vercel is NOT linked to.
