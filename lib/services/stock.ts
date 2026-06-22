import "server-only";
import { psx } from "@/lib/psx/adapter";
import { getQuote } from "@/lib/services/prices";
import { getTickerMap, getAllHoldings } from "@/lib/services/portfolio";
import type { Candle, Holding, Quote, SeriesPoint, Ticker } from "@/lib/types";

export interface StockDetail {
  symbol: string;
  ticker: Ticker | null;
  quote: Quote | null;
  candles: Candle[];
  intraday: SeriesPoint[];
  /** The user's holdings of this symbol across portfolios (if any). */
  holdings: Holding[];
}

export async function getStockDetail(symbolRaw: string): Promise<StockDetail> {
  const symbol = symbolRaw.toUpperCase();
  const [tickerMap, quote, candles, intraday, allHoldings] = await Promise.all([
    getTickerMap([symbol]),
    getQuote(symbol),
    psx.getEodCandles(symbol),
    psx.getIntraday(symbol),
    getAllHoldings(),
  ]);

  return {
    symbol,
    ticker: tickerMap.get(symbol) ?? null,
    quote,
    candles,
    intraday,
    holdings: allHoldings.filter((h) => h.symbol.toUpperCase() === symbol),
  };
}
