import "server-only";

import { getStaleCached } from "@/lib/cache/stale";

export interface PkSpotPrice {
  pricePerTola: number | null;
  changePerTola: number | null;
}

export interface PkCopperSpot {
  pricePerKg: number | null;
  changePerKg: number | null;
}

export interface PkCommoditiesData {
  gold24: PkSpotPrice | null;
  silver: PkSpotPrice | null;
  copper: PkCopperSpot | null;
  platinum: PkSpotPrice | null;
  usdPkr: number | null;
  updatedAt: string;
  source: string;
}

const TOLAS_PER_OZ = 2.66667;
const LBS_PER_KG = 2.20462;
const YAHOO_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function getPakistanCommodities(): Promise<PkCommoditiesData> {
  const { value } = await getStaleCached({
    key: "public:pk-commodities-v8",
    ttlSeconds: 90,
    staleSeconds: 30 * 60,
    load: fetchLive,
  });
  return value;
}

function parseNum(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDiff(s: string | null | undefined): number | null {
  if (!s) return null;
  const clean = s.trim().replace(/,/g, "").replace(/\+$/, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function extractLabel(html: string, id: string): string | null {
  const re = new RegExp(`id="${id}"[^>]*>([^<]+)<`, "i");
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

async function fetchSpot(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
    const res = await fetch(url, { headers: { accept: "application/json", "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(7_000) });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, prevClose: Number.isFinite(prevClose) ? prevClose : price };
  } catch {
    return null;
  }
}

async function fetchPakgold(): Promise<{
  gold24: PkSpotPrice;
  silver: PkSpotPrice;
  platinum: PkSpotPrice;
  usdPkr: number;
} | null> {
  try {
    const res = await fetch("https://www.pakgold.net/", {
      headers: { accept: "text/html", "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const gold24Price = parseNum(extractLabel(html, "lbl_TTBarSell") ?? extractLabel(html, "lbl_snippet_rate"));
    if (!gold24Price) return null;

    const usdPkr = parseNum(extractLabel(html, "lbl_DollarSell")) ?? 280;
    const silverPrice = parseNum(extractLabel(html, "lbl_localSilverSell"));
    const platinumPrice = parseNum(extractLabel(html, "lbl_localPT"));

    // lbl_InternalMarket* = live international spot (auto-updated)
    // lbl_*high / lbl_*low = previous session's range (updated once per day)
    // → use high as prevClose proxy; apply % change to local PKR price
    const pct = (curr: number | null, prev: number | null) =>
      curr && prev && prev > 0 ? (curr - prev) / prev : null;

    const goldPct = pct(parseNum(extractLabel(html, "lbl_InternalMarketGold")), parseNum(extractLabel(html, "lbl_goldhigh")));
    const silverPct = pct(parseNum(extractLabel(html, "lbl_InternalMarketSilver")), parseNum(extractLabel(html, "lbl_silverhigh")));
    const platPct = pct(parseNum(extractLabel(html, "lbl_InternalMarketPT")), parseNum(extractLabel(html, "lbl_pthigh")));

    return {
      gold24: {
        pricePerTola: gold24Price,
        changePerTola: goldPct !== null ? Math.round(goldPct * gold24Price) : null,
      },
      silver: {
        pricePerTola: silverPrice,
        changePerTola: silverPct !== null && silverPrice ? Math.round(silverPct * silverPrice) : null,
      },
      platinum: {
        pricePerTola: platinumPrice,
        changePerTola: platPct !== null && platinumPrice ? Math.round(platPct * platinumPrice) : null,
      },
      usdPkr,
    };
  } catch {
    return null;
  }
}

async function fetchLive(): Promise<PkCommoditiesData> {
  const pakgold = await fetchPakgold();

  if (pakgold) {
    const [gcSpot, siSpot, hgSpot] = await Promise.all([
      fetchSpot("GC=F"),
      fetchSpot("SI=F"),
      fetchSpot("HG=F"),
    ]);

    // Daily change = % move in international spot × actual local PKR price.
    // prevClose from Yahoo Finance is yesterday's close — fixed for the day.
    const spotChangePct = (spot: { price: number; prevClose: number } | null) =>
      spot && spot.prevClose > 0 ? (spot.price - spot.prevClose) / spot.prevClose : null;

    const goldPct = spotChangePct(gcSpot);
    const silverPct = spotChangePct(siSpot);

    const goldChange = goldPct !== null && pakgold.gold24.pricePerTola !== null
      ? Math.round(goldPct * pakgold.gold24.pricePerTola)
      : null;
    const silverChange = silverPct !== null && pakgold.silver.pricePerTola !== null
      ? Math.round(silverPct * pakgold.silver.pricePerTola)
      : null;

    const copper: PkCopperSpot | null = hgSpot
      ? {
          pricePerKg: Math.round(hgSpot.price * LBS_PER_KG * pakgold.usdPkr),
          changePerKg: Math.round((hgSpot.price - hgSpot.prevClose) * LBS_PER_KG * pakgold.usdPkr),
        }
      : null;

    return {
      gold24: { pricePerTola: pakgold.gold24.pricePerTola, changePerTola: goldChange },
      silver: { pricePerTola: pakgold.silver.pricePerTola, changePerTola: silverChange },
      copper,
      platinum: pakgold.platinum,
      usdPkr: pakgold.usdPkr,
      updatedAt: new Date().toISOString(),
      source: "PakGold (Rawalpindi-Islamabad Sarafa)",
    };
  }

  const [goldSpot, silverSpot, copperSpot, platinumSpot, pkrSpot] = await Promise.all([
    fetchSpot("GC=F"),
    fetchSpot("SI=F"),
    fetchSpot("HG=F"),
    fetchSpot("PL=F"),
    fetchSpot("PKR=X"),
  ]);

  if (!goldSpot || !pkrSpot) throw new Error("Price data unavailable");

  const pkrRate = pkrSpot.price;
  const gold24Price = Math.round((goldSpot.price * pkrRate) / TOLAS_PER_OZ);
  const gold24Prev = Math.round((goldSpot.prevClose * pkrRate) / TOLAS_PER_OZ);

  let silver: PkSpotPrice | null = null;
  if (silverSpot) {
    const sp = Math.round((silverSpot.price * pkrRate) / TOLAS_PER_OZ);
    silver = { pricePerTola: sp, changePerTola: sp - Math.round((silverSpot.prevClose * pkrRate) / TOLAS_PER_OZ) };
  }

  let copper: PkCopperSpot | null = null;
  if (copperSpot) {
    const ck = Math.round(copperSpot.price * LBS_PER_KG * pkrRate);
    copper = { pricePerKg: ck, changePerKg: ck - Math.round(copperSpot.prevClose * LBS_PER_KG * pkrRate) };
  }

  let platinum: PkSpotPrice | null = null;
  if (platinumSpot) {
    const pp = Math.round((platinumSpot.price * pkrRate) / TOLAS_PER_OZ);
    platinum = { pricePerTola: pp, changePerTola: pp - Math.round((platinumSpot.prevClose * pkrRate) / TOLAS_PER_OZ) };
  }

  return {
    gold24: { pricePerTola: gold24Price, changePerTola: gold24Price - gold24Prev },
    silver,
    copper,
    platinum,
    usdPkr: Math.round(pkrRate * 100) / 100,
    updatedAt: new Date().toISOString(),
    source: "Yahoo Finance (GC=F, SI=F, HG=F, PL=F, PKR=X)",
  };
}
