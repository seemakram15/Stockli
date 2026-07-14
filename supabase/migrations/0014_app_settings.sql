-- ─────────────────────────────────────────────────────────────
-- 0014_app_settings.sql — site-wide feature toggles (guest browsing)
--
-- Key/value settings table. A missing "page:<key>" row means "enabled" —
-- new nav pages default open without needing a migration. Only the two
-- master switches are seeded; per-page rows are created on first toggle.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  key         text primary key,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

create policy "app_settings_public_read"
  on public.app_settings for select
  using (true);

create policy "app_settings_superadmin_write"
  on public.app_settings for insert
  with check (public.is_superadmin());

create policy "app_settings_superadmin_update"
  on public.app_settings for update
  using (public.is_superadmin())
  with check (public.is_superadmin());

insert into public.app_settings (key, enabled)
values
  ('guest_browsing_enabled', true),
  ('guest_login_popup_enabled', true)
on conflict (key) do nothing;
