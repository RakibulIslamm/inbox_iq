<div align="center">

# InboxIQ

### Email triage on autopilot.

AI inbox assistant that **categorizes**, **scores urgency**, **summarizes**, **drafts replies**, and ships you a **daily briefing** — built end-to-end on Next.js 16, Supabase, OpenRouter, Gmail API, and Stripe.

[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-base--lyra-000)](https://ui.shadcn.com)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%7C%20Postgres%20%7C%20RLS-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-DeepSeek%20v3.2-6E40C9)](https://openrouter.ai)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout%20%7C%20Webhooks-635BFF?logo=stripe&logoColor=white)](https://stripe.com)
[![Deploy on Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com)

[**Live demo →**](https://inboxiq.example.com) · [**Demo video →**](https://www.youtube.com/watch?v=PLACEHOLDER) · [Report bug](https://github.com/your-handle/inboxiq/issues)

</div>

---

## Screenshots

> Replace these with your own captures once you've signed up + processed a real inbox.

<!-- markdownlint-disable MD033 -->
<table>
  <tr>
    <td align="center"><b>Landing</b><br/><img src="docs/screenshots/landing.png" alt="Landing page" width="100%" /></td>
    <td align="center"><b>Inbox triage</b><br/><img src="docs/screenshots/dashboard.png" alt="Dashboard inbox" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><b>Email detail + reply</b><br/><img src="docs/screenshots/detail.png" alt="Email detail" width="100%" /></td>
    <td align="center"><b>Today briefing</b><br/><img src="docs/screenshots/today.png" alt="Today briefing" width="100%" /></td>
  </tr>
</table>
<!-- markdownlint-enable MD033 -->

## What it does

1. **Connect Gmail** with OAuth (read + send scopes only).
2. **Sync** the most recent 50 messages on demand.
3. **Process** them through an AI classifier — each email gets a `category`, `urgency_score` (1–10), 1–2 sentence summary, action items, and (when a reply is expected) a context-aware draft.
4. **Reply** straight from InboxIQ — edit the draft, regenerate with a tone variant, send via the Gmail API.
5. **Daily briefing** at 08:00 UTC via a Vercel Cron — top urgent, deduplicated action items, drafts ready.
6. **Stripe-gated Pro** — Free tier at 10 classifications/day; Pro at $19/mo for unlimited.

## Tech stack

- **Next.js 16** (App Router, server actions, route handlers, `proxy.ts` middleware) + **React 19** + **TypeScript** strict
- **Tailwind v4** + **shadcn/ui** (`base-lyra` style on `@base-ui/react`) + **Lucide** icons + **next-themes** dark mode
- **Supabase** — Auth (magic link + Google), Postgres + RLS, service-role admin client
- **OpenRouter** via the `openai` SDK (custom `baseURL`) — defaults to `deepseek/deepseek-v4-flash`, swap with one env var
- **googleapis** — Gmail OAuth + read + send (with auto-refresh and threading)
- **Stripe** — Checkout, Customer Portal, webhook-driven `profiles.plan` sync
- **Vercel** — host + Cron + Analytics + dynamic OG image
- **Sonner** for toasts, **Zod** for runtime schema validation
- **pnpm** for package management

## Architecture at a glance

```
                        ┌─────────────────┐
   browser ──────────► │   Next.js 16     │ ◄────── Vercel Cron (daily 08:00 UTC)
                        │  app/ + proxy.ts │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────────────────┐
              ▼                  ▼                              ▼
      ┌──────────────┐   ┌──────────────┐               ┌──────────────┐
      │  Supabase    │   │  OpenRouter  │               │    Gmail     │
      │ Auth + DB    │   │  Claude /    │               │   read +     │
      │   + RLS      │   │  DeepSeek /  │               │    send      │
      └──────────────┘   │   GPT etc.   │               └──────────────┘
                         └──────────────┘
                                 ▲
                                 │
                          ┌──────┴───────┐
                          │   Stripe     │
                          │ Checkout +   │
                          │  Webhooks    │
                          └──────────────┘
```

## Quick start

```bash
git clone https://github.com/your-handle/inboxiq.git
cd inboxiq
pnpm install
cp .env.local.example .env.local      # fill in keys (see Setup below)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Setup

### 1. Supabase

1. [supabase.com](https://supabase.com) → **New project**.
2. **Project Settings → API** → copy into `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` _(server-only)_
3. **SQL Editor** → run migrations in order:
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — base schema (4 tables + RLS + triggers)
   2. [`supabase/migrations/0002_gmail_emails.sql`](supabase/migrations/0002_gmail_emails.sql) — `body`, `received_at`
   3. [`supabase/migrations/0003_email_threading.sql`](supabase/migrations/0003_email_threading.sql) — `thread_id`, `message_id_header`, `to_header`, `cc_header`, `replied_at`
   4. [`supabase/migrations/0004_profile_extras.sql`](supabase/migrations/0004_profile_extras.sql) — `profiles.name` (auto-derived display name) + subscription state columns (`subscription_status`, `cancel_at_period_end`, `current_period_end`); refreshes `handle_new_user`
   5. [`supabase/migrations/0005_sync_extras.sql`](supabase/migrations/0005_sync_extras.sql) — `gmail_connections.gmail_email` (which Gmail address is connected, captured at OAuth callback) + `profiles.last_synced_at` (watermark for the incremental twice-daily cron)
4. **Authentication → URL Configuration** → Site URL `http://localhost:3000`; Redirect URLs add `http://localhost:3000/auth/callback`.

### 2. Google sign-in (Supabase provider)

1. **Authentication → Providers → Google** → enable.
2. Create an OAuth 2.0 Web Client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Paste Client ID + Secret into Supabase.

### 3. Gmail-data OAuth client (separate from sign-in)

1. Google Cloud → enable **Gmail API**.
2. **OAuth consent screen** → External → add scopes: `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.send`. Add yourself as a Test User.
3. **Credentials → Create credentials → OAuth client ID → Web application** → redirect URI `http://localhost:3000/api/auth/gmail/callback`.
4. Add to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback
   ```

### 4. OpenRouter

1. [openrouter.ai](https://openrouter.ai) → **Keys → Create Key**.
2. Top up a few dollars of credit (a 50-email batch costs ~$0.05–0.25 depending on model + body length).
3. Add to `.env.local`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
   ```
4. Default model is in [`lib/ai/env.ts`](lib/ai/env.ts) — swap to e.g. `anthropic/claude-sonnet-4.6`, `openai/gpt-4o-mini`, or `google/gemini-2.5-flash` with one line.

#### Public-demo kill switch

Set `AI_DISABLED=true` to hard-disable every OpenRouter call. The dashboard hides Process / Generate-briefing / Regenerate-draft buttons and explains the state inline; crons return `200 { ok: true, skipped: "ai_disabled" }`; previously-stored classifications, summaries, and drafts continue to render read-only. This is the lever to flip on the public Vercel deployment so visitors can browse the demo without burning through your OpenRouter credits.

```
AI_DISABLED=true
```

The flag wins regardless of whether the keys above are present, so you can test it locally without unsetting your dev keys.

### 5. Cron secret

```
CRON_SECRET=<paste-32+-char-random-string>
```

Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically when running the cron defined in [`vercel.json`](vercel.json) (08:00 UTC daily). Locally:

```bash
curl "http://localhost:3000/api/cron/daily-summary?secret=$CRON_SECRET"
```

### 6. Stripe

1. Stripe Dashboard → **Test mode** → **Products → Add product** → `InboxIQ Pro`, $19.00 recurring monthly. **Copy the Price ID — `price_…`, NOT `prod_…`**.
2. **Developers → API keys** → copy the Secret Key (`sk_test_…`).
3. **Webhook signing**:
   - **Local**: `stripe login`, then in another terminal `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Copy the printed `whsec_…`.
   - **Production**: **Developers → Webhooks → Add endpoint** at `https://<your-domain>/api/stripe/webhook`, subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret.
4. **Settings → Billing → Customer portal** → enable; allow cancel + payment-method updates.
5. Add to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRO_PRICE_ID=price_...
   ```

### 7. Run

```bash
pnpm dev
```

## Deploying to Vercel

1. **Push to GitHub** (private or public).
2. **Vercel → New Project → Import** the repo. Framework auto-detected as Next.js.
3. **Environment Variables** — add **all** of the keys from your `.env.local`:
   - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Site: `NEXT_PUBLIC_APP_URL` = your Vercel URL (`https://inboxiq.vercel.app` or your custom domain)
   - OpenRouter: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`
   - Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` = `https://<your-domain>/api/auth/gmail/callback`
   - Cron: `CRON_SECRET`
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`
4. **Update Google Cloud Console**:
   - Add `https://<your-domain>/api/auth/gmail/callback` to **OAuth client → Authorized redirect URIs**.
   - Add `https://<your-domain>` to the **OAuth consent screen → Authorized domains**.
5. **Update Supabase Auth → URL Configuration**:
   - Site URL: `https://<your-domain>`
   - Redirect URLs: add `https://<your-domain>/auth/callback`.
6. **Update Stripe webhook**:
   - Create a production webhook at `https://<your-domain>/api/stripe/webhook` (events listed above).
   - Replace `STRIPE_WEBHOOK_SECRET` in Vercel with the production signing secret.
7. **Deploy**, then **smoke-test** the full flow on production:
   - Sign up → connect Gmail → sync → process → open email → send a reply → upgrade → cancel → run the cron (`Settings → Crons → Run now`).

## Smoke tests by phase

<details>
<summary><b>Phase 1 — Auth scaffold</b></summary>

- `/` shows the landing page (hero, features, pricing).
- `/login` accepts an email → magic link → lands on `/dashboard`.
- "Continue with Google" round-trips through `/auth/callback` → `/dashboard`.
- After sign-up, **auth.users** has the new user AND **public.profiles** has a matching row (`handle_new_user` trigger).
- `/dashboard` while logged out → redirects to `/login`.

</details>

<details>
<summary><b>Phase 2 — Gmail OAuth + ingestion</b></summary>

- Click **Connect Gmail** → consent screen → `/dashboard?gmail=connected`.
- Row in `public.gmail_connections` with `refresh_token`.
- **Sync emails** → toast "Synced N emails"; inbox list populates.
- Rows in `public.emails` have `subject`, `sender`, `snippet`, `body`, `received_at` set; AI fields NULL.
- Disconnect / re-connect — refresh token issued thanks to `prompt=consent`.

</details>

<details>
<summary><b>Phase 3 — AI classification</b></summary>

- **Process emails** → toast "Classified N emails · X left in today's free quota".
- List sorts by `urgency_score DESC NULLS LAST`. Each row shows urgency `X/10`, category badge, summary, action items.
- Filter chips drive `?cat=urgent` etc. — purely server-rendered.
- Past 10 in a UTC day on Free → red **Upgrade to Pro** panel + toast. SQL escape: `update profiles set plan='pro' where id = auth.uid();`.

</details>

<details>
<summary><b>Phase 4 — Email detail + replies + daily summary</b></summary>

- Click any inbox row → `/dashboard/emails/[id]` with full body, AI summary, action checklist, editable draft.
- **Regenerate** (with optional Shorter / Longer / More formal / More casual) → textarea updates + draft persists to `emails.draft_reply`.
- **Send reply** → message appears in your Gmail Sent folder, in the same thread; toast confirms; `replied_at` set.
- `/dashboard/today` → stats, briefing, top 3 urgent, drafts ready.
- **Generate today's summary** → AI briefing fills in within ~10s; row in `public.daily_summaries`.
- Cron locally: `curl "http://localhost:3000/api/cron/daily-summary?secret=$CRON_SECRET"` → `{ ok: true, usersScanned, succeeded, failed: [] }`.

</details>

<details>
<summary><b>Phase 5 — Stripe</b></summary>

- Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` in another terminal.
- `/dashboard/billing` → **Current plan: free** + Pro card with **Upgrade to Pro**.
- Click **Upgrade** → Stripe Checkout → test card `4242 4242 4242 4242` → success → `/dashboard/billing?stripe=success` → plan flips to `pro` via webhook.
- **Manage subscription** → portal → cancel → plan stays `pro` until period end → `customer.subscription.deleted` → plan reverts to `free`.

</details>

## Project layout

```
app/
  actions/                 # server actions (auth, sign-out, gmail, process, email, summary)
  api/auth/gmail/init/     # GET → redirects to Google consent
  api/auth/gmail/callback/ # GET → exchanges code, persists tokens
  api/cron/daily-summary/  # GET → Vercel-cron-protected, fans out to all users
  api/stripe/checkout/     # POST → creates Checkout session, 303 to Stripe
  api/stripe/portal/       # POST → creates Portal session, 303 to Stripe
  api/stripe/webhook/      # POST → verifies signature + updates profiles.plan
  auth/callback/           # Supabase OAuth + magic-link callback
  dashboard/
    emails/[id]/           # email detail + reply form (loading.tsx + reply-form.tsx)
    today/                 # daily briefing + top urgent + drafts ready
    billing/               # current plan + upgrade / manage subscription
    layout.tsx             # nav + sign-out + theme toggle, gates by Supabase setup
    error.tsx              # dashboard-scoped error boundary
    loading.tsx            # dashboard skeleton
  login/                   # magic-link + Google sign-in form
  layout.tsx               # ThemeProvider + Toaster + Vercel Analytics + global metadata
  error.tsx                # root error boundary
  page.tsx                 # landing (hero, features, social proof, how-it-works, pricing, FAQ, CTA)
  opengraph-image.tsx      # dynamic OG image (next/og)
  globals.css              # Tailwind v4 + shadcn theme tokens (light + dark)
components/
  ui/                      # shadcn (button, card, input, label, separator, badge, sonner, skeleton)
  setup-required.tsx       # graceful state when Supabase keys are missing
  theme-provider.tsx       # next-themes wrapper
  theme-toggle.tsx         # sun/moon button
lib/
  ai/                      # env, openrouter client, agents/{classifier,reply,summarizer}
  gmail/                   # env, oauth, client (auto-refresh), fetch, send
  stripe/                  # env (incl. plan metadata), pinned-version SDK client
  supabase/                # browser, server, middleware, admin (service-role) clients
  utils.ts                 # cn() helper
proxy.ts                   # session refresh + /dashboard guard (Next 16's renamed middleware)
vercel.json                # Vercel Cron config (08:00 UTC daily)
supabase/
  migrations/              # 0001_init.sql, 0002_gmail_emails.sql, 0003_email_threading.sql
```

## Build status

| Phase | Status | Scope |
|---|---|---|
| 1 — Scaffold + Auth | ✅ | Supabase auth (magic link + Google), `/dashboard` proxy guard, DB schema, landing page |
| 2 — Gmail OAuth + ingestion | ✅ | Gmail OAuth (read), fetch + store last 50 emails, dashboard list view |
| 3 — AI classification + summaries | ✅ | Classifier agent (category / urgency / summary / action items / draft reply), filter chips, free-tier 10/day quota |
| 4 — Email detail + Replies + Daily summary | ✅ | Email detail page, send/regenerate reply, /today page, Vercel daily-summary cron |
| 5 — Stripe paywall | ✅ | Stripe Checkout + Customer Portal, webhook-driven `profiles.plan` sync, billing page, upgrade CTA on quota |
| 6 — Polish + Deploy | ✅ | FAQ, testimonials, dark mode, toasts, loading skeletons, error boundaries, OG image, Vercel Analytics |

## License

MIT. Use it, fork it, ship your own.

## Acknowledgements

- shadcn/ui's `base-lyra` registry for the squared, monospace aesthetic.
- Anthropic's Claude / DeepSeek / OpenRouter for making the agent layer trivial to swap.
- Supabase for one-click Postgres + Auth + RLS.
