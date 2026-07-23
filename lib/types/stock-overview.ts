export interface StockKeyPerson {
  name: string;
  role: string;
}

export interface StockEquityProfile {
  marketCapBillions: number | null;
  shares: number | null;
  freeFloatShares: number | null;
  freeFloatPct: number | null;
  sharesUnit: "shares" | null;
}

export interface StockCompanyProfile {
  symbol: string;
  companyName: string | null;
  sector: string | null;
  description: string | null;
  keyPeople: StockKeyPerson[];
  address: string | null;
  website: string | null;
  equity: StockEquityProfile;
  /** Data provenance labels shown in the UI (e.g. SCS Trade, Wikipedia). */
  sources: string[];
  equitySources: string[];
  updatedAt: string;
}

export interface StockPayoutRow {
  id: string;
  symbol: string;
  /** Display date, e.g. "12 May 2025". */
  date: string;
  /** Sortable ISO date (YYYY-MM-DD) when known. */
  dateSort: string;
  /** Cash dividend percent of face value, when known. */
  payoutPercent: number | null;
  /** Display label, e.g. "85%". */
  payoutLabel: string;
  /** Cash amount per share in PKR, e.g. 8.5 for 85% of Rs 10. */
  amountPerShare: number | null;
  /** Book closure date display, e.g. "12 May 2025" or a from–to range. */
  bookClosureDate: string;
}

export interface StockPayoutHistory {
  symbol: string;
  rows: StockPayoutRow[];
  sourceLabel: string;
  updatedAt: string;
}

export interface StockOverviewData {
  symbol: string;
  profile: StockCompanyProfile;
  payouts: StockPayoutHistory;
  updatedAt: string;
}
