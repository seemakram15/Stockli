-- ─────────────────────────────────────────────────────────────
-- 0007_notification_consent_push.sql — consent + push delivery
--
-- Adds browser notification consent tracking, push subscription storage, event
-- de-duplication for scheduled/system notifications, and welcome notifications
-- for newly-created profiles.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists cookie_consent_at timestamptz,
  add column if not exists cookie_consent_version text,
  add column if not exists notification_consent_at timestamptz,
  add column if not exists notification_consent_status text not null default 'unknown';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_notification_consent_status') then
    alter table public.profiles
      add constraint profiles_notification_consent_status
      check (notification_consent_status in ('unknown', 'granted', 'denied')) not valid;
  end if;
end $$;

alter table public.notifications
  add column if not exists href text;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'notifications_type_check') then
    alter table public.notifications drop constraint notifications_type_check;
  end if;

  alter table public.notifications
    add constraint notifications_type_check
    check (type in ('ALERT', 'MARKET', 'SYSTEM', 'PORTFOLIO')) not valid;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_success_at timestamptz,
  last_error      text,
  unique (user_id, endpoint)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

drop policy if exists "push_subscriptions_self_select" on public.push_subscriptions;
drop policy if exists "push_subscriptions_self_insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions_self_update" on public.push_subscriptions;
drop policy if exists "push_subscriptions_self_delete" on public.push_subscriptions;

create policy "push_subscriptions_self_select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subscriptions_self_insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subscriptions_self_update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subscriptions_self_delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

create table if not exists public.notification_events (
  key        text primary key,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notification_events enable row level security;
alter table public.notification_events force row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pf_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));

  insert into public.portfolios (user_id, name, description)
  values (new.id, 'My Portfolio', 'Default portfolio')
  returning id into pf_id;

  insert into public.watchlists (user_id, name)
  values (new.id, 'Watchlist');

  insert into public.notifications (user_id, type, title, body, href)
  values (
    new.id,
    'SYSTEM',
    'Welcome to Stockli',
    'Your portfolio workspace is ready. Add holdings, set alerts, and enable market notifications when you are ready.',
    '/dashboard'
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
