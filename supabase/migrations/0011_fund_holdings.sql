-- ─────────────────────────────────────────────────────────────
-- 0011_fund_holdings.sql — Mutual fund holdings (manual entry)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.mutual_fund_holdings (
  id            bigint generated always as identity primary key,
  fund_name     text not null,
  amc           text not null,
  report_month  int  not null check (report_month between 1 and 12),
  report_year   int  not null check (report_year >= 2020),
  symbol        text,
  stock_name    text not null,
  percentage    numeric(6,2) not null check (percentage >= 0 and percentage <= 100),
  rank          int,
  status        text not null default 'draft' check (status in ('draft', 'published')),
  source        text not null default 'manual' check (source in ('manual', 'scraped')),
  created_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  unique (fund_name, report_month, report_year, stock_name)
);

create index if not exists mfh_fund_period_idx
  on public.mutual_fund_holdings (fund_name, report_year, report_month);

create index if not exists mfh_status_idx
  on public.mutual_fund_holdings (status);

-- RLS
alter table public.mutual_fund_holdings enable row level security;

-- Public can read published rows
create policy "public read published"
  on public.mutual_fund_holdings for select
  using (status = 'published');

-- Authenticated superadmins manage all rows via service-role key in server actions
-- (No user-facing policy needed — admin actions use createAdminClient which bypasses RLS)
