/**
 * Shared domain & database types.
 *
 * DB row types mirror the Supabase schema in supabase/migrations.
 * Computed/domain types are derived in the service layer.
 */

// ── PSX data layer ────────────────────────────────────────────

/** One row of the PSX /market-watch table, normalised. */
export interface MarketWatchRow {
  symbol: string;
  sector: string | null;
  listedIn: string | null;
  ldcp: number | null; // last day close price
  open: number | null;
  high: number | null;
  low: number | null;
  current: number;
  change: number;
  changePct: number;
  volume: number | null;
  capturedAt?: string;
}

/** A point-in-time quote for one symbol (what the UI consumes). */
export interface Quote {
  symbol: string;
  price: number;
  ldcp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number;
  changePct: number;
  volume: number | null;
  capturedAt: string; // ISO timestamp
}

/** OHLC candle for the candlestick chart. */
export interface Candle {
  time: number; // unix epoch seconds (UTC day)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/** A simple time/value point (line/area series). */
export interface SeriesPoint {
  time: number; // unix epoch seconds
  value: number;
}

/** Live summary of a PSX index (from /indices). */
export interface IndexSummary {
  symbol: string;
  current: number;
  change: number;
  changePct: number;
  high: number | null;
  low: number | null;
}

/** A constituent of an index (from /indices/{symbol}) incl. official weight. */
export interface IndexConstituent {
  symbol: string;
  name: string | null;
  ldcp: number | null;
  current: number;
  change: number;
  changePct: number;
  weight: number; // IDX WTG (%)
  idxPoint: number | null;
  volume: number | null;
}

// ── Database rows ─────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  base_currency: string;
  tax_filer: boolean;
  broker_fee_pct: number;
  zakat_on_dividends: boolean;
  cgt_rate_override: number | null;
  created_at: string;
}

export interface TaxSettings {
  taxFiler: boolean;
  brokerFeePct: number;
  zakatOnDividends: boolean;
  cgtRateOverride: number | null;
}

export interface CdcDividend {
  id: string;
  portfolio_id: string;
  symbol: string;
  company_name: string;
  warrant_no: string | null;
  issue_date: string | null;
  payment_date: string;
  financial_year: string | null;
  rate_per_security: number;
  no_of_securities: number;
  gross_amount: number;
  zakat_deducted: number;
  tax_deducted: number;
  net_amount: number;
  payment_status: string;
  created_at: string;
}

export interface CdcParsedData {
  companyName: string;
  symbol: string;
  matchedCompanyName?: string;
  warrantNo: string;
  issueDate: string;
  paymentDate: string;
  financialYear: string;
  ratePerSecurity: number;
  noOfSecurities: number;
  grossAmount: number;
  zakatDeducted: number;
  taxDeducted: number;
  netAmount: number;
  paymentStatus: string;
  symbolConfidence: "high" | "low" | "none";
}

export interface ReceivedDividend {
  id?: string;
  symbol: string;
  companyName?: string;
  creditedOn: string;
  perShare: number;
  quantityHeld: number;
  grossAmount: number;
  whtAmount: number;
  zakatAmount: number;
  netAmount: number;
  financialYear?: string;
  warranNo?: string;
  source?: "cdc" | "auto" | "history";
}

export interface UpcomingDividend {
  symbol: string;
  company: string;
  payout: string;
  bookClosureFrom: string;
  bookClosureTo: string;
  currentQty: number;
}

export interface DividendIncomeSummary {
  received: ReceivedDividend[];
  upcoming: UpcomingDividend[];
  totalGross: number;
  totalWHT: number;
  totalZakat: number;
  totalNet: number;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Ticker {
  symbol: string;
  company_name: string | null;
  sector: string | null;
  listed_in: string | null;
  is_active: boolean;
}

export interface Holding {
  id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "BUY" | "SELL" | "ADD" | "EDIT" | "REMOVE";

export interface Transaction {
  id: string;
  portfolio_id: string;
  symbol: string;
  type: TransactionType;
  quantity: number;
  price: number;
  fees: number;
  note: string | null;
  transacted_at: string;
  created_at: string;
}

export interface PriceSnapshot {
  symbol: string;
  price: number;
  ldcp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  change: number;
  change_pct: number;
  volume: number | null;
  captured_at: string;
}

export interface DailyPL {
  id: string;
  portfolio_id: string;
  symbol: string;
  date: string; // YYYY-MM-DD
  open_value: number;
  close_value: number;
  day_pl: number;
  day_pl_pct: number;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  created_at: string;
}

export type NotificationType = "ALERT" | "MARKET" | "SYSTEM" | "PORTFOLIO" | "WATCHLIST" | "NEWS";

export interface AppNotification {
  id: string;
  user_id: string | null; // null = global (e.g. market events)
  type: NotificationType;
  title: string;
  body: string | null;
  symbol: string | null;
  href?: string | null;
  created_at: string;
}

export type AlertCondition = "ABOVE" | "BELOW";

export interface Alert {
  id: string;
  user_id: string;
  symbol: string;
  condition: AlertCondition;
  target_price: number;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

// ── Computed / domain ─────────────────────────────────────────

/** A holding enriched with live quote + computed P/L metrics. */
export interface HoldingWithMetrics extends Holding {
  ticker: Ticker | null;
  quote: Quote | null;
  livePrice: number;
  marketValue: number;
  costBasis: number;
  historicalPLBase?: number | null;
  unrealizedPL: number;
  unrealizedPLPct: number;
  dayChange: number; // value change today
  dayChangePct: number;
}

/** Aggregate metrics across a set of holdings. */
export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPL: number;
  totalPLPct: number;
  dayPL: number;
  dayPLPct: number;
  holdingsCount: number;
  realizedPL: number;
}

export interface RealizedPositionPL {
  symbol: string;
  quantitySold: number;
  proceeds: number;
  costBasis: number;
  fees: number;
  realizedPL: number;
  realizedPLPct: number;
  tradesCount: number;
  lastSoldAt: string | null;
}

export interface PortfolioWithMetrics extends Portfolio {
  holdings: HoldingWithMetrics[];
  transactions: Transaction[];
  realizedPositions: RealizedPositionPL[];
  summary: PortfolioSummary;
  dividendIncome: DividendIncomeSummary;
  taxSettings: TaxSettings;
}

/** Allocation slice for pie charts. */
export interface AllocationSlice {
  label: string;
  value: number;
  pct: number;
}
