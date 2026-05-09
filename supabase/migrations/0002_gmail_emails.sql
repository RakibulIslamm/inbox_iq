-- InboxIQ — Phase 2 schema additions for Gmail ingestion.
-- Adds the columns we need to store the raw fetched message before AI
-- processing fills in summary / category / urgency / draft_reply.

alter table public.emails
  add column if not exists body text,
  add column if not exists received_at timestamptz;

create index if not exists emails_user_received_idx
  on public.emails (user_id, received_at desc);
