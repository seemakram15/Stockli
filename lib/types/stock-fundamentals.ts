export type StockFinancialTabId =
  | "overview"
  | "latest"
  | "income"
  | "balance"
  | "cashflow"
  | "ratios";

export interface FundamentalsCompany {
  id: number;
  value: number;
  label2: string;
  label: string;
  name: string;
  sector_id: number;
  sector: string;
  symbol: string;
  image?: string | null;
}

export interface FinancialMetric {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}

export interface FinancialTableRow {
  label: string;
  unit?: string | null;
  section?: string | null;
  isSection?: boolean;
  isBold?: boolean;
  values: Record<string, string | number | null>;
  sparkline: number[];
}

export interface FinancialTable {
  title: string;
  subtitle?: string;
  years: string[];
  rows: FinancialTableRow[];
}

export interface FinancialTabData {
  title: string;
  description: string;
  status: "ok" | "empty" | "error";
  message?: string;
  highlights?: FinancialMetric[];
  tables: FinancialTable[];
}

export interface StockFinancialsAvailability {
  complete: boolean;
  availableTabs: StockFinancialTabId[];
  missingTabs: StockFinancialTabId[];
  queued: boolean;
  attempts?: number;
  lastAttemptAt?: string | null;
  updatedAt: string;
  message?: string;
}

export interface StockFinancialsData {
  symbol: string;
  company: FundamentalsCompany | null;
  source: "fundamentals";
  updatedAt: string;
  tabs: Record<StockFinancialTabId, FinancialTabData>;
  availability?: StockFinancialsAvailability;
}

export interface StockFinancialPeerRow {
  symbol: string;
  companyName: string;
  sector: string;
  image?: string | null;
  values: Record<string, string | number | null>;
  sparkline: number[];
}

export interface StockFinancialPeerComparison {
  symbol: string;
  companyName: string;
  sector: string;
  tabId: Exclude<StockFinancialTabId, "overview">;
  metricLabel: string;
  periods: string[];
  peers: StockFinancialPeerRow[];
  updatedAt: string;
}

export type StockFinancialPeerPrepareStatus =
  | "ready"
  | "pending"
  | "fetching"
  | "done"
  | "error";

export interface StockFinancialPeerCandidate {
  symbol: string;
  companyName: string;
  sector: string;
  image?: string | null;
  /** True when a complete fundamentals snapshot is already cached. */
  ready: boolean;
  status: StockFinancialPeerPrepareStatus;
}

export type StockFinancialPeerPrepareProgress =
  | {
      type: "peers";
      sector: string;
      metricLabel: string;
      peers: StockFinancialPeerCandidate[];
      missingCount: number;
    }
  | {
      type: "peer";
      symbol: string;
      status: Exclude<StockFinancialPeerPrepareStatus, "ready" | "pending">;
      detail?: string;
    }
  | {
      type: "result";
      data: StockFinancialPeerComparison;
    };

export type StockFinancialsRefreshStepId =
  | "ready"
  | "overview"
  | "latest"
  | "income"
  | "balance"
  | "cashflow"
  | "ratios"
  | "persist"
  | "done";

export type StockFinancialsRefreshStepStatus =
  | "pending"
  | "active"
  | "done"
  | "error"
  | "skipped";

export interface StockFinancialsRefreshProgress {
  stepId: StockFinancialsRefreshStepId;
  status: StockFinancialsRefreshStepStatus;
  message: string;
  detail?: string;
}

export const STOCK_FINANCIALS_REFRESH_STEPS: Array<{
  id: StockFinancialsRefreshStepId;
  message: string;
}> = [
  { id: "ready", message: "Getting data ready…" },
  { id: "overview", message: "Adding overview…" },
  { id: "latest", message: "Adding latest results…" },
  { id: "income", message: "Adding income statements…" },
  { id: "balance", message: "Adding balance sheet…" },
  { id: "cashflow", message: "Adding cash flow…" },
  { id: "ratios", message: "Adding ratios…" },
  { id: "persist", message: "Saving snapshot…" },
  { id: "done", message: "Refresh complete" },
];
