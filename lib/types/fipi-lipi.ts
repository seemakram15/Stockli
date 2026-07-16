/**
 * FIPI / LIPI shared shape — client-safe (no server-only imports), so both the
 * scraper service and the board can use these constants and types.
 *
 * All money figures are ABSOLUTE USD (NCCPL publishes US$ millions); the UI
 * scales them and converts to PKR with `usdPkrRate`.
 */

export const FIPI_CATEGORIES = [
  "Foreign Corporate",
  "Foreign Individual",
  "Overseas Pakistani",
] as const;

export const LIPI_CATEGORIES = [
  "Individuals",
  "Companies",
  "Banks / DFI",
  "NBFC",
  "Mutual Funds",
  "Other",
  "Brokers",
  "Insurance",
] as const;

export const FLOW_SECTORS = [
  "Banks",
  "OMCs",
  "E&Ps",
  "Cement",
  "Fertilizer",
  "FMCGs",
  "IPPs",
  "Telecom",
  "Textile",
  "Others",
  "Debt Mkt.",
] as const;

/** Plain-English meaning of each column, for the on-page glossary. */
export const COLUMN_GLOSSARY: { term: string; meaning: string }[] = [
  { term: "FIPI", meaning: "Foreign Investors Portfolio Investment — money traded by investors based outside Pakistan." },
  { term: "LIPI", meaning: "Local Investors Portfolio Investment — money traded by investors inside Pakistan." },
  { term: "Buy", meaning: "Total value of shares this group bought that day." },
  { term: "Sell", meaning: "Total value of shares this group sold that day." },
  { term: "Net", meaning: "Buy minus Sell. Green means they bought more than they sold; red means they sold more." },
  { term: "FYTD", meaning: "Running total since the fiscal year began on 1 July." },
  { term: "CYTD", meaning: "Running total since the calendar year began on 1 January." },
];

/** Plain-English meaning of each PSX sector bucket. */
export const SECTOR_GLOSSARY: { term: string; meaning: string }[] = [
  { term: "Banks", meaning: "Commercial banks — the largest sector on PSX (e.g. MCB, UBL, Meezan)." },
  { term: "OMCs", meaning: "Oil Marketing Companies — fuel retailers (e.g. PSO, APL, Shell)." },
  { term: "E&Ps", meaning: "Exploration & Production — oil and gas producers (e.g. OGDC, PPL, MARI)." },
  { term: "Cement", meaning: "Cement manufacturers (e.g. Lucky, DG Khan, Maple Leaf)." },
  { term: "Fertilizer", meaning: "Fertilizer manufacturers (e.g. Engro, FFC, Fatima)." },
  { term: "FMCGs", meaning: "Fast-Moving Consumer Goods — everyday household brands (e.g. Nestlé, Unilever)." },
  { term: "IPPs", meaning: "Independent Power Producers — private electricity generators (e.g. Hub Power)." },
  { term: "Telecom", meaning: "Telecom and internet operators (e.g. PTCL)." },
  { term: "Textile", meaning: "Textile mills — Pakistan's biggest export industry." },
  { term: "Others", meaning: "Every remaining sector not broken out into its own column." },
  { term: "Debt Mkt.", meaning: "Bonds and government debt traded on PSX — lending, not share ownership." },
];

export interface CategoryRow {
  label: string;
  /** Gross buy, absolute USD. */
  buy: number;
  /** Gross sell, absolute USD (positive number). */
  sell: number;
  /** buy − sell. Positive = net buying. */
  net: number;
  /** Net per sector, index-aligned to FLOW_SECTORS. Sums to `net`. */
  sectors: number[];
  /** Cumulative net for the running fiscal year (Jul→Jun). */
  fytd: number;
  /** Cumulative net for the running calendar year. */
  cytd: number;
}

export interface FipiLipiDay {
  /** YYYY-MM-DD (Pakistan local trading date). */
  date: string;
  fipi: CategoryRow[];
  /** FIPI totals row. */
  fipiNet: CategoryRow;
  lipi: CategoryRow[];
  /** LIPI totals row. */
  lipiNet: CategoryRow;
}

export interface FipiLipiData {
  days: FipiLipiDay[];
  /** Available trading dates, oldest → newest. Drives the date picker. */
  dates: string[];
  latest: FipiLipiDay | null;
  usdPkrRate: number;
  /** Label for the running fiscal-year column, e.g. "FY27TD". */
  fyLabel: string;
  /** Label for the running calendar-year column, e.g. "CY26TD". */
  cyLabel: string;
  updatedAt: string;
  /** "nccpl": all real. "sample": all placeholder. "mixed": recent days real, older days sample-filled. */
  source: "nccpl" | "sample" | "mixed";
}
