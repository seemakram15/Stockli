import "server-only";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getQuotes } from "@/lib/services/prices";
import {
  allocationBySector,
  allocationByHolding,
  computeHoldingMetrics,
  computeRealizedPL,
  computeSummary,
} from "@/lib/services/metrics";
import {
  DEMO_ALERTS,
  DEMO_HOLDINGS,
  DEMO_PORTFOLIOS,
  DEMO_TICKERS,
  DEMO_TRANSACTIONS,
  DEMO_USER,
  DEMO_WATCHLISTS,
  DEMO_WATCHLIST_ITEMS,
} from "@/lib/demo/data";
import { SEED_TICKERS } from "@/lib/psx/symbols";
import type {
  Alert,
  Holding,
  HoldingWithMetrics,
  Portfolio,
  PortfolioWithMetrics,
  Ticker,
  Transaction,
} from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

/** Current user (demo user in DEMO MODE, else Supabase auth). */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (isDemoMode) {
    return { id: DEMO_USER.id, email: DEMO_USER.email, displayName: DEMO_USER.displayName };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata?.display_name as string) ?? null,
  };
}

/** Ticker metadata for a set of symbols (DB table, seed-backed fallback). */
export async function getTickerMap(symbols: string[]): Promise<Map<string, Ticker>> {
  const upper = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const map = new Map<string, Ticker>();
  if (upper.length === 0) return map;

  if (isDemoMode) {
    DEMO_TICKERS.filter((t) => upper.includes(t.symbol)).forEach((t) =>
      map.set(t.symbol, t)
    );
    return fillFromSeed(map, upper);
  }

  const supabase = await createClient();
  const { data } = await supabase.from("tickers").select("*").in("symbol", upper);
  (data as Ticker[] | null)?.forEach((t) => map.set(t.symbol, t));
  return fillFromSeed(map, upper);
}

function fillFromSeed(map: Map<string, Ticker>, symbols: string[]): Map<string, Ticker> {
  for (const sym of symbols) {
    if (map.has(sym)) continue;
    const seed = SEED_TICKERS.find((s) => s.symbol === sym);
    map.set(sym, {
      symbol: sym,
      company_name: seed?.company ?? sym,
      sector: seed?.sector ?? null,
      listed_in: "REG",
      is_active: true,
    });
  }
  return map;
}

export async function getPortfolios(): Promise<Portfolio[]> {
  if (isDemoMode) return DEMO_PORTFOLIOS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolios")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as Portfolio[] | null) ?? [];
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  if (isDemoMode) return DEMO_PORTFOLIOS.find((p) => p.id === id) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("portfolios").select("*").eq("id", id).single();
  return (data as Portfolio | null) ?? null;
}

export async function getHoldings(portfolioId: string): Promise<Holding[]> {
  if (isDemoMode) return DEMO_HOLDINGS.filter((h) => h.portfolio_id === portfolioId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("holdings")
    .select("*")
    .eq("portfolio_id", portfolioId);
  return (data as Holding[] | null) ?? [];
}

export async function getAllHoldings(): Promise<Holding[]> {
  if (isDemoMode) return DEMO_HOLDINGS;
  const portfolios = await getPortfolios();
  const ids = portfolios.map((p) => p.id);
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("holdings").select("*").in("portfolio_id", ids);
  return (data as Holding[] | null) ?? [];
}

export async function getTransactions(portfolioId?: string): Promise<Transaction[]> {
  if (isDemoMode) {
    const list = portfolioId
      ? DEMO_TRANSACTIONS.filter((t) => t.portfolio_id === portfolioId)
      : DEMO_TRANSACTIONS;
    return [...list].sort((a, b) => b.transacted_at.localeCompare(a.transacted_at));
  }
  const supabase = await createClient();
  let q = supabase.from("transactions").select("*").order("transacted_at", { ascending: false });
  if (portfolioId) q = q.eq("portfolio_id", portfolioId);
  const { data } = await q;
  return (data as Transaction[] | null) ?? [];
}

/** Enrich raw holdings with tickers + quotes + metrics. */
export async function enrichHoldings(
  holdings: Holding[]
): Promise<HoldingWithMetrics[]> {
  if (holdings.length === 0) return [];
  const symbols = holdings.map((h) => h.symbol);
  const [tickerMap, quoteMap] = await Promise.all([
    getTickerMap(symbols),
    getQuotes(symbols),
  ]);
  return holdings.map((h) =>
    computeHoldingMetrics(
      h,
      tickerMap.get(h.symbol.toUpperCase()) ?? null,
      quoteMap.get(h.symbol.toUpperCase()) ?? null
    )
  );
}

/** A single portfolio with enriched holdings + summary. */
export async function getPortfolioView(id: string): Promise<PortfolioWithMetrics | null> {
  const portfolio = await getPortfolio(id);
  if (!portfolio) return null;
  const [holdings, transactions] = await Promise.all([
    getHoldings(id),
    getTransactions(id),
  ]);
  const enriched = await enrichHoldings(holdings);
  const realized = computeRealizedPL(transactions);
  return {
    ...portfolio,
    holdings: enriched,
    summary: computeSummary(enriched, realized),
  };
}

export interface DashboardData {
  portfolios: Portfolio[];
  holdings: HoldingWithMetrics[];
  summary: ReturnType<typeof computeSummary>;
  sectorAllocation: ReturnType<typeof allocationBySector>;
  holdingAllocation: ReturnType<typeof allocationByHolding>;
  topGainers: HoldingWithMetrics[];
  topLosers: HoldingWithMetrics[];
}

/** Everything the dashboard needs, aggregated across all portfolios. */
export async function getDashboard(): Promise<DashboardData> {
  const [portfolios, holdings, transactions] = await Promise.all([
    getPortfolios(),
    getAllHoldings(),
    getTransactions(),
  ]);
  const enriched = await enrichHoldings(holdings);
  const realized = computeRealizedPL(transactions);
  const byPerf = [...enriched].sort((a, b) => b.unrealizedPLPct - a.unrealizedPLPct);

  return {
    portfolios,
    holdings: enriched,
    summary: computeSummary(enriched, realized),
    sectorAllocation: allocationBySector(enriched),
    holdingAllocation: allocationByHolding(enriched),
    topGainers: byPerf.slice(0, 3),
    topLosers: byPerf.slice(-3).reverse(),
  };
}

// ── Watchlist & alerts ────────────────────────────────────────

export async function getWatchlistSymbols(): Promise<string[]> {
  if (isDemoMode) return DEMO_WATCHLIST_ITEMS.map((i) => i.symbol);
  const supabase = await createClient();
  const { data: lists } = await supabase.from("watchlists").select("id");
  const ids = (lists as { id: string }[] | null)?.map((l) => l.id) ?? [];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("watchlist_items")
    .select("symbol")
    .in("watchlist_id", ids);
  return (data as { symbol: string }[] | null)?.map((i) => i.symbol) ?? [];
}

export async function getAlerts(): Promise<Alert[]> {
  if (isDemoMode) return DEMO_ALERTS;
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Alert[] | null) ?? [];
}

export function getDemoWatchlistName(): string {
  return DEMO_WATCHLISTS[0]?.name ?? "Watchlist";
}
