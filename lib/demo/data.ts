import type {
  Alert,
  AppNotification,
  Holding,
  Portfolio,
  Ticker,
  Transaction,
  Watchlist,
  WatchlistItem,
} from "@/lib/types";
import { SEED_TICKERS } from "@/lib/psx/symbols";

/**
 * Sample data served in DEMO MODE (no real Supabase keys). It exercises the
 * exact same render path as live data — only the source differs — so the UI
 * is fully navigable before credentials are added.
 */

export const DEMO_USER = {
  id: "demo-user-0000-0000-0000-000000000000",
  email: "demo@stockli.app",
  displayName: "Demo Investor",
};

/**
 * Synthetic identity for an unauthenticated visitor browsing with guest
 * access enabled (distinct from DEMO_USER — that's the deploy-time "no
 * Supabase configured" fallback; this is a real deployment, real Supabase,
 * just no session for this particular visitor).
 */
export const GUEST_USER = {
  id: "guest-standin-0000-0000-000000000000",
  email: null as string | null,
  displayName: "Guest",
};

export const DEMO_TICKERS: Ticker[] = SEED_TICKERS.map((t) => ({
  symbol: t.symbol,
  company_name: t.company,
  sector: t.sector,
  listed_in: "REG",
  is_active: true,
}));

export const DEMO_PORTFOLIOS: Portfolio[] = [
  {
    id: "demo-pf-core",
    user_id: DEMO_USER.id,
    name: "Long-Term Core",
    description: "Blue-chip buy-and-hold positions.",
    created_at: "2025-09-01T09:00:00.000Z",
  },
  {
    id: "demo-pf-trading",
    user_id: DEMO_USER.id,
    name: "Tactical Trades",
    description: "Shorter-horizon, higher-beta names.",
    created_at: "2026-01-15T09:00:00.000Z",
  },
];

export const DEMO_HOLDINGS: Holding[] = [
  // Long-Term Core
  h("demo-h-1", "demo-pf-core", "OGDC", 500, 150.25, "2025-09-03"),
  h("demo-h-2", "demo-pf-core", "LUCK", 120, 920.0, "2025-09-10"),
  h("demo-h-3", "demo-pf-core", "HBL", 800, 118.5, "2025-10-02"),
  h("demo-h-4", "demo-pf-core", "ENGRO", 300, 268.75, "2025-10-20"),
  h("demo-h-5", "demo-pf-core", "MEBL", 600, 178.4, "2025-11-05"),
  h("demo-h-6", "demo-pf-core", "FFC", 450, 128.9, "2025-12-01"),
  // Tactical Trades
  h("demo-h-7", "demo-pf-trading", "SYS", 200, 380.0, "2026-02-10"),
  h("demo-h-8", "demo-pf-trading", "TRG", 1500, 55.25, "2026-03-01"),
  h("demo-h-9", "demo-pf-trading", "MLCF", 2000, 49.8, "2026-03-18"),
  h("demo-h-10", "demo-pf-trading", "PSO", 350, 330.5, "2026-04-05"),
];

export const DEMO_TRANSACTIONS: Transaction[] = [
  tx("demo-tx-1", "demo-pf-core", "OGDC", "BUY", 500, 150.25, "2025-09-03"),
  tx("demo-tx-2", "demo-pf-core", "LUCK", "BUY", 100, 905.0, "2025-09-10"),
  tx("demo-tx-3", "demo-pf-core", "LUCK", "BUY", 20, 1000.0, "2025-12-12"),
  tx("demo-tx-4", "demo-pf-core", "HBL", "BUY", 800, 118.5, "2025-10-02"),
  tx("demo-tx-5", "demo-pf-core", "ENGRO", "BUY", 300, 268.75, "2025-10-20"),
  tx("demo-tx-6", "demo-pf-core", "MEBL", "BUY", 600, 178.4, "2025-11-05"),
  tx("demo-tx-7", "demo-pf-core", "FFC", "BUY", 450, 128.9, "2025-12-01"),
  tx("demo-tx-8", "demo-pf-trading", "SYS", "BUY", 200, 380.0, "2026-02-10"),
  tx("demo-tx-9", "demo-pf-trading", "TRG", "BUY", 1500, 55.25, "2026-03-01"),
  tx("demo-tx-10", "demo-pf-trading", "MLCF", "BUY", 2000, 49.8, "2026-03-18"),
  tx("demo-tx-11", "demo-pf-trading", "PSO", "BUY", 400, 332.0, "2026-04-05"),
  tx("demo-tx-12", "demo-pf-trading", "PSO", "SELL", 50, 348.0, "2026-05-20"),
];

export const DEMO_WATCHLISTS: Watchlist[] = [
  {
    id: "demo-wl-1",
    user_id: DEMO_USER.id,
    name: "Watching",
    created_at: "2025-09-01T09:00:00.000Z",
  },
];

export const DEMO_WATCHLIST_ITEMS: WatchlistItem[] = [
  { id: "demo-wli-1", watchlist_id: "demo-wl-1", symbol: "MARI", created_at: "2026-01-02T09:00:00Z" },
  { id: "demo-wli-2", watchlist_id: "demo-wl-1", symbol: "PPL", created_at: "2026-01-02T09:00:00Z" },
  { id: "demo-wli-3", watchlist_id: "demo-wl-1", symbol: "INDU", created_at: "2026-02-11T09:00:00Z" },
  { id: "demo-wli-4", watchlist_id: "demo-wl-1", symbol: "NESTLE", created_at: "2026-03-09T09:00:00Z" },
  { id: "demo-wli-5", watchlist_id: "demo-wl-1", symbol: "HUBC", created_at: "2026-04-01T09:00:00Z" },
];

export const DEMO_ALERTS: Alert[] = [
  {
    id: "demo-al-1",
    user_id: DEMO_USER.id,
    symbol: "OGDC",
    condition: "ABOVE",
    target_price: 200,
    is_active: true,
    last_triggered_at: null,
    created_at: "2026-04-01T09:00:00Z",
  },
  {
    id: "demo-al-2",
    user_id: DEMO_USER.id,
    symbol: "TRG",
    condition: "BELOW",
    target_price: 45,
    is_active: true,
    last_triggered_at: null,
    created_at: "2026-04-12T09:00:00Z",
  },
  {
    id: "demo-al-3",
    user_id: DEMO_USER.id,
    symbol: "LUCK",
    condition: "ABOVE",
    target_price: 1200,
    is_active: false,
    last_triggered_at: "2026-05-30T10:21:00Z",
    created_at: "2026-02-20T09:00:00Z",
  },
];

export const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "demo-n-1",
    user_id: DEMO_USER.id,
    type: "ALERT",
    title: "OGDC is approaching your alert",
    body: "Target Rs 200.00 (rises above). Now Rs 178.45.",
    symbol: "OGDC",
    created_at: "2026-06-22T06:15:00.000Z",
  },
  {
    id: "demo-n-2",
    user_id: null,
    type: "MARKET",
    title: "Market opened",
    body: "PSX trading session is now live (09:30 PKT).",
    symbol: null,
    created_at: "2026-06-22T04:30:00.000Z",
  },
  {
    id: "demo-n-3",
    user_id: DEMO_USER.id,
    type: "ALERT",
    title: "LUCK hit your target",
    body: "Rose above Rs 1,200.00 — now Rs 1,205.30.",
    symbol: "LUCK",
    created_at: "2026-05-30T10:21:00.000Z",
  },
  {
    id: "demo-n-4",
    user_id: null,
    type: "MARKET",
    title: "Market closed",
    body: "PSX session ended (15:30 PKT).",
    symbol: null,
    created_at: "2026-06-19T10:30:00.000Z",
  },
];

// ── helpers ───────────────────────────────────────────────────

function h(
  id: string,
  portfolio_id: string,
  symbol: string,
  quantity: number,
  avg_buy_price: number,
  date: string
): Holding {
  return {
    id,
    portfolio_id,
    symbol,
    quantity,
    avg_buy_price,
    created_at: `${date}T09:00:00.000Z`,
    updated_at: `${date}T09:00:00.000Z`,
  };
}

function tx(
  id: string,
  portfolio_id: string,
  symbol: string,
  type: Transaction["type"],
  quantity: number,
  price: number,
  date: string
): Transaction {
  return {
    id,
    portfolio_id,
    symbol,
    type,
    quantity,
    price,
    fees: Math.round(quantity * price * 0.0015 * 100) / 100,
    note: null,
    transacted_at: `${date}T10:00:00.000Z`,
    created_at: `${date}T10:00:00.000Z`,
  };
}
