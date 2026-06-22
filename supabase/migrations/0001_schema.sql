-- ─────────────────────────────────────────────────────────────
-- 0001_schema.sql — PSX Portfolio Tracker schema
-- Run in the Supabase SQL editor (or `supabase db push`).
-- ─────────────────────────────────────────────────────────────

-- profiles: 1:1 with auth.users (core identity lives in auth.users)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  base_currency text not null default 'PKR',
  created_at    timestamptz not null default now()
);

-- tickers: PSX listings. Public read; written by the service role only.
create table if not exists public.tickers (
  symbol        text primary key,
  company_name  text,
  sector        text,
  listed_in     text,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

-- portfolios
create table if not exists public.portfolios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists portfolios_user_idx on public.portfolios(user_id);

-- holdings: current positions
create table if not exists public.holdings (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  symbol        text not null references public.tickers(symbol),
  quantity      numeric(20,4) not null check (quantity >= 0),
  avg_buy_price numeric(20,4) not null check (avg_buy_price >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (portfolio_id, symbol)
);
create index if not exists holdings_portfolio_idx on public.holdings(portfolio_id);

-- transactions: immutable audit log
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  symbol        text not null,
  type          text not null check (type in ('BUY','SELL','ADD','EDIT','REMOVE')),
  quantity      numeric(20,4) not null default 0,
  price         numeric(20,4) not null default 0,
  fees          numeric(20,4) not null default 0,
  note          text,
  transacted_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists transactions_portfolio_idx on public.transactions(portfolio_id, transacted_at desc);

-- price_snapshots: latest row per symbol = current price. Public read.
create table if not exists public.price_snapshots (
  id          bigint generated always as identity primary key,
  symbol      text not null,
  price       numeric(20,4) not null,
  ldcp        numeric(20,4),
  open        numeric(20,4),
  high        numeric(20,4),
  low         numeric(20,4),
  change      numeric(20,4),
  change_pct  numeric(12,4),
  volume      bigint,
  captured_at timestamptz not null default now()
);
create index if not exists price_snapshots_symbol_idx on public.price_snapshots(symbol, captured_at desc);

-- daily_pl: powers the daily gain/loss calendar
create table if not exists public.daily_pl (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  symbol       text not null,
  date         date not null,
  open_value   numeric(20,4) not null default 0,
  close_value  numeric(20,4) not null default 0,
  day_pl       numeric(20,4) not null default 0,
  day_pl_pct   numeric(12,4) not null default 0,
  unique (portfolio_id, symbol, date)
);
create index if not exists daily_pl_lookup_idx on public.daily_pl(portfolio_id, symbol, date);

-- watchlists
create table if not exists public.watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Watchlist',
  created_at timestamptz not null default now()
);
create index if not exists watchlists_user_idx on public.watchlists(user_id);

create table if not exists public.watchlist_items (
  id           uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  symbol       text not null,
  created_at   timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

-- alerts
create table if not exists public.alerts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  symbol            text not null,
  condition         text not null check (condition in ('ABOVE','BELOW')),
  target_price      numeric(20,4) not null,
  is_active         boolean not null default true,
  last_triggered_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists alerts_user_idx on public.alerts(user_id);

-- keep holdings.updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists holdings_set_updated_at on public.holdings;
create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

-- On new auth user: create profile + default portfolio + default watchlist
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
