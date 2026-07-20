import "server-only";
import {
  getEodCandlesCached,
  getIntradayCached,
  getIndexSummariesCached,
  getIndexConstituentsCached,
} from "@/lib/services/history";
import { getMarketRows } from "@/lib/services/prices";
import {
  normalizeMarketSectorIndex,
} from "@/lib/psx/market-indexes";
import { PSX_INDICES } from "@/lib/psx/symbols";
import type { Candle, IndexConstituent, MarketWatchRow, SeriesPoint } from "@/lib/types";

export interface IndexCard {
  symbol: string;
  name: string;
  current: number;
  change: number;
  changePct: number;
  spark: number[];
}

export interface IndexReturns {
  d1: number;
  w1: number;
  m1: number;
  m3: number;
  y1: number;
  ytd: number;
}

export interface IndexDetail {
  symbol: string;
  name: string;
  current: number;
  change: number;
  changePct: number;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  returns: IndexReturns;
  week52High: number;
  week52Low: number;
  volume: number | null;
  candles: Candle[];
  intraday: SeriesPoint[];
  constituents: IndexConstituent[];
}

export interface MarketPerformer {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number | null;
}

export interface MarketPerformers {
  active: MarketPerformer[];
  advancers: MarketPerformer[];
  decliners: MarketPerformer[];
}

export interface SectorPerformance {
  sector: string;
  count: number;
  avgChangePct: number;
  advancers: number;
  decliners: number;
  volume: number;
  stocks: SectorStockPerformance[];
}

export interface SectorStockPerformance {
  symbol: string;
  name: string | null;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  ldcp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  listedIn: string | null;
}

export interface MarketAnalytics {
  performers: MarketPerformers;
  sectors: SectorPerformance[];
}

/** Index cards for the overview row — live value/change + EOD sparkline. */
export async function getIndexCards(): Promise<IndexCard[]> {
  const summaries = await getIndexSummariesCached();
  const byCode = new Map(summaries.map((s) => [s.symbol, s]));
  return Promise.all(
    PSX_INDICES.map(async (idx) => {
      const s = byCode.get(idx.symbol);
      const candles = await getEodCandlesCached(idx.symbol);
      const lastClose = candles[candles.length - 1]?.close ?? idx.ref;
      return {
        symbol: idx.symbol,
        name: idx.name,
        current: s?.current ?? lastClose,
        change: s?.change ?? 0,
        changePct: s?.changePct ?? 0,
        spark: candles.slice(-32).map((c) => c.close),
      };
    })
  );
}

/** Full detail for one index — live header, returns, 52w, chart series + constituents. */
export async function getIndexDetail(symbol: string): Promise<IndexDetail | null> {
  const meta = PSX_INDICES.find((i) => i.symbol === symbol.toUpperCase());
  if (!meta) return null;

  const [summaries, candles, intraday, constituents] = await Promise.all([
    getIndexSummariesCached(),
    getEodCandlesCached(meta.symbol),
    getIntradayCached(meta.symbol),
    getIndexConstituentsCached(meta.symbol),
  ]);

  const s = summaries.find((x) => x.symbol === meta.symbol);
  const lastEod = candles[candles.length - 1]?.close ?? null;
  const intradayLast = intraday[intraday.length - 1]?.value ?? null;
  const current = s?.current ?? intradayLast ?? lastEod ?? meta.ref;
  const prevClose = lastEod;
  const change = s?.change ?? (prevClose != null ? current - prevClose : 0);
  const changePct = s?.changePct ?? (prevClose ? (change / prevClose) * 100 : 0);

  // Returns: `current` (live) vs an EOD close N trading days back.
  const back = (n: number) => {
    const base = candles[candles.length - 1 - n]?.close;
    return base ? ((current - base) / base) * 100 : 0;
  };
  const lastYear = candles.length
    ? new Date(candles[candles.length - 1].time * 1000).getUTCFullYear()
    : new Date().getUTCFullYear();
  const firstOfYear = candles.find(
    (c) => new Date(c.time * 1000).getUTCFullYear() === lastYear
  );
  const ytd = firstOfYear?.close ? ((current - firstOfYear.close) / firstOfYear.close) * 100 : 0;

  const year = candles.slice(-252);
  const week52High = Math.max(current, ...(year.length ? year.map((c) => c.high) : [current]));
  const week52Low = Math.min(current, ...(year.length ? year.map((c) => c.low) : [current]));

  return {
    symbol: meta.symbol,
    name: meta.name,
    current,
    change,
    changePct,
    high: s?.high ?? null,
    low: s?.low ?? null,
    prevClose,
    returns: { d1: changePct, w1: back(5), m1: back(22), m3: back(66), y1: back(252), ytd },
    week52High,
    week52Low,
    volume: constituents.reduce((a, c) => a + (c.volume ?? 0), 0) || null,
    candles: candles.slice(-260),
    intraday,
    constituents: [...constituents].sort((a, b) => b.weight - a.weight),
  };
}

/** Top active, advancing and declining stocks from the latest market-watch snapshot. */
export async function getMarketPerformers(limit = 10): Promise<MarketPerformers> {
  const rows = await getMarketRows();
  return buildMarketPerformers(rows, limit);
}

export async function getSectorPerformance(
  indexSymbol?: string | null
): Promise<SectorPerformance[]> {
  const rows = await getMarketRows();
  const symbol = normalizeMarketSectorIndex(indexSymbol);
  const constituents = symbol ? await getIndexConstituentsCached(symbol) : [];
  const nameMap = Object.fromEntries(
    constituents.map((c) => [c.symbol.toUpperCase(), c.name ?? null])
  );
  const filtered = symbol
    ? rows.filter((r) => r.symbol.toUpperCase() in nameMap)
    : rows;
  return buildSectorPerformance(filtered, nameMap);
}

/** Market performer + sector analytics from a single market-watch read. */
export async function getMarketAnalytics(limit = 10): Promise<MarketAnalytics> {
  const rows = await getMarketRows();
  return {
    performers: buildMarketPerformers(rows, limit),
    sectors: buildSectorPerformance(rows),
  };
}

function buildMarketPerformers(rows: MarketWatchRow[], limit: number): MarketPerformers {
  const toPerformer = (r: MarketWatchRow): MarketPerformer => ({
    symbol: r.symbol,
    price: r.current,
    change: r.change,
    changePct: r.changePct,
    volume: r.volume,
  });

  return {
    active: [...rows]
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, limit)
      .map(toPerformer),
    advancers: rows
      .filter((r) => r.changePct > 0)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, limit)
      .map(toPerformer),
    decliners: rows
      .filter((r) => r.changePct < 0)
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, limit)
      .map(toPerformer),
  };
}

async function filterRowsForIndex(rows: MarketWatchRow[], indexSymbol?: string | null) {
  const symbol = normalizeMarketSectorIndex(indexSymbol);
  if (!symbol) return rows;

  const constituents = await getIndexConstituentsCached(symbol);
  const allowed = new Set(constituents.map((constituent) => constituent.symbol.toUpperCase()));
  if (allowed.size === 0) return [];

  return rows.filter((row) => allowed.has(row.symbol.toUpperCase()));
}

function buildSectorPerformance(rows: MarketWatchRow[], nameMap: Record<string, string | null> = {}): SectorPerformance[] {
  const map = new Map<
    string,
    {
      count: number;
      changeSum: number;
      advancers: number;
      decliners: number;
      volume: number;
      stocks: SectorStockPerformance[];
    }
  >();

  for (const row of rows) {
    const sector = row.sector ?? "Other";
    const cur =
      map.get(sector) ??
      { count: 0, changeSum: 0, advancers: 0, decliners: 0, volume: 0, stocks: [] };
    cur.count += 1;
    cur.changeSum += row.changePct;
    cur.advancers += row.changePct > 0 ? 1 : 0;
    cur.decliners += row.changePct < 0 ? 1 : 0;
    cur.volume += row.volume ?? 0;
    cur.stocks.push({
      symbol: row.symbol,
      name: nameMap[row.symbol.toUpperCase()] ?? null,
      price: row.current,
      change: row.change,
      changePct: row.changePct,
      volume: row.volume ?? 0,
      ldcp: row.ldcp,
      open: row.open,
      high: row.high,
      low: row.low,
      listedIn: row.listedIn,
    });
    map.set(sector, cur);
  }

  return Array.from(map.entries())
    .map(([sector, v]) => ({
      sector,
      count: v.count,
      avgChangePct: v.count ? v.changeSum / v.count : 0,
      advancers: v.advancers,
      decliners: v.decliners,
      volume: v.volume,
      stocks: v.stocks.sort((a, b) => b.changePct - a.changePct),
    }))
    .sort((a, b) => Math.abs(b.avgChangePct) - Math.abs(a.avgChangePct));
}
