-- 0005_sync_extras.sql
-- Adds:
--   1. `gmail_connections.gmail_email` — the actual Gmail address that was
--      authorised (so the dashboard can show "Connected · alice@gmail.com"
--      instead of just a generic badge). Captured during the OAuth callback
--      via Google's userinfo endpoint.
--   2. `profiles.last_synced_at` — watermark cursor used by the incremental
--      sync. Each sync run pulls Gmail messages with `after:<unix>` and then
--      bumps this timestamp to "now". On a brand-new connection it stays
--      null, so the first sync falls back to the most recent INBOX page.

alter table public.gmail_connections
  add column if not exists gmail_email text;

alter table public.profiles
  add column if not exists last_synced_at timestamptz;
