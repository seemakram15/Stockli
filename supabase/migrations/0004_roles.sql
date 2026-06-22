-- ─────────────────────────────────────────────────────────────
-- 0004_roles.sql — superadmin role + privilege-escalation protection
--
-- Design notes (security):
--  * `role` lives on profiles, default 'user'. Normal users never see or
--    manage it — it's a superadmin-only concept.
--  * A BEFORE UPDATE trigger BLOCKS any end-user (auth.uid() set) from
--    changing ANY profile.role unless they are already a superadmin. This
--    defends against self-escalation even though profiles has a permissive
--    "owner" policy. Trusted server contexts (service role → auth.uid() null,
--    e.g. the seeding script / admin action) are allowed through.
--  * Cross-user reads for the admin UI are NOT granted via RLS — they go
--    through the server-only service-role client AFTER an explicit
--    superadmin check, so normal RLS stays strict (each user sees only their
--    own rows) and personal dashboards remain correct.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'superadmin'));
  end if;
end $$;

-- SECURITY DEFINER so it bypasses RLS when reading profiles (no recursion).
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Only block when a real end-user is acting and is not a superadmin.
    if auth.uid() is not null and not public.is_superadmin() then
      raise exception 'Only a superadmin may change roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_role_change();
