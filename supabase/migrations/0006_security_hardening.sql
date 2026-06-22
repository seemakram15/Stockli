-- ─────────────────────────────────────────────────────────────
-- 0006_security_hardening.sql — stricter constraints + RLS hardening
--
-- Supabase query builders parameterize values, but the database should still
-- reject malformed symbols, oversized text, and client writes to audit/system
-- tables. Constraints are added NOT VALID so existing data is not blocked, but
-- every new or updated row must satisfy them.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles        force row level security;
alter table public.portfolios      force row level security;
alter table public.holdings        force row level security;
alter table public.transactions    force row level security;
alter table public.daily_pl        force row level security;
alter table public.watchlists      force row level security;
alter table public.watchlist_items force row level security;
alter table public.alerts          force row level security;
alter table public.notifications   force row level security;
alter table public.tickers         force row level security;
alter table public.price_snapshots force row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Normal users can read/update their own profile preferences, but cannot
-- insert/delete profiles directly. Inserts happen from handle_new_user().
drop policy if exists "profiles_self" on public.profiles;
drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Transactions are an audit log: owners may read and insert rows through app
-- flows, but not update/delete history from the client.
drop policy if exists "transactions_owner" on public.transactions;
drop policy if exists "transactions_owner_select" on public.transactions;
drop policy if exists "transactions_owner_insert" on public.transactions;
create policy "transactions_owner_select" on public.transactions
  for select using (
    exists (select 1 from public.portfolios p
            where p.id = transactions.portfolio_id and p.user_id = auth.uid())
  );
create policy "transactions_owner_insert" on public.transactions
  for insert with check (
    exists (select 1 from public.portfolios p
            where p.id = transactions.portfolio_id and p.user_id = auth.uid())
  );

-- daily_pl is generated/system data. Clients may read their own calendar rows
-- but writes are service-role only.
drop policy if exists "daily_pl_owner" on public.daily_pl;
drop policy if exists "daily_pl_owner_select" on public.daily_pl;
create policy "daily_pl_owner_select" on public.daily_pl
  for select using (
    exists (select 1 from public.portfolios p
            where p.id = daily_pl.portfolio_id and p.user_id = auth.uid())
  );

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.protect_role_change() from public;
grant execute on function public.is_superadmin() to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_display_name_len') then
    alter table public.profiles
      add constraint profiles_display_name_len
      check (display_name is null or char_length(display_name) <= 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_currency_format') then
    alter table public.profiles
      add constraint profiles_currency_format
      check (base_currency ~ '^[A-Z]{3}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'portfolios_name_len') then
    alter table public.portfolios
      add constraint portfolios_name_len
      check (char_length(name) between 1 and 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'portfolios_description_len') then
    alter table public.portfolios
      add constraint portfolios_description_len
      check (description is null or char_length(description) <= 280) not valid;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickers_symbol_format') then
    alter table public.tickers
      add constraint tickers_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holdings_symbol_format') then
    alter table public.holdings
      add constraint holdings_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_symbol_format') then
    alter table public.transactions
      add constraint transactions_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'watchlist_items_symbol_format') then
    alter table public.watchlist_items
      add constraint watchlist_items_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'alerts_symbol_format') then
    alter table public.alerts
      add constraint alerts_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notifications_symbol_format') then
    alter table public.notifications
      add constraint notifications_symbol_format
      check (symbol is null or (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'daily_pl_symbol_format') then
    alter table public.daily_pl
      add constraint daily_pl_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'price_snapshots_symbol_format') then
    alter table public.price_snapshots
      add constraint price_snapshots_symbol_format
      check (symbol = upper(symbol) and symbol ~ '^[A-Z0-9.&-]{1,20}$') not valid;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'holdings_quantity_positive') then
    alter table public.holdings
      add constraint holdings_quantity_positive
      check (quantity > 0 and quantity <= 1000000000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'holdings_price_bounds') then
    alter table public.holdings
      add constraint holdings_price_bounds
      check (avg_buy_price >= 0 and avg_buy_price <= 100000000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_numeric_bounds') then
    alter table public.transactions
      add constraint transactions_numeric_bounds
      check (
        quantity >= 0 and quantity <= 1000000000 and
        price >= 0 and price <= 100000000 and
        fees >= 0 and fees <= 100000000
      ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_note_len') then
    alter table public.transactions
      add constraint transactions_note_len
      check (note is null or char_length(note) <= 280) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'watchlists_name_len') then
    alter table public.watchlists
      add constraint watchlists_name_len
      check (char_length(name) between 1 and 80) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'alerts_target_bounds') then
    alter table public.alerts
      add constraint alerts_target_bounds
      check (target_price > 0 and target_price <= 100000000) not valid;
  end if;
end $$;
