alter table profiles
  add column tax_filer           boolean  not null default false,
  add column broker_fee_pct      numeric  not null default 0.20,
  add column zakat_on_dividends  boolean  not null default false,
  add column cgt_rate_override   numeric  default null;
