# Stockli — Handoff Document

_Last updated: 2026-06-22 · Branch: `main` · Latest commit: `613d26a`_

A free, serverless **PSX (Pakistan Stock Exchange) portfolio tracker**. This
document captures the current state, architecture, what's done, how to run it,
and what's left. Read alongside [README.md](README.md) (setup) and the inline
code comments.

---

## 1. Status at a glance

| Area | State |
|---|---|
| Build / typecheck / lint | ✅ Green (`npm run build`, `tsc --noEmit`, `npm run lint`) |
| Live data (PSX scrape) | ✅ Working — verified vs dps.psx (prices, indices, constituents, weights) |
| Supabase (DB + Auth + RLS) | ✅ Connected & migrated (project `vhljoftnpfleyuynkdvb`) |
| Upstash Redis cache | ✅ Connected (`comic-gorilla-152162`) |
| Deployment | ⛔ Not yet deployed to Vercel |
| Email notifications | ⛔ Not started (in-app only) |

The app runs **live** with real Supabase + Upstash keys today. It also has a
**DEMO MODE** (sample data, auth disabled) that activates automatically when the
keys are placeholders — useful for local UI work without a backend.

---

## 2. Tech stack

- **Next.js 15.5.19** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Radix base — see memory note below)
- **Supabase** `@supabase/ssr ^0.12` (Postgres + Auth + RLS)
- **Upstash Redis** `@upstash/redis ^1.38` (price/history cache)
- **TradingView Lightweight Charts v5** (candles/area) + **Recharts v3** (allocation/perf)
- **SWR v2** (client polling), **zod** (validation), **next-themes**, **sonner**

> ⚠️ **Node**: the machine default is v16 (too old). Use nvm **v22**:
> `export PATH="$HOME/.nvm/versions/node/v22.13.1/bin:$PATH"`.
> shadcn must stay on the **radix** base, not the default `base-nova` (Base UI),
> which has a different API. Re-init with `-b radix -p nova` if ever needed.

---

## 3. Architecture

```
[Browser] ── SWR poll /api/prices (30s) ──▶ [Next.js on Vercel]
  TopProgress bar on nav                     ├─ Server Components (dashboard, stock, market, admin…)
                                             ├─ Route handlers:
                                             │   /api/prices · /api/search · /api/index/[symbol]
                                             │   /api/notifications · /api/cron/refresh · /api/keep-alive
                                             │        │ cache miss
                                             │        ▼
                                             │   [Upstash Redis]  prices 15m · EOD 6h · intraday/indices 3–5m
                                             │        │
                                             │        ▼
                                             │   [PSX adapter] ─scrape─▶ dps.psx.com.pk  (live → mock fallback)
                                             └─ [Supabase Postgres + Auth + RLS]
[External cron] ─Bearer CRON_SECRET─▶ /api/cron/refresh (warm cache · daily P/L · alerts · notifications)
```

**The PSX source is swappable.** Everything goes through
[`lib/psx/adapter.ts`](lib/psx/adapter.ts) (`PsxDataSource`): a live scraper of
`dps.psx.com.pk` with retry/backoff and a deterministic mock fallback so the UI
never hard-fails.

### Key directories

| Path | What |
|---|---|
| `lib/psx/` | Adapter, sector-code→name map, market-hours, symbols/indices, mock generator |
| `lib/services/` | `prices`, `history` (cache), `market` (indices), `portfolio`, `stock`, `daily-pl`, `performance`, `metrics`, `admin`, `notifications` |
| `lib/actions/` | Server actions: `auth`, `portfolio`, `watchlist`, `alerts`, `admin`, `notifications` |
| `lib/auth/roles.ts` | Role helpers (`getSessionContext`, `isSuperadmin`, `requireSuperadmin`) |
| `lib/supabase/` | Browser / server / admin clients + session middleware |
| `app/(app)/` | Authenticated app (dashboard, portfolios, stock, market, watchlist, alerts, admin) |
| `app/(auth)/` | Login / signup |
| `components/charts/` | Price chart, allocation donut, performance, **P/L calendar**, sparkline |
| `components/market/` | Indices panel, constituents table |
| `components/shell/` | Header, nav, search, mobile nav, theme toggle, **notification bell** |
| `supabase/migrations/` | `0001`–`0005` (schema, RLS, ticker seed, roles, notifications) |
| `scripts/` | `create-superadmin.mjs` |

---

## 4. Live services & accounts

- **Supabase project**: `vhljoftnpfleyuynkdvb` (region ap-southeast-2). All 5
  migrations applied. ~488 tickers + price snapshots populated by the cron.
- **Upstash Redis**: `comic-gorilla-152162` (global, primary us-east-1).
- **Superadmin account**: created via `scripts/create-superadmin.mjs`
  (email is out-of-band; **password is NOT in the repo — rotate it**). A sample
  normal user also exists for testing the admin "view any user" feature.

> 🔒 **Secrets** live only in `.env.local` (gitignored — never committed). The
> Supabase **personal access token** and Upstash **API key** used during setup
> were shared in chat and **should be rotated**. Account passwords should be
> changed after first login.

### Environment variables (`.env.local`, see [.env.example](.env.example))

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`,
`PSX_DPS_BASE_URL`.

---

## 5. Database (migrations `0001`–`0005`)

Tables: `profiles` (incl. `role`, `notifications_seen_at`), `portfolios`,
`tickers`, `holdings`, `transactions`, `price_snapshots`, `daily_pl`,
`watchlists`, `watchlist_items`, `alerts`, `notifications`.

- **RLS on every user-owned table** (`auth.uid()` scoped). `tickers` &
  `price_snapshots` are public-read; `notifications` are read own + global.
- **Privilege-escalation protection**: a BEFORE-UPDATE trigger blocks any
  end-user from changing `profiles.role` unless already a superadmin
  (live-tested). Cross-user admin reads use the service-role client behind an
  explicit superadmin check.
- Triggers: auto-create profile + default portfolio + watchlist on signup;
  `updated_at` maintenance.

---

## 6. Feature inventory (done)

- **Auth**: email/password + Google OAuth (Supabase), session middleware, route guards.
- **Portfolios**: multiple; create/rename/delete; per-portfolio P/L.
- **Holdings**: BUY (weighted-avg cost) / SELL with **price auto-fill** from the
  latest quote; immutable **transaction audit log**.
- **Dashboard**: total value, unrealized/realized P/L, day change, **Performance
  vs KSE-100** (streamed via Suspense), sector allocation, movers, live holdings table.
- **Stock detail**: candlestick/area/intraday chart + **purchase-scoped daily
  gain/loss calendar** (position-aware, incremental cost-flow accounting).
- **Market**: live **indices** (KSE100 default) with values matching dps.psx,
  index **price chart**, returns (1D–YTD), 52-week range, and **constituents
  table with official index Weight %** (filtered per index, sorted by weight).
- **Watchlists**, **price alerts** (above/below).
- **Superadmin**: `/admin` platform dashboard, all-users list, per-user account
  view (eye icon), grant/revoke superadmin — role hidden from normal users.
- **Notifications** (in-app): bell with unread badge + dropdown; alert-triggered
  (per-user) and market open/close (global) events generated by the cron.
- **UX**: global top progress bar on navigation, per-route skeletons, dark-first
  responsive design, ⌘K search, Stockli brand (gradient logo + favicon).
- **Caching**: Upstash for prices (15m), EOD history (6h), intraday/indices (3–5m).

---

## 7. Known limitations / gotchas

- **Data is delayed ~15 min** (free PSX feed) and labelled as such. Not real-time.
- **Sector codes**: PSX returns numeric sector codes; ~25 are mapped to names in
  [`lib/psx/sectors.ts`](lib/psx/sectors.ts), the rest fall back to "Other".
  Extend the map if more sectors need names.
- **Index EOD** from PSX is the *previous* close; live index values come from
  `/indices` + intraday. EOD-derived returns/52w are close to (not identical to)
  the portal's official figures.
- **Market "break"** (Friday prayer break) is **not** modeled — only
  open/pre-open/closed/weekend/holiday transitions fire notifications.
- **Notifications require the external cron** to be running to fire in production.
- **Supabase free tier pauses after ~7 days idle** — `/api/keep-alive` (daily
  Vercel cron) mitigates this.
- The dashboard performance chart fetches EOD per holding on a cold cache; warm
  cache makes it fast. Consider warming held symbols' EOD in the cron if needed.

---

## 8. Pending / roadmap

**Not started**
- [ ] **Deploy to Vercel** (Hobby) — import repo, set env vars, configure crons.
- [ ] **External 15-min cron** (cron-job.org) → `GET /api/cron/refresh` with
      `Authorization: Bearer <CRON_SECRET>`, Mon–Fri ~09:30–15:30 PKT.
- [ ] **Email notifications** for alerts/market events (Resend/Supabase) — the
      in-app layer + cron hooks are ready to extend.
- [ ] Rotate the shared Supabase/Upstash tokens + superadmin password.

**Nice-to-have / enhancements**
- [ ] Model the Friday **market break** in `lib/psx/market-hours.ts` + notify.
- [ ] Constituent **sector sunburst** on the Market page (data already available).
- [ ] CSV import/export of transactions; dividend tracking (manual).
- [ ] Expand the **sector-code map** to reduce the "Other" bucket.
- [ ] Per-notification read state (currently a single `notifications_seen_at`).
- [ ] Tests (unit for `metrics`/`daily-pl` accounting; e2e for auth + trade flow).
- [ ] Warm EOD cache for held symbols in the cron for instant cold dashboards.

---

## 9. Run & deploy

```bash
nvm use 22            # Node 18.18+ required
npm install
npm run dev           # http://localhost:3000   (live with current .env.local)
npm run build         # production build
npm run lint          # eslint
node scripts/create-superadmin.mjs <email> <password>   # promote/create an admin
```

Deploy: push to GitHub → import to Vercel (Hobby) → add all env vars → ensure
migrations are applied (they are, on the current project) → set up the crons in
`vercel.json` (daily keep-alive + backup refresh) plus the external 15-min cron.
Full steps in [README.md](README.md).

---

## 10. Commit history

```
613d26a feat: nav progress bar, purchase-scoped P/L calendar, in-app notifications
5bae9c7 brand: rename Sahm → Stockli with new gradient logo + favicon
97662fe feat(market): live index data, index price chart, constituents with weights
16b6d28 perf: cache history + stream charts; market indices redesign; sector names; trade UX
6169b30 feat: PSX portfolio tracker with superadmin roles + admin dashboard
2245e79 Initial commit from Create Next App
```
