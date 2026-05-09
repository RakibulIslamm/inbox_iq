# InboxIQ

AI email triage agent. Connects to your Gmail, classifies your inbox into categories with urgency scores, summarizes threads, extracts action items, and drafts replies.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict)
- **Tailwind v4** + **shadcn/ui** (`base-lyra` style on top of `@base-ui/react`)
- **Lucide** icons
- **Supabase** — Auth, Postgres, RLS
- **OpenRouter** (via the `openai` SDK with a custom `baseURL`) — model `deepseek/deepseek-v4-pro` (Phase 2+)
- **Gmail API** via `googleapis` (Phase 2+)
- **Stripe** for subscriptions (Phase 3+)
- **pnpm** for package management

## Phase status

| Phase | Status | Scope |
|---|---|---|
| 1 — Scaffold + Auth | ✅ | Supabase auth (magic link + Google), `/dashboard` middleware, DB schema, landing page |
| 2 — Gmail OAuth + ingestion | ✅ | Gmail OAuth (read-only), fetch + store last 50 emails, dashboard list view |
| 3 — AI classification + summaries | ✅ | Classifier agent (category / urgency / summary / action items / draft reply), filter chips, free-tier 10/day quota |
| 4 — Daily summary + Stripe | ⏳ | Daily summary view, Stripe paywall (Free vs Pro $19/mo) |

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Once provisioned, open **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (sensitive — server-side only)

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in the Supabase values. The OpenRouter / Google / Stripe vars can stay empty for Phase 1.

### 4. Run the DB migrations

In the Supabase dashboard → **SQL Editor** → **New query**, run each migration in order:
1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — base schema (4 tables + RLS + triggers)
2. [`supabase/migrations/0002_gmail_emails.sql`](supabase/migrations/0002_gmail_emails.sql) — adds `body` and `received_at` columns to `emails` for Phase 2 ingestion

Verify in **Table Editor** that all four tables exist with **RLS enabled**:
- `profiles`
- `gmail_connections`
- `emails` (should now include `body` and `received_at` columns)
- `daily_summaries`

### 5. Configure auth redirect URLs

In **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

### 6. Enable Google sign-in (optional but recommended)

In **Authentication → Providers → Google**:
1. Enable the provider.
2. Create an OAuth 2.0 Web App in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - **Authorized redirect URI**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Paste the **Client ID** and **Client Secret** into Supabase.

> **Note**: This is the *sign-in* OAuth client. The Gmail-data OAuth client below is separate.

### 7. Set up the Gmail-data OAuth client (Phase 2)

This is the OAuth client InboxIQ uses to **read** mailboxes — separate from the sign-in client above.

1. In [Google Cloud Console → APIs & Services](https://console.cloud.google.com/apis/library):
   - **Enable Gmail API** for your project.
   - **OAuth consent screen**: External, add the scope `.../auth/gmail.readonly`. Add your own Google account as a Test User while the app is in testing mode.
2. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized redirect URI**: `http://localhost:3000/api/auth/gmail/callback`
3. Copy the Client ID + Client Secret into `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback
   ```

### 8. Set up OpenRouter (Phase 3)

InboxIQ routes all model calls through [OpenRouter](https://openrouter.ai) using the OpenAI SDK with a custom `baseURL`. Default model is `deepseek/deepseek-v4-pro`.

1. Create an OpenRouter account → **Keys → Create Key**.
2. Add to `.env.local`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   ```
3. Top up a few dollars of credit. A 50-email batch costs roughly $0.05–0.25 with Claude Sonnet 4.6 depending on body length.

To swap models, edit `DEFAULT_AI_MODEL` in [`lib/ai/env.ts`](lib/ai/env.ts) (e.g., `openai/gpt-4o-mini`, `google/gemini-2.5-flash`).

### 9. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Phase 1 smoke test

- `/` shows the landing page (hero, features, pricing).
- `/login` accepts an email → magic link arrives in your inbox → clicking it lands on `/dashboard`.
- "Continue with Google" round-trips through `/auth/callback` and lands on `/dashboard`.
- After sign-up, **auth.users** has the new user AND **public.profiles** has a matching row (the `handle_new_user` trigger fires automatically).
- Visiting `/dashboard` while logged out redirects to `/login`.
- Sign out from the dashboard returns you to `/login`.

## Phase 2 smoke test

- On the dashboard, click **Connect Gmail** → consent screen → bounce through `/api/auth/gmail/callback` → land on `/dashboard?gmail=connected`.
- Confirm a row exists in **public.gmail_connections** for your user (with `refresh_token` populated).
- Click **Sync emails** → after a few seconds, see the count ("Synced N emails") and the inbox list below populated with subject + sender + date + "Not yet processed" badge.
- Confirm rows in **public.emails** have `subject`, `sender`, `snippet`, `body`, and `received_at` set; `category`/`urgency_score`/`summary` should be NULL until you run Phase 3 processing.
- Click **Disconnect Gmail** → row disappears from `gmail_connections`; dashboard returns to the Connect card.
- Disconnect, then re-connect — the OAuth flow should still issue a refresh token (we pass `prompt=consent` to guarantee this).

## Phase 3 smoke test

- After **Sync emails**, click **Process emails** on the dashboard.
- Within ~10–30 seconds (depends on inbox size and model latency), see "Classified N emails" with a free-tier remaining count.
- Email list re-renders sorted by **urgency_score DESC** (NULLs last). Each processed row shows: urgency `X/10`, a category badge (urgent / client / newsletter / spam / personal), the AI summary, action items, and a collapsible "View draft reply" if one was suggested.
- Click the filter chips (**All / Urgent / Client / …**) — the URL updates with `?cat=urgent` and the list filters server-side.
- Hit the **free-tier cap**: process more than 10 emails in a calendar day (after pulling a larger inbox via repeated Sync) — second batch returns "Free-tier limit reached (10/day). Upgrade to Pro." Set `plan = 'pro'` in `public.profiles` to bypass: `update profiles set plan='pro' where id = auth.uid();`
- Confirm rows in **public.emails** now have `category`, `urgency_score`, `summary`, `action_items` (jsonb array) populated; `processed_at` updated to AI-process time.

## Project layout

```
app/
  actions/                 # server actions (auth, sign-out, gmail sync/disconnect)
  api/auth/gmail/init/     # GET → redirects to Google consent
  api/auth/gmail/callback/ # GET → exchanges code, persists tokens
  auth/callback/           # Supabase OAuth + magic-link callback
  dashboard/               # protected; Connect/Sync Gmail + email list
  login/                   # magic-link + Google sign-in form
  layout.tsx               # root layout (fonts, metadata)
  page.tsx                 # landing
  globals.css              # Tailwind v4 + shadcn theme tokens
components/                # SetupRequired + ui/ (shadcn)
lib/
  ai/                      # env, openrouter client, agents/classifier
  gmail/                   # env, oauth, client (auto-refresh), fetch (body extract)
  supabase/                # browser, server, middleware Supabase clients
  utils.ts                 # cn() helper
proxy.ts                   # session refresh + /dashboard guard (Next 16's renamed middleware)
supabase/
  migrations/              # 0001_init.sql, 0002_gmail_emails.sql
```
