-- InboxIQ — Phase 7 schema additions:
--   * profiles.name              for friendlier UI display
--   * subscription state columns for the billing page (cancel banner, etc.)
-- Also refreshes handle_new_user() to populate name from Supabase auth metadata
-- (Google OAuth: raw_user_meta_data.full_name) and backfills existing rows.

alter table public.profiles
  add column if not exists name                  text,
  add column if not exists subscription_status   text,
  add column if not exists cancel_at_period_end  boolean not null default false,
  add column if not exists current_period_end    timestamptz;

-- Refresh the trigger to also populate `name` on signup. `create or replace`
-- is idempotent and leaves the existing on_auth_user_created trigger intact.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- One-shot backfill for users who signed up before this migration.
update public.profiles p
set name = coalesce(
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'name',
  split_part(p.email, '@', 1)
)
from auth.users u
where p.id = u.id and p.name is null;
