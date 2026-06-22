import { parse } from "node-html-parser";
import type { Candle, MarketWatchRow, SeriesPoint } from "@/lib/types";
import { config } from "@/lib/config";
import { genEodCandles, genIntraday, genMarketWatch } from "./mock";

/**
 * PSX data source — a thin adapter so the underlying provider can be swapped
 * (live scrape → licensed feed → authorised redistributor) WITHOUT touching
 * app code. The live implementation scrapes the public, no-auth endpoints used
 * across the open-source PSX ecosystem (psx-data-reader, psxdata, PSX-MCP).
 *
 *   /market-watch            → HTML table of ~460+ symbols (parsed dynamically)
 *   /timeseries/eod/{SYM}    → JSON [[ts, close, volume], ...] (~5yr)
 *   /timeseries/int/{SYM}    → JSON [[ts, price, volume], ...] (current session)
 *
 * Data is delayed (~15 min), undocumented and HTML-fragile, so every call
 * retries with backoff and falls back to deterministic mock data on failure.
 */
export interface PsxDataSource {
  getMarketWatch(): Promise<MarketWatchRow[]>;
  getEodCandles(symbol: string): Promise<Candle[]>;
  getIntraday(symbol: string): Promise<SeriesPoint[]>;
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "text/html,application/json,*/*",
};

/** Fetch with up to `attempts` exponential-backoff retries. */
async function fetchWithRetry(
  url: string,
  attempts = 3,
  timeoutMs = 12_000
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        // 400ms, 800ms, 1600ms ...
        await delay(400 * 2 ** i);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Failed to fetch ${url}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toNum(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[, ]/g, "").replace(/[()]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map a PSX column header to a normalised field. We read the <th> labels
 * dynamically (PSX reorders columns and breaks fixed-index scrapers).
 */
function classifyHeader(label: string): keyof MarketWatchRow | null {
  const l = label.toLowerCase().replace(/[^a-z%]/g, "");
  if (l.includes("symbol")) return "symbol";
  if (l.includes("sector")) return "sector";
  if (l.includes("listed")) return "listedIn";
  if (l === "ldcp" || l.includes("ldcp")) return "ldcp";
  if (l.startsWith("open")) return "open";
  if (l.startsWith("high")) return "high";
  if (l.startsWith("low")) return "low";
  if (l.includes("current") || l === "price" || l.includes("last")) return "current";
  if (l.includes("change%") || l.includes("chg%") || l === "pct") return "changePct";
  if (l.includes("change") || l.includes("chg")) return "change";
  if (l.includes("volume") || l === "vol") return "volume";
  return null;
}

// ── Live scraper ──────────────────────────────────────────────

export const dpsSource: PsxDataSource = {
  async getMarketWatch(): Promise<MarketWatchRow[]> {
    const res = await fetchWithRetry(`${config.psx.baseUrl}/market-watch`);
    const html = await res.text();
    const root = parse(html);
    const table = root.querySelector("table");
    if (!table) throw new Error("market-watch: no <table> found");

    // Build a column-index → field map from the header row dynamically.
    const headerCells = table.querySelectorAll("thead th");
    const colMap: (keyof MarketWatchRow | null)[] = headerCells.map((th) =>
      classifyHeader(th.text.trim())
    );

    const rows: MarketWatchRow[] = [];
    for (const tr of table.querySelectorAll("tbody tr")) {
      const cells = tr.querySelectorAll("td").map((td) => td.text.trim());
      if (cells.length === 0) continue;

      const rec: Partial<Record<keyof MarketWatchRow, string>> = {};
      colMap.forEach((field, idx) => {
        if (field) rec[field] = cells[idx];
      });

      const symbol = (rec.symbol ?? "").toUpperCase();
      if (!symbol) continue;

      const ldcp = toNum(rec.ldcp);
      const current = toNum(rec.current) ?? ldcp ?? 0;
      let change = toNum(rec.change);
      let changePct = toNum(rec.changePct);
      if (change == null && ldcp != null) change = current - ldcp;
      if (changePct == null && ldcp) changePct = ((current - ldcp) / ldcp) * 100;

      rows.push({
        symbol,
        sector: rec.sector ?? null,
        listedIn: rec.listedIn ?? null,
        ldcp,
        open: toNum(rec.open),
        high: toNum(rec.high),
        low: toNum(rec.low),
        current,
        change: change ?? 0,
        changePct: changePct ?? 0,
        volume: toNum(rec.volume),
      });
    }
    if (rows.length === 0) throw new Error("market-watch: parsed 0 rows");
    return rows;
  },

  async getEodCandles(symbol: string): Promise<Candle[]> {
    const res = await fetchWithRetry(
      `${config.psx.baseUrl}/timeseries/eod/${encodeURIComponent(symbol.toUpperCase())}`
    );
    const json = (await res.json()) as { status?: number; data?: number[][] };
    const data = json?.data ?? [];
    if (!Array.isArray(data) || data.length === 0)
      throw new Error(`eod/${symbol}: empty`);

    // EOD rows are [ts(sec), close, volume]. OHLC isn't provided, so we
    // approximate open = previous close for a usable candlestick series.
    // (Confirm column count against a live curl before locking the schema.)
    const ascending = [...data].sort((a, b) => a[0] - b[0]);
    const candles: Candle[] = [];
    let prevClose: number | null = null;
    for (const row of ascending) {
      const ts = Math.floor(row[0]);
      const close = Number(row[1]);
      const volume = row.length > 2 ? Number(row[2]) : undefined;
      if (!Number.isFinite(ts) || !Number.isFinite(close)) continue;
      const open = prevClose ?? close;
      candles.push({
        time: ts,
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
        volume,
      });
      prevClose = close;
    }
    return candles;
  },

  async getIntraday(symbol: string): Promise<SeriesPoint[]> {
    const res = await fetchWithRetry(
      `${config.psx.baseUrl}/timeseries/int/${encodeURIComponent(symbol.toUpperCase())}`
    );
    const json = (await res.json()) as { status?: number; data?: number[][] };
    const data = json?.data ?? [];
    if (!Array.isArray(data)) throw new Error(`int/${symbol}: bad payload`);
    return data
      .map((row) => ({ time: Math.floor(row[0]), value: Number(row[1]) }))
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .sort((a, b) => a.time - b.time);
  },
};

// ── Mock source ───────────────────────────────────────────────

export const mockSource: PsxDataSource = {
  async getMarketWatch() {
    return genMarketWatch();
  },
  async getEodCandles(symbol: string) {
    return genEodCandles(symbol);
  },
  async getIntraday(symbol: string) {
    return genIntraday(symbol);
  },
};

// ── Resilient source: live with mock fallback ─────────────────

/**
 * The source the app uses everywhere. Attempts the live scrape; on any
 * failure it logs and returns deterministic mock data so the UI degrades
 * gracefully instead of erroring (per the spec's fallback requirement).
 */
export const psx: PsxDataSource = {
  async getMarketWatch() {
    try {
      return await dpsSource.getMarketWatch();
    } catch (err) {
      console.warn("[psx] market-watch live fetch failed, using mock:", errMsg(err));
      return mockSource.getMarketWatch();
    }
  },
  async getEodCandles(symbol: string) {
    try {
      const candles = await dpsSource.getEodCandles(symbol);
      if (candles.length === 0) throw new Error("empty candles");
      return candles;
    } catch (err) {
      console.warn(`[psx] eod ${symbol} live fetch failed, using mock:`, errMsg(err));
      return mockSource.getEodCandles(symbol);
    }
  },
  async getIntraday(symbol: string) {
    try {
      const pts = await dpsSource.getIntraday(symbol);
      if (pts.length === 0) throw new Error("empty intraday");
      return pts;
    } catch (err) {
      console.warn(`[psx] intraday ${symbol} live fetch failed, using mock:`, errMsg(err));
      return mockSource.getIntraday(symbol);
    }
  },
};

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
