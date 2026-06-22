import "server-only";
import {
  getEodCandlesCached,
  getIntradayCached,
  getIndexSummariesCached,
  getIndexConstituentsCached,
} from "@/lib/services/history";
import { PSX_INDICES } from "@/lib/psx/symbols";
import type { Candle, IndexConstituent, SeriesPoint } from "@/lib/types";

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
