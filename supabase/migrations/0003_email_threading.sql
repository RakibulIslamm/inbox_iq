-- InboxIQ — Phase 4 schema additions for replying + threading.
-- Adds the headers Gmail's send API needs to keep replies in the same thread,
-- plus a flag for tracking whether the user has sent a reply from InboxIQ.

alter table public.emails
  add column if not exists thread_id          text,
  add column if not exists message_id_header  text,
  add column if not exists to_header          text,
  add column if not exists cc_header          text,
  add column if not exists replied_at         timestamptz;

create index if not exists emails_user_thread_idx
  on public.emails (user_id, thread_id);
