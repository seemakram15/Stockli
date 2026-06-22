-- ─────────────────────────────────────────────────────────────
-- 0002_rls.sql — Row Level Security
-- Every user-owned table is locked to its owner via auth.uid().
-- tickers + price_snapshots are public-read, service-role-write.
-- ─────────────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.portfolios      enable row level security;
alter table public.holdings        enable row level security;
alter table public.transactions    enable row level security;
alter table public.daily_pl        enable row level security;
alter table public.watchlists      enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.alerts          enable row level security;
alter table public.tickers         enable row level security;
alter table public.price_snapshots enable row level security;

-- profiles
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- portfolios
drop policy if exists "portfolios_owner" on public.portfolios;
create policy "portfolios_owner" on public.portfolios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- holdings (owned via parent portfolio)
drop policy if exists "holdings_owner" on public.holdings;
create policy "holdings_owner" on public.holdings
  for all using (
    exists (select 1 from public.portfolios p
            where p.id = holdings.portfolio_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.portfolios p
            where p.id = holdings.portfolio_id and p.user_id = auth.uid())
  );

-- transactions (owned via parent portfolio)
drop policy if exists "transactions_owner" on public.transactions;
create policy "transactions_owner" on public.transactions
  for all using (
    exists (select 1 from public.portfolios p
            where p.id = transactions.portfolio_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.portfolios p
            where p.id = transactions.portfolio_id and p.user_id = auth.uid())
  );

-- daily_pl (owned via parent portfolio)
drop policy if exists "daily_pl_owner" on public.daily_pl;
create policy "daily_pl_owner" on public.daily_pl
  for all using (
    exists (select 1 from public.portfolios p
            where p.id = daily_pl.portfolio_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.portfolios p
            where p.id = daily_pl.portfolio_id and p.user_id = auth.uid())
  );

-- watchlists
drop policy if exists "watchlists_owner" on public.watchlists;
create policy "watchlists_owner" on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- watchlist_items (owned via parent watchlist)
drop policy if exists "watchlist_items_owner" on public.watchlist_items;
create policy "watchlist_items_owner" on public.watchlist_items
  for all using (
    exists (select 1 from public.watchlists w
            where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.watchlists w
            where w.id = watchlist_items.watchlist_id and w.user_id = auth.uid())
  );

-- alerts
drop policy if exists "alerts_owner" on public.alerts;
create policy "alerts_owner" on public.alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- tickers + price_snapshots: anyone (incl. anon) may read; only the service
-- role (which bypasses RLS) may write.
drop policy if exists "tickers_public_read" on public.tickers;
create policy "tickers_public_read" on public.tickers
  for select using (true);

drop policy if exists "price_snapshots_public_read" on public.price_snapshots;
create policy "price_snapshots_public_read" on public.price_snapshots
  for select using (true);
