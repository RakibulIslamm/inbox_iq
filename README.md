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
| 2 — Gmail + AI | ⏳ | Gmail OAuth, email ingestion, AI classification + summary + draft reply |
| 3 — Daily summary + Stripe | ⏳ | Daily summary view, Stripe paywall (Free vs Pro $19/mo) |

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

### 4. Run the DB migration

In the Supabase dashboard → **SQL Editor** → **New query**, paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run.

Verify in **Table Editor** that all four tables exist with **RLS enabled**:
- `profiles`
- `gmail_connections`
- `emails`
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

> **Note**: This is the *sign-in* OAuth client. Phase 2 will require a *separate* OAuth client (with the Gmail readonly scope) for actually reading user mailboxes.

### 7. Run the app

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

## Project layout

```
app/
  actions/         # server actions (auth, sign-out)
  auth/callback/   # OAuth + magic-link callback (Route Handler)
  dashboard/       # protected; placeholder Connect Gmail card
  login/           # magic-link + Google sign-in form
  layout.tsx       # root layout (fonts, metadata)
  page.tsx         # landing
  globals.css      # Tailwind v4 + shadcn theme tokens
components/ui/     # shadcn components (button, card, input, label, separator, badge)
lib/
  supabase/        # browser, server, middleware Supabase clients
  utils.ts         # cn() helper
proxy.ts           # session refresh + /dashboard guard (Next 16's renamed middleware)
supabase/
  migrations/      # 0001_init.sql
```
