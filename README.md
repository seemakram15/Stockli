# Stockli — PSX Portfolio Tracker

A free, serverless web app for tracking personal stock portfolios on the
**Pakistan Stock Exchange (PSX)**. Live‑ish prices, profit/loss, candlestick
charts, a **large daily gain/loss calendar**, watchlists, price alerts and
KSE‑100 benchmarking — all on free tiers.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui ·
Supabase · Upstash Redis · TradingView Lightweight Charts · Recharts**.

> ⚠️ Market data comes from the **public PSX Data Portal** and is **delayed
> (~15 min)**. For personal, non‑commercial use only. Not investment advice.

---

## ✨ Demo mode (runs with zero setup)

The repo ships with **dummy env values**, so it boots straight into **DEMO
MODE**: a sample investor with two portfolios, transactions, a watchlist and
alerts — rendered through the *exact same code path* as live data. Live PSX
prices are still fetched (the scraper hits the real endpoints); only accounts &
persistence are stubbed until you add real keys.

```bash
nvm use 22         # Node 18.18+ required (this repo was built on v22)
npm install
npm run dev        # http://localhost:3000
```

Everything is navigable immediately. A dismissible banner marks demo mode.

---

## 🏗️ Architecture

```
[Browser] ── SWR poll /api/prices (30s) ──▶ [Next.js on Vercel]
                                              ├─ Server Components (dashboard, detail, market…)
                                              ├─ Route Handlers (/api/prices, /api/cron/refresh, …)
                                              │     │ cache miss
                                              │     ▼
                                              │  [Upstash Redis]  15‑min TTL price snapshots
                                              │     │
                                              │     ▼
                                              │  [PSX adapter] ─scrape─▶ dps.psx.com.pk
                                              │     (live → mock fallback)
                                              └─ [Supabase Postgres + Auth + RLS]
[External cron] ─Bearer CRON_SECRET─▶ /api/cron/refresh  (warms cache, writes daily P/L, fires alerts)
```

**The data layer is swappable.** Everything goes through
[`lib/psx/adapter.ts`](lib/psx/adapter.ts) (`PsxDataSource`). Swap the live
scraper for a licensed feed or an authorised redistributor without touching app
code. The resilient `psx` export retries with backoff and **falls back to
deterministic mock data** so the UI never hard‑fails.

### Key directories

| Path | What |
|---|---|
| `lib/psx/` | Data adapter, market‑hours helper, mock generator, symbol seed |
| `lib/services/` | Prices (cache→scrape→store), metrics, portfolio, stock, daily‑P/L, performance |
| `lib/actions/` | Server actions: auth, portfolio CRUD, watchlist, alerts |
| `lib/supabase/` | Browser / server / admin clients + session middleware |
| `app/(app)/` | Authenticated app (dashboard, portfolios, stock, market, watchlist, alerts) |
| `components/charts/` | Candlestick/area chart, allocation donut, performance, **P/L calendar** |
| `supabase/migrations/` | Schema, RLS policies, ticker seed |

---

## 🔌 Going live (add real keys safely)

Copy [`.env.example`](.env.example) → `.env.local` for local development. For
Vercel, do **not** upload `.env.local`; add the same keys in
**Vercel Project Settings → Environment Variables**.

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | [Supabase dashboard](https://supabase.com/dashboard) → Project Settings → API |
| `DATABASE_URL` | Supabase dashboard → Project Settings → Database → Connection string → URI |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | [Upstash console](https://console.upstash.com) → your Redis DB → REST |
| `CRON_SECRET` | long random string, e.g. `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | your deployed URL (e.g. `https://stockli.vercel.app`) |
| `PSX_DPS_BASE_URL` | default: `https://dps.psx.com.pk` |

Any *real* value flips the app out of demo mode automatically (see
[`lib/config.ts`](lib/config.ts)).

Security rules:

- Never commit `.env.local`, Supabase service-role keys, Upstash tokens, cron
  secrets, account passwords, or provider dashboard tokens.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never rename it with
  `NEXT_PUBLIC_` and never import the admin client into client components.
- Rotate any secret that was ever pasted into chat, logs, screenshots, or a
  public repo.
- See [SECURITY.md](SECURITY.md) before pushing or deploying.

### Database migrations

`npm run build` runs `npm run migrate` before `next build`. On Vercel this
applies every pending SQL file in `supabase/migrations/` automatically, records
checksums in `public.app_schema_migrations`, and fails the deployment if
`DATABASE_URL` is missing.

For local development, `npm run migrate` uses `.env.local` when
`DATABASE_URL` is present and skips cleanly when it is absent.

---

## 🚀 Deploy (Vercel Hobby, $0)

1. Push to GitHub → **Import** into Vercel (Hobby).
2. Add all env vars in Vercel Project Settings. Use Production + Preview values
   intentionally; avoid sharing production service-role keys with throwaway
   preview projects.
3. Deploy. Function `maxDuration` is set to 60s (Hobby limit). Pending
   migrations run automatically during the build.
4. **Scheduling** — Vercel Hobby cron runs **once per day max**, so:
   - [`vercel.json`](vercel.json) registers two daily crons: a Supabase
     keep‑alive ping and a backup price refresh. Both routes require
     `Authorization: Bearer <CRON_SECRET>`.
   - For the real ~15‑min refresh during market hours, point a free external
     scheduler ([cron‑job.org](https://cron-job.org)) at
     `GET https://<app>/api/cron/refresh` with header
     `Authorization: Bearer <CRON_SECRET>`, every 15 min, Mon–Fri ~09:30–15:30 PKT.

The refresh route is **idempotent** (sets latest snapshot / upserts daily P/L),
so duplicate or missed cron runs are safe.

---

## 🧩 Features

- **Accounts** — email/password + Google OAuth via Supabase Auth.
- **Multiple portfolios** — create/rename/delete; per‑portfolio P/L.
- **Holdings CRUD** — buys update a weighted‑average cost; sells reduce the
  position; every action is logged to an immutable **transaction audit log**.
- **Dashboard** — total value, unrealized/realized P/L, day change, **Performance
  vs KSE‑100** chart, sector allocation, best/worst performers, live holdings table.
- **Stock detail** — candlestick + area + intraday charts (Lightweight Charts),
  position summary, and a **large daily gain/loss calendar** (month‑grid heatmap).
- **Market** — live indices, KSE constituents, market performers, searchable
  sector performance, and per-sector stock drill-down pages.
- **Watchlists** & **price alerts** (above/below, evaluated each refresh).
- **Installable PWA** — Android/Desktop install prompt and iPhone/iPad Add to
  Home Screen support.
- **Polished, responsive UI** with dark mode, ⌘K search, tabular figures, and
  an emerald/finance palette.

---

## ⚖️ Data, legality & limits

- No official free PSX REST API exists; this scrapes the **public, no‑auth**
  `dps.psx.com.pk` endpoints (`/market-watch`, `/timeseries/eod`,
  `/timeseries/int`) — the same source the open‑source PSX ecosystem uses.
- Keep it **non‑commercial**, attribute PSX, rate‑limit politely, cache
  aggressively. To monetize, obtain a licence or switch the adapter to an
  authorised redistributor / paid feed.
- Market‑hours awareness (`lib/psx/market-hours.ts`) pauses writes off‑session
  and on Pakistani holidays (PKT, UTC+5, no DST).

## Scripts

```bash
npm run dev      # dev server
npm run migrate  # apply pending Supabase SQL migrations when DATABASE_URL is set
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```
