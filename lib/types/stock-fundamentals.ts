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

export interface StockFinancialsData {
  symbol: string;
  company: FundamentalsCompany | null;
  source: "fundamentals";
  updatedAt: string;
  tabs: Record<StockFinancialTabId, FinancialTabData>;
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
