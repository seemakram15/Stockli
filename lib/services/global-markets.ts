import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import { getIndexDetail } from "@/lib/services/market";

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
  provider?: "yahoo" | "psx";
  displaySymbol?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  currency?: string;
  lat?: number;
  lon?: number;
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
  source: "Yahoo Finance" | "CoinGecko" | "PSX";
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
      ["TSLA", "Tesla", "Stock"],
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
    description: "Country exchange heat map by one-day performance.",
    items: [
      { symbol: "^GSPC", name: "S&P 500", type: "Index", country: "United States", countryCode: "USA", region: "Americas", currency: "USD", lat: 40.7128, lon: -74.006, x: 22, y: 39 },
      { symbol: "^GSPTSE", name: "S&P/TSX Composite", type: "Index", country: "Canada", countryCode: "CAN", region: "Americas", currency: "CAD", lat: 43.6532, lon: -79.3832, x: 21, y: 31 },
      { symbol: "^MXX", name: "IPC Mexico", type: "Index", country: "Mexico", countryCode: "MEX", region: "Americas", currency: "MXN", lat: 19.4326, lon: -99.1332, x: 20, y: 51 },
      { symbol: "^BVSP", name: "Bovespa", type: "Index", country: "Brazil", countryCode: "BRA", region: "Americas", currency: "BRL", lat: -23.5558, lon: -46.6396, x: 34, y: 69 },
      { symbol: "^MERV", name: "MERVAL", type: "Index", country: "Argentina", countryCode: "ARG", region: "Americas", currency: "ARS", lat: -34.6037, lon: -58.3816 },
      { symbol: "^IPSA", name: "S&P IPSA", type: "Index", country: "Chile", countryCode: "CHL", region: "Americas", currency: "CLP", lat: -33.4489, lon: -70.6693 },
      { symbol: "^SPBLPGPT", name: "S&P/BVL Peru General", type: "Index", country: "Peru", countryCode: "PER", region: "Americas", currency: "PEN", lat: -12.0464, lon: -77.0428 },
      { symbol: "WICOL.FGI", name: "FTSE Colombia Index", type: "Index", country: "Colombia", countryCode: "COL", region: "Americas", currency: "COP", lat: 4.711, lon: -74.0721 },
      { symbol: "^FTSE", name: "FTSE 100", type: "Index", country: "United Kingdom", countryCode: "GBR", region: "Europe", currency: "GBP", lat: 51.5072, lon: -0.1276, x: 47, y: 32 },
      { symbol: "^GDAXI", name: "DAX", type: "Index", country: "Germany", countryCode: "DEU", region: "Europe", currency: "EUR", lat: 50.1109, lon: 8.6821, x: 51, y: 35 },
      { symbol: "^FCHI", name: "CAC 40", type: "Index", country: "France", countryCode: "FRA", region: "Europe", currency: "EUR", lat: 48.8566, lon: 2.3522, x: 49, y: 37 },
      { symbol: "FTSEMIB.MI", name: "FTSE MIB", type: "Index", country: "Italy", countryCode: "ITA", region: "Europe", currency: "EUR", lat: 45.4642, lon: 9.19, x: 51, y: 42 },
      { symbol: "WIPTL.FGI", name: "FTSE Portugal Index", type: "Index", country: "Portugal", countryCode: "PRT", region: "Europe", currency: "EUR", lat: 38.7223, lon: -9.1393 },
      { symbol: "WIPOL.FGI", name: "FTSE Poland Index", type: "Index", country: "Poland", countryCode: "POL", region: "Europe", currency: "PLN", lat: 52.2297, lon: 21.0122 },
      { symbol: "WIHUN.FGI", name: "FTSE Hungary Index", type: "Index", country: "Hungary", countryCode: "HUN", region: "Europe", currency: "HUF", lat: 47.4979, lon: 19.0402 },
      { symbol: "WIGRC.FGI", name: "FTSE Greece Index", type: "Index", country: "Greece", countryCode: "GRC", region: "Europe", currency: "EUR", lat: 37.9838, lon: 23.7275 },
      { symbol: "WIROU.FGI", name: "FTSE Romania Index", type: "Index", country: "Romania", countryCode: "ROU", region: "Europe", currency: "RON", lat: 44.4268, lon: 26.1025 },
      { symbol: "WIIRL.FGI", name: "FTSE Ireland Index", type: "Index", country: "Ireland", countryCode: "IRL", region: "Europe", currency: "EUR", lat: 53.3498, lon: -6.2603 },
      { symbol: "^AEX", name: "AEX", type: "Index", country: "Netherlands", countryCode: "NLD", region: "Europe", currency: "EUR", lat: 52.3676, lon: 4.9041 },
      { symbol: "^BFX", name: "BEL 20", type: "Index", country: "Belgium", countryCode: "BEL", region: "Europe", currency: "EUR", lat: 50.8503, lon: 4.3517 },
      { symbol: "^SSMI", name: "SMI", type: "Index", country: "Switzerland", countryCode: "CHE", region: "Europe", currency: "CHF", lat: 47.3769, lon: 8.5417 },
      { symbol: "^IBEX", name: "IBEX 35", type: "Index", country: "Spain", countryCode: "ESP", region: "Europe", currency: "EUR", lat: 40.4168, lon: -3.7038 },
      { symbol: "^OMX", name: "OMX Stockholm 30", type: "Index", country: "Sweden", countryCode: "SWE", region: "Europe", currency: "SEK", lat: 59.3293, lon: 18.0686 },
      { symbol: "^OMXC20", name: "OMX Copenhagen 20", type: "Index", country: "Denmark", countryCode: "DNK", region: "Europe", currency: "DKK", lat: 55.6761, lon: 12.5683 },
      { symbol: "^OMXH25", name: "OMX Helsinki 25", type: "Index", country: "Finland", countryCode: "FIN", region: "Europe", currency: "EUR", lat: 60.1699, lon: 24.9384 },
      { symbol: "^OSEAX", name: "OSE All-Share", type: "Index", country: "Norway", countryCode: "NOR", region: "Europe", currency: "NOK", lat: 59.9139, lon: 10.7522 },
      { symbol: "^ATX", name: "ATX", type: "Index", country: "Austria", countryCode: "AUT", region: "Europe", currency: "EUR", lat: 48.2082, lon: 16.3738 },
      { symbol: "^NSEI", name: "NIFTY 50", type: "Index", country: "India", countryCode: "IND", region: "Asia Pacific", currency: "INR", lat: 19.076, lon: 72.8777, x: 68, y: 51 },
      { symbol: "KSE100", name: "KSE-100 Index", type: "Index", provider: "psx", displaySymbol: "KSE100", country: "Pakistan", countryCode: "PAK", region: "Asia Pacific", currency: "PKR", lat: 24.8607, lon: 67.0011, x: 66, y: 49 },
      { symbol: "000001.SS", name: "Shanghai Composite", type: "Index", country: "China", countryCode: "CHN", region: "Asia Pacific", currency: "CNY", lat: 31.2304, lon: 121.4737, x: 75, y: 43 },
      { symbol: "^HSI", name: "Hang Seng", type: "Index", country: "Hong Kong", countryCode: "HKG", region: "Asia Pacific", currency: "HKD", lat: 22.3193, lon: 114.1694, x: 76, y: 48 },
      { symbol: "^N225", name: "Nikkei 225", type: "Index", country: "Japan", countryCode: "JPN", region: "Asia Pacific", currency: "JPY", lat: 35.6762, lon: 139.6503, x: 84, y: 41 },
      { symbol: "^KS11", name: "KOSPI", type: "Index", country: "South Korea", countryCode: "KOR", region: "Asia Pacific", currency: "KRW", lat: 37.5665, lon: 126.978, x: 81, y: 42 },
      { symbol: "^TWII", name: "Taiwan Weighted", type: "Index", country: "Taiwan", countryCode: "TWN", region: "Asia Pacific", currency: "TWD", lat: 25.033, lon: 121.5654 },
      { symbol: "^STI", name: "Straits Times Index", type: "Index", country: "Singapore", countryCode: "SGP", region: "Asia Pacific", currency: "SGD", lat: 1.3521, lon: 103.8198 },
      { symbol: "^KLSE", name: "FTSE Bursa Malaysia KLCI", type: "Index", country: "Malaysia", countryCode: "MYS", region: "Asia Pacific", currency: "MYR", lat: 3.139, lon: 101.6869 },
      { symbol: "^JKSE", name: "Jakarta Composite", type: "Index", country: "Indonesia", countryCode: "IDN", region: "Asia Pacific", currency: "IDR", lat: -6.2088, lon: 106.8456 },
      { symbol: "PSEI.PS", name: "PSEi", type: "Index", country: "Philippines", countryCode: "PHL", region: "Asia Pacific", currency: "PHP", lat: 14.5995, lon: 120.9842 },
      { symbol: "SET.BK", name: "SET Index", type: "Index", country: "Thailand", countryCode: "THA", region: "Asia Pacific", currency: "THB", lat: 13.7563, lon: 100.5018 },
      { symbol: "FVTT.FGI", name: "FTSE Vietnam Index", type: "Index", country: "Vietnam", countryCode: "VNM", region: "Asia Pacific", currency: "VND", lat: 10.8231, lon: 106.6297 },
      { symbol: "^AXJO", name: "S&P/ASX 200", type: "Index", country: "Australia", countryCode: "AUS", region: "Asia Pacific", currency: "AUD", lat: -33.8688, lon: 151.2093, x: 83, y: 73 },
      { symbol: "^NZ50", name: "S&P/NZX 50", type: "Index", country: "New Zealand", countryCode: "NZL", region: "Asia Pacific", currency: "NZD", lat: -36.8485, lon: 174.7633 },
      { symbol: "TEPIX", name: "TEDPIX", type: "Index", country: "Iran", countryCode: "IRN", region: "MENA", currency: "IRR", lat: 35.6892, lon: 51.389, x: 60, y: 44 },
      { symbol: "XU100.IS", name: "BIST 100", type: "Index", country: "Turkey", countryCode: "TUR", region: "MENA", currency: "TRY", lat: 41.0082, lon: 28.9784 },
      { symbol: "TA35.TA", name: "TA-35", type: "Index", country: "Israel", countryCode: "ISR", region: "MENA", currency: "ILS", lat: 32.0853, lon: 34.7818, x: 57, y: 47 },
      { symbol: "^CASE30", name: "EGX 30", type: "Index", country: "Egypt", countryCode: "EGY", region: "MENA", currency: "EGP", lat: 30.0444, lon: 31.2357, x: 55, y: 51 },
      { symbol: "^TASI.SR", name: "Tadawul All Shares Index", type: "Index", country: "Saudi Arabia", countryCode: "SAU", region: "MENA", currency: "SAR", lat: 24.7136, lon: 46.6753, x: 59, y: 49 },
      { symbol: "WIQAT.FGI", name: "FTSE Qatar Index", type: "Index", country: "Qatar", countryCode: "QAT", region: "MENA", currency: "QAR", lat: 25.2854, lon: 51.531, x: 60, y: 49 },
      { symbol: "WIKWT.FGI", name: "FTSE Kuwait Index", type: "Index", country: "Kuwait", countryCode: "KWT", region: "MENA", currency: "KWD", lat: 29.3759, lon: 47.9774, x: 60, y: 48 },
      { symbol: "DFMGI.AE", name: "Dubai Financial Market", type: "Index", country: "United Arab Emirates", countryCode: "ARE", region: "MENA", currency: "AED", lat: 25.2048, lon: 55.2708 },
      { symbol: "^JN0U.JO", name: "Johannesburg Top 40", type: "Index", country: "South Africa", countryCode: "ZAF", region: "MENA", currency: "ZAR", lat: -26.2041, lon: 28.0473, x: 55, y: 76 },
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

export function getGlobalMarketInstruments(universe: Exclude<MarketUniverse, "crypto">) {
  return UNIVERSES[universe].items.map((item) => ({
    ...item,
    displaySymbol: getMarketDisplaySymbol(item.symbol, item.displaySymbol),
  }));
}

export async function getGlobalMarketData(universe: MarketUniverse): Promise<GlobalMarketData> {
  const cached = await getStaleCached({
    key: `global-market:v6:${universe}`,
    ttlSeconds: GLOBAL_MARKET_TTL_SECONDS,
    staleSeconds: GLOBAL_MARKET_STALE_SECONDS,
    load: () => loadGlobalMarketData(universe),
  });
  return cached.value;
}

async function loadGlobalMarketData(universe: MarketUniverse): Promise<GlobalMarketData> {
  if (universe === "crypto") return getCryptoMarketData();

  const meta = UNIVERSES[universe];
  const quotes = await fetchYahooQuotes(meta.items, universe === "world" ? 6 : 10);
  return buildMarketData({
    universe,
    title: meta.title,
    description: meta.description,
    sourceLabel:
      universe === "world"
        ? "Yahoo Finance delayed chart data with Stockli PSX index feed"
        : "Yahoo Finance delayed chart data",
    sourceUrl: "https://finance.yahoo.com/markets/",
    quotes,
  });
}

async function fetchYahooQuotes(items: MarketInstrument[], concurrency: number) {
  const width = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<GlobalMarketQuote>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: width }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await fetchMarketQuote(items[index]);
      }
    })
  );

  return results;
}

async function fetchMarketQuote(item: MarketInstrument): Promise<GlobalMarketQuote> {
  if (item.provider === "psx") {
    return fetchPsxQuote(item);
  }
  return fetchYahooQuote(item);
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
      displaySymbol: getMarketDisplaySymbol(item.symbol, item.displaySymbol),
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
      displaySymbol: getMarketDisplaySymbol(item.symbol, item.displaySymbol),
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

async function fetchPsxQuote(item: MarketInstrument): Promise<GlobalMarketQuote> {
  try {
    const detail = await getIndexDetail(item.symbol);
    if (!detail) throw new Error(`PSX index not found: ${item.symbol}`);

    const updatedAt =
      detail.intraday[detail.intraday.length - 1]?.time != null
        ? new Date(detail.intraday[detail.intraday.length - 1].time * 1000).toISOString()
        : detail.candles[detail.candles.length - 1]?.time != null
          ? new Date(detail.candles[detail.candles.length - 1].time * 1000).toISOString()
          : new Date().toISOString();

    return {
      ...item,
      name: detail.name,
      displaySymbol: getMarketDisplaySymbol(detail.symbol, item.displaySymbol ?? detail.symbol),
      currency: item.currency ?? "PKR",
      price: detail.current,
      previousClose: detail.prevClose,
      change: detail.change,
      changePct: detail.changePct,
      dayHigh: detail.high,
      dayLow: detail.low,
      volume: detail.volume,
      source: "PSX",
      updatedAt,
    };
  } catch {
    return {
      ...item,
      displaySymbol: getMarketDisplaySymbol(item.symbol, item.displaySymbol),
      price: null,
      previousClose: null,
      change: null,
      changePct: null,
      dayHigh: null,
      dayLow: null,
      volume: null,
      source: "PSX",
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
