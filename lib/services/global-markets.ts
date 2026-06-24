import "server-only";
import { getStaleCached } from "@/lib/cache/stale";

export type MarketUniverse =
  | "us"
  | "india"
  | "world"
  | "commodities"
  | "oil"
  | "crypto";

export interface MarketInstrument {
  symbol: string;
  name: string;
  type: string;
  displaySymbol?: string;
  country?: string;
  region?: string;
  currency?: string;
  x?: number;
  y?: number;
}

export interface GlobalMarketQuote extends MarketInstrument {
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  source: "Yahoo Finance" | "CoinGecko";
  updatedAt: string | null;
  trendRank?: number | null;
}

export interface GlobalMarketData {
  universe: MarketUniverse;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  quotes: GlobalMarketQuote[];
  summary: {
    advancers: number;
    decliners: number;
    flat: number;
    avgChangePct: number;
    best: GlobalMarketQuote | null;
    worst: GlobalMarketQuote | null;
  };
}

const YAHOO_CHART_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h";
const COINGECKO_TRENDING = "https://api.coingecko.com/api/v3/search/trending";
const GLOBAL_MARKET_TTL_SECONDS = 60;
const GLOBAL_MARKET_STALE_SECONDS = 15 * 60;

const UNIVERSES: Record<Exclude<MarketUniverse, "crypto">, { title: string; description: string; items: MarketInstrument[] }> = {
  us: {
    title: "USA S&P 500",
    description: "Live US index view with major S&P 500 constituents and index ETFs.",
    items: [
      ["^GSPC", "S&P 500", "Index"],
      ["^DJI", "Dow Jones Industrial Average", "Index"],
      ["^NDX", "Nasdaq 100", "Index"],
      ["^VIX", "CBOE Volatility Index", "Volatility"],
      ["SPY", "SPDR S&P 500 ETF Trust", "ETF"],
      ["IVV", "iShares Core S&P 500 ETF", "ETF"],
      ["VOO", "Vanguard S&P 500 ETF", "ETF"],
      ["AAPL", "Apple", "Stock"],
      ["MSFT", "Microsoft", "Stock"],
      ["NVDA", "NVIDIA", "Stock"],
      ["AMZN", "Amazon", "Stock"],
      ["META", "Meta Platforms", "Stock"],
      ["GOOGL", "Alphabet", "Stock"],
      ["BRK-B", "Berkshire Hathaway", "Stock"],
      ["JPM", "JPMorgan Chase", "Stock"],
    ].map(([symbol, name, type]) => ({ symbol, name, type, country: "United States", region: "North America", currency: "USD" })),
  },
  india: {
    title: "India Stock Market",
    description: "NSE/BSE index view with large Indian market leaders.",
    items: [
      ["^NSEI", "NIFTY 50", "Index"],
      ["^BSESN", "SENSEX", "Index"],
      ["^NSEBANK", "NIFTY Bank", "Index"],
      ["RELIANCE.NS", "Reliance Industries", "Stock"],
      ["HDFCBANK.NS", "HDFC Bank", "Stock"],
      ["ICICIBANK.NS", "ICICI Bank", "Stock"],
      ["INFY.NS", "Infosys", "Stock"],
      ["TCS.NS", "Tata Consultancy Services", "Stock"],
      ["BHARTIARTL.NS", "Bharti Airtel", "Stock"],
      ["SBIN.NS", "State Bank of India", "Stock"],
      ["ITC.NS", "ITC", "Stock"],
      ["LT.NS", "Larsen & Toubro", "Stock"],
      ["AXISBANK.NS", "Axis Bank", "Stock"],
    ].map(([symbol, name, type]) => ({ symbol, name, type, country: "India", region: "Asia", currency: "INR" })),
  },
  world: {
    title: "World View",
    description: "Major country indices mapped by one-day performance.",
    items: [
      { symbol: "^GSPC", name: "S&P 500", type: "Index", country: "United States", region: "North America", currency: "USD", x: 22, y: 39 },
      { symbol: "^GSPTSE", name: "S&P/TSX Composite", type: "Index", country: "Canada", region: "North America", currency: "CAD", x: 21, y: 31 },
      { symbol: "^MXX", name: "IPC Mexico", type: "Index", country: "Mexico", region: "North America", currency: "MXN", x: 20, y: 51 },
      { symbol: "^BVSP", name: "Bovespa", type: "Index", country: "Brazil", region: "South America", currency: "BRL", x: 34, y: 69 },
      { symbol: "^FTSE", name: "FTSE 100", type: "Index", country: "United Kingdom", region: "Europe", currency: "GBP", x: 47, y: 32 },
      { symbol: "^GDAXI", name: "DAX", type: "Index", country: "Germany", region: "Europe", currency: "EUR", x: 51, y: 35 },
      { symbol: "^FCHI", name: "CAC 40", type: "Index", country: "France", region: "Europe", currency: "EUR", x: 49, y: 37 },
      { symbol: "FTSEMIB.MI", name: "FTSE MIB", type: "Index", country: "Italy", region: "Europe", currency: "EUR", x: 51, y: 42 },
      { symbol: "^NSEI", name: "NIFTY 50", type: "Index", country: "India", region: "Asia", currency: "INR", x: 68, y: 51 },
      { symbol: "^HSI", name: "Hang Seng", type: "Index", country: "Hong Kong", region: "Asia", currency: "HKD", x: 76, y: 48 },
      { symbol: "000001.SS", name: "Shanghai Composite", type: "Index", country: "China", region: "Asia", currency: "CNY", x: 75, y: 43 },
      { symbol: "^N225", name: "Nikkei 225", type: "Index", country: "Japan", region: "Asia", currency: "JPY", x: 84, y: 41 },
      { symbol: "^KS11", name: "KOSPI", type: "Index", country: "South Korea", region: "Asia", currency: "KRW", x: 81, y: 42 },
      { symbol: "^AXJO", name: "S&P/ASX 200", type: "Index", country: "Australia", region: "Oceania", currency: "AUD", x: 83, y: 73 },
      { symbol: "^TA125.TA", name: "TA-125", type: "Index", country: "Israel", region: "Middle East", currency: "ILS", x: 57, y: 47 },
      { symbol: "^CASE30", name: "EGX 30", type: "Index", country: "Egypt", region: "Africa", currency: "EGP", x: 55, y: 51 },
      { symbol: "^JN0U.JO", name: "Johannesburg Top 40", type: "Index", country: "South Africa", region: "Africa", currency: "ZAR", x: 55, y: 76 },
    ],
  },
  commodities: {
    title: "Commodities",
    description: "Metals, grains and soft commodities from futures markets.",
    items: [
      ["GC=F", "Gold", "Metal"],
      ["SI=F", "Silver", "Metal"],
      ["HG=F", "Copper", "Metal"],
      ["PL=F", "Platinum", "Metal"],
      ["PA=F", "Palladium", "Metal"],
      ["ZC=F", "Corn", "Agriculture"],
      ["ZW=F", "Wheat", "Agriculture"],
      ["ZS=F", "Soybeans", "Agriculture"],
      ["KC=F", "Coffee", "Soft"],
      ["CT=F", "Cotton", "Soft"],
      ["SB=F", "Sugar", "Soft"],
    ].map(([symbol, name, type]) => ({ symbol, name, type, currency: "USD" })),
  },
  oil: {
    title: "Oil Market",
    description: "Energy futures including crude, natural gas and refined products.",
    items: [
      ["CL=F", "WTI Crude Oil", "Crude"],
      ["BZ=F", "Brent Crude Oil", "Crude"],
      ["NG=F", "Natural Gas", "Gas"],
      ["RB=F", "RBOB Gasoline", "Refined"],
      ["HO=F", "Heating Oil", "Refined"],
    ].map(([symbol, name, type]) => ({ symbol, name, type, currency: "USD" })),
  },
};

export function getGlobalMarketMeta(universe: MarketUniverse) {
  if (universe === "crypto") {
    return {
      title: "Crypto Market",
      description: "Top cryptocurrency markets by market cap with trending coins and 24-hour performance.",
    };
  }

  const meta = UNIVERSES[universe];
  return { title: meta.title, description: meta.description };
}

export async function getGlobalMarketData(universe: MarketUniverse): Promise<GlobalMarketData> {
  const cached = await getStaleCached({
    key: `global-market:${universe}`,
    ttlSeconds: GLOBAL_MARKET_TTL_SECONDS,
    staleSeconds: GLOBAL_MARKET_STALE_SECONDS,
    load: () => loadGlobalMarketData(universe),
  });
  return cached.value;
}

async function loadGlobalMarketData(universe: MarketUniverse): Promise<GlobalMarketData> {
  if (universe === "crypto") return getCryptoMarketData();

  const meta = UNIVERSES[universe];
  const quotes = await Promise.all(meta.items.map(fetchYahooQuote));
  return buildMarketData({
    universe,
    title: meta.title,
    description: meta.description,
    sourceLabel: "Yahoo Finance delayed chart data",
    sourceUrl: "https://finance.yahoo.com/markets/",
    quotes,
  });
}

async function getCryptoMarketData(): Promise<GlobalMarketData> {
  const meta = getGlobalMarketMeta("crypto");

  try {
    const [topRows, trending] = await Promise.all([
      fetchCoinGeckoMarketRows(COINGECKO_MARKETS),
      fetchCoinGeckoTrending(),
    ]);
    const topIds = new Set(topRows.map((row) => row.id));
    const missingTrendingIds = trending
      .map((item) => item.id)
      .filter((id) => id && !topIds.has(id))
      .slice(0, 10);
    const extraTrendingRows = missingTrendingIds.length
      ? await fetchCoinGeckoMarketRows(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
            missingTrendingIds.join(",")
          )}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`
        )
      : [];
    const trendRankById = new Map(trending.map((item) => [item.id, item.rank]));
    const rows = dedupeCoinRows([...topRows, ...extraTrendingRows]);

    const quotes: GlobalMarketQuote[] = rows.map((row) => ({
      symbol: row.symbol.toUpperCase(),
      name: row.name,
      type: trendRankById.has(row.id) ? "Trending Crypto" : "Crypto",
      currency: "USD",
      price: row.current_price,
      previousClose: row.current_price - row.price_change_24h,
      change: row.price_change_24h,
      changePct: row.price_change_percentage_24h,
      dayHigh: row.high_24h,
      dayLow: row.low_24h,
      volume: row.total_volume,
      source: "CoinGecko",
      updatedAt: row.last_updated,
      trendRank: trendRankById.get(row.id) ?? null,
    }));
    return buildMarketData({
      universe: "crypto",
      title: meta.title,
      description: meta.description,
      sourceLabel: "CoinGecko top market-cap and trending data",
      sourceUrl: "https://www.coingecko.com/",
      quotes,
    });
  } catch {
    return buildMarketData({
      universe: "crypto",
      title: meta.title,
      description: meta.description,
      sourceLabel: "CoinGecko top market-cap and trending data",
      sourceUrl: "https://www.coingecko.com/",
      quotes: [],
    });
  }
}

async function fetchCoinGeckoMarketRows(url: string) {
  const res = await fetch(url, {
    headers: coinGeckoHeaders(),
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`CoinGecko request failed: ${res.status}`);
  return (await res.json()) as CoinGeckoMarketRow[];
}

async function fetchCoinGeckoTrending() {
  const res = await fetch(COINGECKO_TRENDING, {
    headers: coinGeckoHeaders(),
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    coins?: Array<{ item?: { id?: string; score?: number } }>;
  };
  return (json.coins ?? [])
    .map((coin, index) => ({
      id: coin.item?.id ?? "",
      rank: typeof coin.item?.score === "number" ? coin.item.score + 1 : index + 1,
    }))
    .filter((item) => item.id);
}

function coinGeckoHeaders() {
  return {
    accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (compatible; Stockli/1.0; +https://stock-portfolio-khaki.vercel.app)",
  };
}

function dedupeCoinRows(rows: CoinGeckoMarketRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function fetchYahooQuote(item: MarketInstrument): Promise<GlobalMarketQuote> {
  try {
    const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(item.symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; Stockli/1.0; +https://stock-portfolio-khaki.vercel.app)",
      },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Yahoo request failed: ${res.status}`);
    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    const price = finite(meta?.regularMarketPrice);
    const previousClose = finite(meta?.chartPreviousClose ?? meta?.previousClose);
    const change = price != null && previousClose != null ? price - previousClose : null;
    const changePct =
      change != null && previousClose ? (change / previousClose) * 100 : null;

    return {
      ...item,
      currency: item.currency ?? meta?.currency,
      price,
      previousClose,
      change,
      changePct,
      dayHigh: finite(meta?.regularMarketDayHigh),
      dayLow: finite(meta?.regularMarketDayLow),
      volume: finite(meta?.regularMarketVolume),
      source: "Yahoo Finance",
      updatedAt: meta?.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : null,
    };
  } catch {
    return {
      ...item,
      price: null,
      previousClose: null,
      change: null,
      changePct: null,
      dayHigh: null,
      dayLow: null,
      volume: null,
      source: "Yahoo Finance",
      updatedAt: null,
    };
  }
}

function buildMarketData({
  universe,
  title,
  description,
  sourceLabel,
  sourceUrl,
  quotes,
}: {
  universe: MarketUniverse;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  quotes: GlobalMarketQuote[];
}): GlobalMarketData {
  const priced = quotes.filter((quote) => quote.changePct != null);
  const advancers = priced.filter((quote) => (quote.changePct ?? 0) > 0).length;
  const decliners = priced.filter((quote) => (quote.changePct ?? 0) < 0).length;
  const flat = priced.length - advancers - decliners;
  const avgChangePct = priced.length
    ? priced.reduce((sum, quote) => sum + (quote.changePct ?? 0), 0) / priced.length
    : 0;
  const ranked = [...priced].sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));

  return {
    universe,
    title,
    description,
    sourceLabel,
    sourceUrl,
    quotes,
    summary: {
      advancers,
      decliners,
      flat,
      avgChangePct,
      best: ranked[0] ?? null,
      worst: ranked[ranked.length - 1] ?? null,
    },
  };
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        regularMarketTime?: number;
      };
    }>;
  };
}

interface CoinGeckoMarketRow {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  total_volume: number;
  market_cap: number;
  last_updated: string;
}
