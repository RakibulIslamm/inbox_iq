-- InboxIQ — Phase 1 schema
-- Run in Supabase SQL editor on a fresh project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users, created automatically by trigger.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null,
  plan                text not null default 'free' check (plan in ('free','pro')),
  stripe_customer_id  text unique,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- gmail_connections: one row per user. Tokens are sensitive — never expose.
-- ---------------------------------------------------------------------------
create table public.gmail_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  refresh_token  text not null,
  access_token   text,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- emails: one row per Gmail message we've ingested + classified.
-- ---------------------------------------------------------------------------
create table public.emails (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  gmail_message_id  text not null,
  subject           text,
  sender            text,
  snippet           text,
  category          text check (category in ('urgent','client','newsletter','spam','personal')),
  urgency_score     int  check (urgency_score between 1 and 10),
  summary           text,
  action_items      jsonb not null default '[]'::jsonb,
  draft_reply       text,
  processed_at      timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

create index emails_user_processed_idx on public.emails (user_id, processed_at desc);
create index emails_user_category_idx  on public.emails (user_id, category);

-- ---------------------------------------------------------------------------
-- daily_summaries: one row per (user, day).
-- ---------------------------------------------------------------------------
create table public.daily_summaries (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  summary       text,
  action_items  jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);

create index daily_summaries_user_date_idx on public.daily_summaries (user_id, date desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for gmail_connections.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gmail_connections_updated_at on public.gmail_connections;
create trigger gmail_connections_updated_at
  before update on public.gmail_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- handle_new_user: insert into profiles when a new auth.users row appears.
-- Runs as security definer (bypasses RLS) with a pinned search_path.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.emails            enable row level security;
alter table public.daily_summaries   enable row level security;

-- profiles: owner is auth.uid() = id
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- gmail_connections: owner is auth.uid() = user_id
create policy "gmail_connections_select_own" on public.gmail_connections
  for select using (auth.uid() = user_id);
create policy "gmail_connections_insert_own" on public.gmail_connections
  for insert with check (auth.uid() = user_id);
create policy "gmail_connections_update_own" on public.gmail_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gmail_connections_delete_own" on public.gmail_connections
  for delete using (auth.uid() = user_id);

-- emails: owner is auth.uid() = user_id
create policy "emails_select_own" on public.emails
  for select using (auth.uid() = user_id);
create policy "emails_insert_own" on public.emails
  for insert with check (auth.uid() = user_id);
create policy "emails_update_own" on public.emails
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "emails_delete_own" on public.emails
  for delete using (auth.uid() = user_id);

-- daily_summaries: owner is auth.uid() = user_id
create policy "daily_summaries_select_own" on public.daily_summaries
  for select using (auth.uid() = user_id);
create policy "daily_summaries_insert_own" on public.daily_summaries
  for insert with check (auth.uid() = user_id);
create policy "daily_summaries_update_own" on public.daily_summaries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_summaries_delete_own" on public.daily_summaries
  for delete using (auth.uid() = user_id);
