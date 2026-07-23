# Caching mechanism

How Stockli keeps screens fast without sacrificing quote accuracy across **market open**, **settlement**, and **closed** windows.

## Goals

1. **Speed** — paint from device cache instantly on revisit / navigation.
2. **Accuracy** — never freeze a mid-session or pre-settlement snapshot as “final”.
3. **Honesty** — badges show Open / Pre-open / Settling / Closed so users know why numbers move or freeze.

---

## Two clocks (do not confuse them)

| Helper | Meaning | Used for |
|---|---|---|
| `isMarketOpen()` | Continuous auction is live (PKT) | Trading UX only |
| `shouldRefreshPsxData()` | Pre-open **or** open **or** **+20 min post-close settlement** | **All PSX refresh / pause decisions** |
| `marketStatus()` | Label for badges (`open`, `pre-open`, `settling`, `closed`, `weekend`, `holiday`) | UI copy |

The free DPS feed lags ~10 minutes. We keep refreshing for **20 minutes after the official close** so the final print can land before we freeze the device cache.

Source of truth: [`lib/psx/market-hours.ts`](../lib/psx/market-hours.ts).

---

## State machine

```text
                    shouldRefreshPsxData() === true
              (pre-open | open | settling +20m after bell)
                                   │
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │ Poll / revalidate (~30–60s)                       │
        │ Paint: network ?? device snapshot (SWR)           │
        │ First PKT trading date of cycle: wipe PSX keys    │
        └──────────────────────────────────────────────────┘
                                   │
              after settlement / weekend / holiday / overnight
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │ If device snapshot exists AND acceptCacheWhen     │
        │   → pause network (SWR key null)                  │
        │ If snapshot missing OR stale / post-mutation      │
        │   → keep fetching while painting old snapshot     │
        └──────────────────────────────────────────────────┘
```

### Typical weekday (Mon–Thu, PKT)

| Time | Status | Client |
|---|---|---|
| Overnight → 09:14 | Closed | Frozen EOD snapshot (if present) |
| 09:15–09:32 | Pre-open | Wipe yesterday’s PSX device keys once; start polling |
| 09:32–15:30 | Open | Live poll; stale-while-revalidate |
| 15:30–15:50 | **Settling** | Still poll (catch final print) |
| After 15:50 | Closed | Freeze last settled snapshot |

### Friday

Two sessions + lunch. Lunch (~12:20–14:15) is **closed** (pause). Afternoon session opens a new live window on the **same** cycle id (PKT date) — we do **not** wipe again; polling resumes.

---

## Device cache layers

| Layer | Storage | Keys | Lifetime |
|---|---|---|---|
| Memory | In-process `Map` | Same as below | Tab session |
| Private | `sessionStorage` `stockli:private-resource:*` | `private:dashboard:…`, `private:portfolio-*:…`, `private:stock:…` | Tab / until logout sync |
| Public | IndexedDB `stockli-public-cache` | `public:psx-market:v3`, MUFAP, strategy, … | Until session wipe or overwrite |
| Quotes | `localStorage` `stockli:prices:*` | Per symbol set | Cleared on new PSX cycle |

**Never** put private portfolio data in IndexedDB.

Hydration must not run during `useState` init (SSR mismatch). Private/public storage is read in `useLayoutEffect` after mount — see [`lib/hooks/use-persistent-resource.ts`](../lib/hooks/use-persistent-resource.ts).

---

## `usePersistentResource` contract

```ts
usePersistentResource({
  cacheKey,
  url,
  refreshInterval,
  pauseWhen,        // e.g. () => !shouldRefreshPsxData()
  acceptCacheWhen,  // e.g. closed && isPortfolioCacheFresh / isClosedMarketSnapshotCurrent
  enabled,          // viewport lazy-load gate
})
```

| Rule | Behavior |
|---|---|
| Paint | Always `swr.data ?? deviceSnapshot` when `enabled` (never blank for “stale”) |
| Pause | Only if snapshot exists **and** `pauseWhen` **and** `acceptCacheWhen` passes |
| Stale closed snapshot | `acceptCacheWhen` fails → keep fetching while showing old data |
| `enabled: false` | No network; `data` null until section nears viewport |
| `refreshNow()` | Bypasses pause; writes memory + storage + SWR |

### Portfolio freshness

[`isPortfolioCacheFresh`](../lib/cache/portfolio-mutations.ts):

1. Fail if `savedAt` &lt; `stockli:portfolio-mutated-at[:userId]`
2. Else require snapshot ≥ last completed PSX session (`isClosedMarketSnapshotCurrent`)

Mutations call `markPortfolioMutated()` → same-tab `CustomEvent` + `localStorage` (cross-tab via `storage` + `usePortfolioMutationRefresh`).

---

## Session lifecycle wipe

[`PsxCacheLifecycle`](../components/cache/psx-cache-lifecycle.tsx) watches `psxSessionCycleId()` (PKT date while refreshing, else `""`).

On a **new** cycle it deletes only **PSX-tied** public keys:

- `public:psx-market:v3`
- `public:market-strategy`
- `public:mufap:mutual` / `public:mufap:etfs`

…and clears `stockli:prices:*`.

It does **not** wipe:

- Private portfolio / stock caches
- Global boards (`public:global-market:*`) — those follow non-PSX clocks

---

## What pauses vs what keeps polling

| Resource | Pause on PSX hours? |
|---|---|
| PSX market, hub PSX, MUFAP, strategy, private portfolio/stock/dashboard | Yes (`!shouldRefreshPsxData`) |
| Hub US / India / world / oil / commodities / crypto | **No** — match dedicated global pages |
| Pakistan fuel board | No pause (local schedule) |
| Viewport-gated sections | Network off until near viewport (`enabled`) |

---

## Navigation UX

[`RouteTransitionViewport`](../components/navigation/route-transition-provider.tsx) keeps the previous page mounted and shows a thin top progress bar. It must **not** replace the tree with a full-page skeleton — that would hide device cache paint.

---

## Server TTLs (brief)

| Window | Typical TTL |
|---|---|
| `shouldRefreshPsxData` | ~60s (`psxLiveCacheTtlSeconds`) |
| Closed | Until next pre-open (+ buffer), capped at 7 days |
| Global markets API | Fixed short TTL (independent of PSX) |
| `?fresh=1` / manual refresh / warmup | Bypass long closed TTLs |

Warmup ([`BackgroundCacheWarmup`](../components/background-cache-warmup.tsx) → `/api/background/warmup`) warms **server** caches; device IndexedDB is still written by the client after fetch.

---

## Developer checklist

When adding a cached screen:

1. Pick `public:` vs `private:` key prefix correctly.
2. For PSX data: `pauseWhen: () => !shouldRefreshPsxData()`.
3. For freeze eligibility: `acceptCacheWhen` that returns true only when closed **and** snapshot is current (use `isClosedMarketSnapshotCurrent` / `isPortfolioCacheFresh`).
4. Never use `acceptCacheWhen` to **hide** paint — only to allow pause.
5. Listen for portfolio mutations on private screens (`usePortfolioMutationRefresh`).
6. Do not gate day-P/L overrides on `!isMarketOpen()` — use `!shouldRefreshPsxData()` so settlement is consistent with live quotes.
7. Prefer viewport `enabled` for below-the-fold boards instead of fetching everything on mount.
8. Avoid reading `sessionStorage` / IndexedDB in `useState` initializers (hydration).

---

## Manual verification

1. **Closed revisit** — hard-refresh after a settled session → numbers appear from device cache within a frame; badge may say “device cache”.
2. **Open** — prices move on the ~30–60s cadence; cache badge shows “Refreshing…” while validating.
3. **Bell → Settling** — status becomes “Settling”; quotes still update for ~20 minutes.
4. **After settlement** — polling stops; frozen snapshot matches the last print.
5. **Next pre-open** — PSX device keys wipe once; live data returns.
6. **Trade while closed** — portfolio/stock pages refresh despite pause (mutation + `acceptCacheWhen`).
7. **Hub overnight** — US/crypto boards still update; PSX stays frozen.
8. **Cross-tab** — mutate portfolio in tab A; tab B refreshes via `storage`.

---

## Key files

| File | Role |
|---|---|
| `lib/psx/market-hours.ts` | Open / settlement / cycle id / TTLs |
| `lib/hooks/use-persistent-resource.ts` | Device cache + SWR + pause rules |
| `lib/cache/portfolio-mutations.ts` | Freshness + mutation events |
| `components/cache/psx-cache-lifecycle.tsx` | Daily PSX wipe |
| `components/cache/private-cache-lifecycle.tsx` | Private cache user sync |
| `lib/hooks/use-prices.ts` / `use-live-holdings.ts` | Quote overlay during live window |
| `docs/caching-mechanism.md` | This document |
