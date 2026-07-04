import "server-only";
import { parse, type HTMLElement } from "node-html-parser";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import type { MarketUniverse } from "@/lib/services/global-markets";

export interface GlobalIndexConstituent {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  country: string | null;
}

export interface GlobalIndexConstituentsData {
  market: MarketUniverse;
  symbol: string;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  updatedAt: string;
  constituents: GlobalIndexConstituent[];
  note: string | null;
}

interface IndexConfig {
  title: string;
  description: string;
  sourceUrl: string;
  sourceLabel?: string;
  country: string;
  exchange: string;
  symbolSuffix?: string;
  staticConstituents?: GlobalIndexConstituent[];
}

const INDEX_CONFIGS: Record<string, IndexConfig> = {
  "^GSPC": {
    title: "S&P 500 constituents",
    description: "Large-cap US companies in the S&P 500 index.",
    sourceUrl: "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
    country: "United States",
    exchange: "NYSE/Nasdaq",
  },
  "^DJI": {
    title: "Dow Jones Industrial Average constituents",
    description: "Thirty US blue-chip stocks in the Dow Jones Industrial Average.",
    sourceUrl: "https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average",
    country: "United States",
    exchange: "NYSE/Nasdaq",
  },
  "^NDX": {
    title: "Nasdaq 100 constituents",
    description: "The largest non-financial companies listed on Nasdaq.",
    sourceUrl: "https://en.wikipedia.org/wiki/Nasdaq-100",
    country: "United States",
    exchange: "Nasdaq",
  },
  "^NSEI": {
    title: "NIFTY 50 constituents",
    description: "Large Indian companies in the NIFTY 50 index.",
    sourceUrl: "https://en.wikipedia.org/wiki/NIFTY_50",
    country: "India",
    exchange: "NSE",
    symbolSuffix: ".NS",
  },
  "^BSESN": {
    title: "SENSEX constituents",
    description: "Large Indian companies in the BSE SENSEX index.",
    sourceUrl: "https://en.wikipedia.org/wiki/BSE_SENSEX",
    country: "India",
    exchange: "BSE",
    symbolSuffix: ".BO",
  },
  "^NSEBANK": {
    title: "NIFTY Bank constituents",
    description: "Indian banking stocks tracked by the NIFTY Bank index.",
    sourceUrl: "https://www.niftyindices.com/indices/equity/sectoral-indices/nifty-bank",
    sourceLabel: "NSE Indices constituent list",
    country: "India",
    exchange: "NSE",
    staticConstituents: [
      bankNifty("AUBANK.NS", "AU Small Finance Bank"),
      bankNifty("AXISBANK.NS", "Axis Bank"),
      bankNifty("BANDHANBNK.NS", "Bandhan Bank"),
      bankNifty("BANKBARODA.NS", "Bank of Baroda"),
      bankNifty("FEDERALBNK.NS", "Federal Bank"),
      bankNifty("HDFCBANK.NS", "HDFC Bank"),
      bankNifty("ICICIBANK.NS", "ICICI Bank"),
      bankNifty("IDFCFIRSTB.NS", "IDFC First Bank"),
      bankNifty("INDUSINDBK.NS", "IndusInd Bank"),
      bankNifty("KOTAKBANK.NS", "Kotak Mahindra Bank"),
      bankNifty("PNB.NS", "Punjab National Bank"),
      bankNifty("SBIN.NS", "State Bank of India"),
    ],
  },
};

export function hasIndexConstituentSource(symbol: string) {
  return Boolean(INDEX_CONFIGS[symbol]);
}

export function getGlobalIndexTitle(symbol: string) {
  return INDEX_CONFIGS[symbol]?.title ?? friendlyIndexTitle(symbol);
}

export async function getGlobalIndexConstituents(
  market: MarketUniverse,
  symbol: string
): Promise<GlobalIndexConstituentsData> {
  const config = INDEX_CONFIGS[symbol];

  if (!config) {
    return {
      market,
      symbol,
      title: friendlyIndexTitle(symbol),
      description: "Constituent source is not configured for this index yet.",
      sourceLabel: "No constituent source",
      sourceUrl: "https://finance.yahoo.com/markets/",
      updatedAt: new Date().toISOString(),
      constituents: [],
      note: "This index can be tracked for price movement, but a reliable public constituent list has not been connected yet.",
    };
  }

  const constituents = config.staticConstituents ?? parseConstituentTable(await fetchHtml(config.sourceUrl), config);

  return {
    market,
    symbol,
    title: config.title,
    description: config.description,
    sourceLabel: config.sourceLabel ?? "Wikipedia index constituent table",
    sourceUrl: config.sourceUrl,
    updatedAt: new Date().toISOString(),
    constituents,
    note: constituents.length
      ? null
      : "The source page loaded, but its constituent table could not be parsed.",
  };
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Stockli/1.0; +https://stock-portfolio-khaki.vercel.app)",
    },
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!res.ok) throw new Error(`Index constituent request failed: ${res.status}`);
  return res.text();
}

function parseConstituentTable(html: string, config: IndexConfig) {
  const root = parse(html);
  const tables = root.querySelectorAll("table.wikitable");

  for (const table of tables) {
    const rows = table.querySelectorAll("tr");
    const headerCells = rows[0]?.querySelectorAll("th,td") ?? [];
    const headers = headerCells.map((cell) => clean(cell.text).toLowerCase());
    const symbolIndex = findHeader(headers, ["symbol", "ticker"]);
    const nameIndex = findHeader(headers, ["security", "company", "company name", "constituent"]);

    if (symbolIndex === -1 || nameIndex === -1) continue;

    const sectorIndex = findHeader(headers, ["gics sector", "sector"]);
    const industryIndex = findHeader(headers, ["gics sub-industry", "sub-industry", "industry"]);

    const constituents = rows.slice(1)
      .map((row) => parseRow(row, {
        symbolIndex,
        nameIndex,
        sectorIndex,
        industryIndex,
        config,
      }))
      .filter(Boolean) as GlobalIndexConstituent[];

    if (constituents.length) return constituents;
  }

  return [];
}

function parseRow(
  row: HTMLElement,
  {
    symbolIndex,
    nameIndex,
    sectorIndex,
    industryIndex,
    config,
  }: {
    symbolIndex: number;
    nameIndex: number;
    sectorIndex: number;
    industryIndex: number;
    config: IndexConfig;
  }
) {
  const cells = row.querySelectorAll("th,td");
  const rawSymbol = clean(cells[symbolIndex]?.text ?? "");
  const name = clean(cells[nameIndex]?.text ?? "");
  if (!rawSymbol || !name) return null;

  return {
    symbol: normalizeSymbol(rawSymbol, config.symbolSuffix),
    name,
    sector: sectorIndex >= 0 ? nullable(clean(cells[sectorIndex]?.text ?? "")) : null,
    industry: industryIndex >= 0 ? nullable(clean(cells[industryIndex]?.text ?? "")) : null,
    exchange: config.exchange,
    country: config.country,
  };
}

function normalizeSymbol(symbol: string, suffix?: string) {
  const cleaned = clean(symbol);
  if (!suffix) return cleaned.replace(/\./g, "-");
  if (cleaned.endsWith(suffix)) return cleaned;
  return `${cleaned.replace(new RegExp(`${escapeRegex(suffix)}$`, "i"), "")}${suffix}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHeader(headers: string[], needles: string[]) {
  return headers.findIndex((header) => needles.some((needle) => header.includes(needle)));
}

function friendlyIndexTitle(symbol: string) {
  const map: Record<string, string> = {
    "^GSPC": "S&P 500 constituents",
    "^DJI": "Dow Jones Industrial Average constituents",
    "^NDX": "Nasdaq 100 constituents",
    "^NSEI": "NIFTY 50 constituents",
    "^BSESN": "SENSEX constituents",
    "^NSEBANK": "NIFTY Bank constituents",
  };
  return map[symbol] ?? `${getMarketDisplaySymbol(symbol)} constituents`;
}

function bankNifty(symbol: string, name: string): GlobalIndexConstituent {
  return {
    symbol,
    name,
    sector: "Financial Services",
    industry: "Banks",
    exchange: "NSE",
    country: "India",
  };
}

function nullable(value: string) {
  return value && value !== "-" ? value : null;
}

function clean(value: string) {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
