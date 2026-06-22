-- ─────────────────────────────────────────────────────────────
-- 0005_notifications.sql — in-app notifications
--
-- Notifications can be per-user (alerts) or global (market events, user_id
-- null). Per-user "read" state is tracked by a single
-- profiles.notifications_seen_at timestamp: anything newer is "unread". This
-- avoids per-user rows for global events and gives a clean unread count.
-- Email delivery is a future enhancement.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists notifications_seen_at timestamptz not null default now();

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade, -- null = global
  type       text not null check (type in ('ALERT', 'MARKET', 'SYSTEM')),
  title      text not null,
  body       text,
  symbol     text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_global_idx on public.notifications(created_at desc) where user_id is null;

alter table public.notifications enable row level security;

-- Users read their own notifications + global ones. Writes are service-role
-- only (the cron creates them), so there is no insert/update/delete policy.
drop policy if exists "notifications_read" on public.notifications;
create policy "notifications_read" on public.notifications
  for select using (user_id = auth.uid() or user_id is null);
