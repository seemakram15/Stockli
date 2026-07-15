import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { PSX_INDICES, SEED_TICKERS } from "@/lib/psx/symbols";
import { sanitizeSearchQuery } from "@/lib/security/validation";
import { getMufapFunds, type MufapFund, type MufapFundsData } from "@/lib/services/mufap";
import { getGlobalMarketInstruments } from "@/lib/services/global-markets";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchResultKind =
  | "stock"
  | "mutual-fund"
  | "etf"
  | "index"
  | "commodity"
  | "crypto"
  | "sector"
  | "page";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string | null;
  href: string;
  category: string;
  symbol: string;
  company: string | null;
  sector: string | null;
}

const SUPPORTED_INDEX_PAGES = new Set(["^GSPC", "^DJI", "^NDX", "^NSEI", "^BSESN", "^NSEBANK"]);
const SEARCH_LIMIT = 48;

const PAGE_RESULTS = [
  pageResult("page:psx", "Pakistan Stock Market", "Stocks, sectors, performers and PSX indexes", "/market"),
  pageResult("page:strategy", "Funds Daily Returns Report", "Estimated daily stock fund returns by AMC", "/market/strategy"),
  pageResult("page:mutual-funds", "Mutual Funds", "MUFAP funds, AMCs, NAVs and returns", "/market/mutual-funds"),
  pageResult("page:etfs", "Exchange Traded Funds", "ETF profiles, holdings and performance", "/market/etfs"),
  pageResult("page:us", "USA S&P 500", "US market indexes and large-cap stocks", "/market/us"),
  pageResult("page:india", "India Stock Market", "NSE and BSE index view", "/market/india"),
  pageResult("page:world", "World View", "Global market heat map and country indexes", "/market/world"),
  pageResult("page:oil", "Oil Market", "Crude, natural gas and refined energy futures", "/market/oil"),
  pageResult("page:commodities", "Commodities", "Metals, grains and soft commodity futures", "/market/commodities"),
  pageResult("page:crypto", "Crypto Market", "Top and trending cryptocurrency markets", "/market/crypto"),
] satisfies SearchResult[];

const CRYPTO_RESULTS = [
  ["BTC", "Bitcoin"],
  ["ETH", "Ethereum"],
  ["BNB", "BNB"],
  ["SOL", "Solana"],
  ["XRP", "XRP"],
  ["ADA", "Cardano"],
  ["DOGE", "Dogecoin"],
  ["AVAX", "Avalanche"],
].map(([symbol, name]) =>
  makeResult({
    id: `crypto:${symbol}`,
    kind: "crypto",
    title: symbol,
    subtitle: name,
    href: "/market/crypto",
    category: "Crypto",
  })
);

/** GET /api/search?q=ogd — ticker search by symbol or company name. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = sanitizeSearchQuery(searchParams.get("q"));
  const scope = searchParams.get("scope");
  if (q.length === 0) return searchResponse([]);

  const stockResults = await getStockResults(q);
  if (scope === "stocks") return searchResponse(stockResults);

  const fastResults = [
    ...stockResults,
    ...getPsxIndexResults(q),
    ...getSectorResults(q),
    ...getGlobalInstrumentResults(q),
    ...CRYPTO_RESULTS.filter((result) => matchesResult(result, q)),
    ...PAGE_RESULTS.filter((result) => matchesResult(result, q)),
  ];
  const fundResults = await getFundResults(q);
  const results = dedupeResults([...fastResults, ...fundResults]).slice(0, SEARCH_LIMIT);

  return searchResponse(results);
}

function searchResponse(results: SearchResult[]) {
  return NextResponse.json(
    { results },
    {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    }
  );
}

async function getStockResults(q: string) {
  let results: SearchResult[] = [];
  if (isDemoMode) {
    results = SEED_TICKERS.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) || t.company.toLowerCase().includes(q)
    )
      .slice(0, 20)
      .map((t) => stockResult(t.symbol, t.company, t.sector));
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tickers")
      .select("symbol, company_name, sector")
      .or(`symbol.ilike.%${q}%,company_name.ilike.%${q}%`)
      .eq("is_active", true)
      .limit(20);
    results =
      (data as { symbol: string; company_name: string | null; sector: string | null }[] | null)?.map(
        (t) => stockResult(t.symbol, t.company_name, t.sector)
      ) ?? [];
    // Fallback to the seed list if the table isn't populated yet.
    if (results.length === 0) {
      results = SEED_TICKERS.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) || t.company.toLowerCase().includes(q)
      )
        .slice(0, 20)
        .map((t) => stockResult(t.symbol, t.company, t.sector));
    }
  }

  return results;
}

function getPsxIndexResults(q: string) {
  return PSX_INDICES
    .filter((index) => `${index.symbol} ${index.name}`.toLowerCase().includes(q))
    .map((index) =>
      makeResult({
        id: `psx-index:${index.symbol}`,
        kind: "index",
        title: index.symbol,
        subtitle: index.name,
        href: "/market",
        category: "Indexes",
        symbol: index.symbol,
      })
    );
}

function getSectorResults(q: string) {
  const sectors = Array.from(new Set(SEED_TICKERS.map((ticker) => ticker.sector))).sort((a, b) =>
    a.localeCompare(b)
  );
  return sectors
    .filter((sector) => sector.toLowerCase().includes(q))
    .map((sector) =>
      makeResult({
        id: `sector:${sector}`,
        kind: "sector",
        title: sector,
        subtitle: "Pakistan Stock Market sector",
        href: `/market/sectors/${encodeURIComponent(sector)}`,
        category: "Sectors",
        sector,
      })
    );
}

function getGlobalInstrumentResults(q: string) {
  const universes = ["us", "india", "world", "commodities", "oil"] as const;
  return universes.flatMap((universe) =>
    getGlobalMarketInstruments(universe)
      .filter((item) => `${item.symbol} ${item.name} ${item.type} ${item.country ?? ""}`.toLowerCase().includes(q))
      .map((item) => {
        const isIndex = item.type.toLowerCase() === "index";
        const category = isIndex
          ? "Indexes"
          : item.type.toLowerCase() === "etf"
            ? "ETFs"
            : universe === "commodities" || universe === "oil"
              ? "Commodities"
              : "Stocks";
        const href =
          isIndex && SUPPORTED_INDEX_PAGES.has(item.symbol)
            ? `/market/${universe}/index/${encodeURIComponent(item.symbol)}`
            : `/market/${universe}`;
        return makeResult({
          id: `global:${universe}:${item.symbol}`,
          title: getMarketDisplaySymbol(item.symbol, item.displaySymbol),
          subtitle: `${item.name} · ${item.country ?? item.type}`,
          href,
          category,
          kind: category === "ETFs" ? "etf" : category === "Commodities" ? "commodity" : category === "Indexes" ? "index" : "stock",
          symbol: item.symbol,
          company: item.name,
          sector: item.type,
        });
      })
  );
}

async function getFundResults(q: string) {
  const settled = await withTimeout<PromiseSettledResult<MufapFundsData>[]>(
    Promise.allSettled([getMufapFunds(), getMufapFunds({ includeEtfs: true })]),
    1800,
    []
  );
  return settled.flatMap((result, index) => {
    if (result.status !== "fulfilled") return [];
    const kind = index === 0 ? "mutual-fund" : "etf";
    const category = index === 0 ? "Mutual Funds" : "ETFs";
    const basePath = index === 0 ? "/market/mutual-funds" : "/market/etfs";
    return result.value.funds
      .filter((fund) => fundMatches(fund, q))
      .slice(0, 14)
      .map((fund) =>
        makeResult({
          id: `${kind}:${fund.fundId ?? fund.name}`,
          kind,
          title: fund.name,
          subtitle: `${fund.amcShort || fund.amc} · ${fund.type}`,
          href: fund.fundId ? `${basePath}/${fund.fundId}` : basePath,
          category,
          company: fund.amc,
          sector: fund.type,
        })
      );
  });
}

function stockResult(symbol: string, company: string | null, sector: string | null) {
  return makeResult({
    id: `stock:${symbol}`,
    kind: "stock",
    title: symbol,
    subtitle: company ?? sector ?? "Stock",
    href: `/stock/${symbol}`,
    category: "Stocks",
    symbol,
    company,
    sector,
  });
}

function pageResult(id: string, title: string, subtitle: string, href: string) {
  return makeResult({ id, kind: "page", title, subtitle, href, category: "Pages" });
}

function makeResult({
  id,
  kind,
  title,
  subtitle,
  href,
  category,
  symbol = "",
  company = null,
  sector = null,
}: Omit<SearchResult, "symbol" | "company" | "sector"> &
  Partial<Pick<SearchResult, "symbol" | "company" | "sector">>): SearchResult {
  return { id, kind, title, subtitle, href, category, symbol, company, sector };
}

function fundMatches(fund: MufapFund, q: string) {
  return `${fund.name} ${fund.amc} ${fund.amcShort} ${fund.type} ${fund.category} ${fund.sector}`
    .toLowerCase()
    .includes(q);
}

function matchesResult(result: SearchResult, q: string) {
  return `${result.title} ${result.subtitle ?? ""} ${result.category} ${result.symbol} ${result.company ?? ""} ${result.sector ?? ""}`
    .toLowerCase()
    .includes(q);
}

function dedupeResults(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.id)) return false;
    seen.add(result.id);
    return true;
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), timeoutMs);
  });
  const value = await Promise.race([promise, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  return value;
}
