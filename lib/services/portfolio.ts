import "server-only";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getQuotes } from "@/lib/services/prices";
import { PSX_TIMEZONE } from "@/lib/constants";
import {
  allocationBySector,
  allocationByHolding,
  computeHoldingMetrics,
  computeRealizedPL,
  computeRealizedPositions,
  computeSummary,
  deriveHoldingCostStates,
  holdingCostKey,
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
import { sectorName } from "@/lib/psx/sectors";
import { normalizeSymbol, normalizeSymbols } from "@/lib/security/validation";
import type {
  Alert,
  DailyPL,
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
  const upper = normalizeSymbols(symbols, 100);
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
  (data as Ticker[] | null)?.forEach((t) =>
    map.set(t.symbol, { ...t, sector: sectorName(t.sector) })
  );
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
  return getHoldingsForPortfolioIds(portfolios.map((p) => p.id));
}

async function getHoldingsForPortfolioIds(ids: string[]): Promise<Holding[]> {
  if (isDemoMode) return DEMO_HOLDINGS.filter((h) => ids.includes(h.portfolio_id));
  const portfolioIds = ids.filter(Boolean);
  if (portfolioIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("holdings").select("*").in("portfolio_id", portfolioIds);
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

/** All BUY/SELL/etc. transactions for one symbol across the user's portfolios. */
export async function getTransactionsForSymbol(symbol: string): Promise<Transaction[]> {
  const sym = normalizeSymbol(symbol);
  if (!sym) return [];
  if (isDemoMode) {
    return DEMO_TRANSACTIONS.filter((t) => t.symbol.toUpperCase() === sym).sort((a, b) =>
      a.transacted_at.localeCompare(b.transacted_at)
    );
  }
  const supabase = await createClient();
  const { data: pfs } = await supabase.from("portfolios").select("id");
  const ids = (pfs as { id: string }[] | null)?.map((p) => p.id) ?? [];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("symbol", sym)
    .in("portfolio_id", ids)
    .order("transacted_at", { ascending: true });
  return (data as Transaction[] | null) ?? [];
}

/** Enrich raw holdings with tickers + quotes + metrics. */
export async function enrichHoldings(
  holdings: Holding[],
  transactions?: Transaction[]
): Promise<HoldingWithMetrics[]> {
  if (holdings.length === 0) return [];
  const costStates = transactions ? deriveHoldingCostStates(transactions) : null;
  const costAdjustedHoldings = holdings.map((holding) => {
    const state = costStates?.get(holdingCostKey(holding.portfolio_id, holding.symbol));
    if (!state || state.quantity <= 0 || !Number.isFinite(state.avgBuyPrice)) {
      return holding;
    }
    return { ...holding, avg_buy_price: state.avgBuyPrice };
  });
  const symbols = costAdjustedHoldings.map((h) => h.symbol);
  const [tickerMap, quoteMap, historicalPLMap] = await Promise.all([
    getTickerMap(symbols),
    getQuotes(symbols),
    getHistoricalPLBaseMap(costAdjustedHoldings),
  ]);
  return costAdjustedHoldings.map((h) =>
    computeHoldingMetrics(
      h,
      tickerMap.get(h.symbol.toUpperCase()) ?? null,
      quoteMap.get(h.symbol.toUpperCase()) ?? null,
      historicalPLMap.get(holdingPLKey(h.portfolio_id, h.symbol)) ?? null
    )
  );
}

async function getHistoricalPLBaseMap(holdings: Holding[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (isDemoMode || holdings.length === 0) return map;

  const portfolioIds = Array.from(new Set(holdings.map((h) => h.portfolio_id).filter(Boolean)));
  if (portfolioIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_pl")
    .select("portfolio_id,symbol,day_pl")
    .in("portfolio_id", portfolioIds)
    .lt("date", todayInPkt());

  for (const row of (data as Pick<DailyPL, "portfolio_id" | "symbol" | "day_pl">[] | null) ?? []) {
    const key = holdingPLKey(row.portfolio_id, row.symbol);
    map.set(key, (map.get(key) ?? 0) + Number(row.day_pl ?? 0));
  }
  return map;
}

function holdingPLKey(portfolioId: string, symbol: string) {
  return `${portfolioId}:${symbol.toUpperCase()}`;
}

function todayInPkt(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PSX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A single portfolio with enriched holdings + summary. */
export async function getPortfolioView(id: string): Promise<PortfolioWithMetrics | null> {
  const portfolio = await getPortfolio(id);
  if (!portfolio) return null;
  const [holdings, transactions] = await Promise.all([
    getHoldings(id),
    getTransactions(id),
  ]);
  const enriched = await enrichHoldings(holdings, transactions);
  const realized = computeRealizedPL(transactions);
  const realizedPositions = computeRealizedPositions(transactions);
  return {
    ...portfolio,
    holdings: enriched,
    transactions,
    realizedPositions,
    summary: computeSummary(enriched, realized),
  };
}

export interface DashboardData {
  portfolios: Portfolio[];
  holdings: HoldingWithMetrics[];
  summary: ReturnType<typeof computeSummary>;
  sectorAllocation: ReturnType<typeof allocationBySector>;
  holdingAllocation: ReturnType<typeof allocationByHolding>;
  transactions: Transaction[];
  topGainers: HoldingWithMetrics[];
  topLosers: HoldingWithMetrics[];
}

/** Everything the dashboard needs, aggregated across all portfolios. */
export async function getDashboard(): Promise<DashboardData> {
  const portfolios = await getPortfolios();
  const [holdings, transactions] = await Promise.all([
    getHoldingsForPortfolioIds(portfolios.map((p) => p.id)),
    getTransactions(),
  ]);
  const enriched = await enrichHoldings(holdings, transactions);
  const realized = computeRealizedPL(transactions);
  const byDay = [...enriched].sort((a, b) => b.dayChange - a.dayChange);

  return {
    portfolios,
    holdings: enriched,
    summary: computeSummary(enriched, realized),
    sectorAllocation: allocationBySector(enriched),
    holdingAllocation: allocationByHolding(enriched),
    transactions,
    topGainers: byDay.filter((h) => h.dayChange > 0).slice(0, 3),
    topLosers: byDay.filter((h) => h.dayChange < 0).reverse().slice(0, 3),
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
