# LinkedIn Integration Setup

This guide walks you through creating a LinkedIn Developer app and configuring the Signal app to pull real analytics (likes, comments, impressions, shares) from LinkedIn posts.

---

## Step 1 — Create a LinkedIn Developer App

1. Go to **https://www.linkedin.com/developers/apps** and sign in.
2. Click **Create app**.
3. Fill in:
   - **App name**: Signal (or your company name)
   - **LinkedIn Page**: Your company LinkedIn page (required — create one if needed)
   - **App logo**: Any square image
4. Click **Create app**.

---

## Step 2 — Configure OAuth Redirect URLs

1. In your app, go to the **Auth** tab.
2. Under **OAuth 2.0 settings → Authorized redirect URLs**, add:
   ```
   https://signal-umber-ten.vercel.app/api/linkedin/oauth/callback
   ```
   (Replace the domain with your actual Vercel deployment URL if different.)
3. Save changes.

---

## Step 3 — Note Your Client ID and Secret

On the **Auth** tab, copy:
- **Client ID**
- **Client Secret**

You'll add these to Vercel environment variables in Step 6.

---

## Step 4 — Request Required API Products

By default, your app can only read basic profile info. To pull post analytics you need the **Community Management API** product.

1. Go to the **Products** tab in your LinkedIn app.
2. Find **Community Management API** and click **Request access**.
3. Fill in the use case form — describe that you're building an internal content analytics tool that reads analytics from posts made by your team members.
4. Submit and wait for LinkedIn to approve. This typically takes **2–5 business days**.

> **What works without approval:** The OAuth connection flow (connecting authors) and reading basic profile info will work immediately with `openid`, `profile`, and `email` scopes. Analytics sync requires approval.

> **Scopes requested during OAuth:** `openid profile email r_member_social`

---

## Step 5 — Verify App Settings

On the **Auth** tab, make sure the following OAuth 2.0 scopes are listed under your app:
- `openid`
- `profile`
- `email`
- `r_member_social` ← appears after Community Management API is approved

---

## Step 6 — Add Environment Variables to Vercel

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Value |
|---|---|
| `LINKEDIN_CLIENT_ID` | Your LinkedIn app Client ID |
| `LINKEDIN_CLIENT_SECRET` | Your LinkedIn app Client Secret |

The `APP_BASE_URL` variable should already be set. If not, add it:
| `APP_BASE_URL` | `https://signal-umber-ten.vercel.app` |

After adding variables, **redeploy** the project for them to take effect.

---

## Step 7 — Run the Database Migration

The LinkedIn integration adds new columns to the `authors` and `posts` tables. Run this from the `signal` project directory:

```bash
npx drizzle-kit push
```

This pushes the updated schema to your Neon database. Confirm when prompted.

---

## Step 8 — Connect an Author's LinkedIn Account

1. Go to **Authors → [Author name]** in the Signal app.
2. You'll see a new **LinkedIn integration** card.
3. Click **Connect LinkedIn**.
4. Authorize the app on LinkedIn.
5. You'll be redirected back with a success message.

---

## Step 9 — Link Published Posts to LinkedIn URLs

For analytics to sync, each published post needs its LinkedIn post URL saved:

**When marking a post as published:**
- On the post detail page, paste the LinkedIn post URL into the input field next to "Mark as published" before clicking the button.

**For already-published posts:**
- Open the post detail page.
- In the sidebar, find the **LinkedIn post URL** card.
- Paste the URL and click **Save URL**.

**What counts as a valid URL:**
```
https://www.linkedin.com/posts/username_keyword-activity-7234567890123456789-AbCd/
https://www.linkedin.com/feed/update/urn:li:activity:7234567890123456789/
https://www.linkedin.com/feed/update/urn:li:ugcPost:7234567890123456789/
```

---

## Step 10 — Sync Analytics

**Manual sync (per author):**
- Go to **Authors → [Author name]** → LinkedIn integration card → **Sync now**

**Manual sync (all authors at once):**
- Go to **Analytics** → click **Sync LinkedIn** in the top-right corner

**Automatic sync:**
- Runs daily at 9:00 AM UTC via Vercel Cron (configured in `vercel.json`)

---

## Troubleshooting

**"LinkedIn connection failed: token_exchange_failed"**
- Double-check the redirect URL in your LinkedIn app exactly matches the one in your Vercel deployment.

**Sync shows 0 posts synced**
- Make sure the author has published posts with LinkedIn URLs saved (Step 9).

**Impressions show 0 after sync**
- Impressions (`numImpressions`) require the Community Management API to be approved and active. Likes and comments will appear sooner.

**"LinkedIn not connected for this author"**
- The author's token may have expired. Go to the author page and reconnect.
