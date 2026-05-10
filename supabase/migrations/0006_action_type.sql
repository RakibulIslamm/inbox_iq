-- 0006_action_type.sql
-- Adds explicit reply-vs-no-reply signal + an action taxonomy on top of the
-- existing classifier output. Until now the dashboard inferred "this email
-- doesn't need a reply" from `draft_reply IS NULL` — fine for the inbox list,
-- but on the email detail page it left a half-empty Reply form for newsletters
-- and automated alerts. With these columns:
--   - `reply_required` is the explicit flag (replaces the implicit inference).
--   - `no_reply_reason` says *why* (newsletter / receipt / no-reply sender / …)
--     so the UI can produce contextual copy.
--   - `action_type` groups inbox work by the kind of action required (pay,
--     sign, schedule, …) and powers the new /dashboard/actions page.
--   - `action_done_at` persists the per-email "done" state that was previously
--     just a local checkbox.
--
-- All columns nullable. Legacy rows surface in /dashboard/actions as
-- "uncategorized" with a one-click backfill button (see lib/ai/agents/actionizer.ts).

alter table public.emails
  add column if not exists reply_required boolean,
  add column if not exists no_reply_reason text
    check (no_reply_reason in (
      'no_reply_sender','automated','fyi','newsletter','marketing','receipt'
    )),
  add column if not exists action_type text
    check (action_type in (
      'reply','review','pay','sign','schedule','track','read','none'
    )),
  add column if not exists action_done_at timestamptz;

-- Powers the per-bucket queries on /dashboard/actions.
create index if not exists emails_user_action_type_idx
  on public.emails (user_id, action_type)
  where action_type is not null;

-- Hot path: open (not done) actionable rows ordered by urgency.
create index if not exists emails_user_open_actions_idx
  on public.emails (user_id, action_type, urgency_score desc)
  where action_done_at is null and action_type is not null and action_type <> 'none';
