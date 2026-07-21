import "server-only";
import { config, isZaiConfigured } from "@/lib/config";
import { fetchWorldNews, fetchNationalNews, type NewsArticle } from "@/lib/services/world-news";
import { getIndexDetail, getMarketAnalytics, type SectorPerformance } from "@/lib/services/market";
import { getMarketRows } from "@/lib/services/prices";
import { getFipiLipiData, FLOW_SECTORS, type FipiLipiData } from "@/lib/services/fipi-lipi";

// ── News parameter model (article → PSX-impact attribution) ──────────────────

export const PSX_NEWS_PARAMS: {
  id: string;
  label: string;
  weight: number;
  keywords: string[];
}[] = [
  { id: "imf", label: "IMF Programme", weight: 10,
    keywords: ["imf","tranche","imf deal","imf approval","imf review","imf delay","bailout","structural benchmark","extended fund facility","stand-by arrangement","imf disbursement","imf mission"] },
  { id: "sbp_rate", label: "SBP Policy Rate", weight: 10,
    keywords: ["sbp","policy rate","monetary policy committee","mpc","rate cut","rate hike","state bank of pakistan","benchmark rate","discount rate"] },
  { id: "fuel_domestic", label: "Domestic Fuel Prices", weight: 9,
    keywords: ["petrol price","petroleum prices","fuel price","pump price","petrol levy","diesel price","cng price","ogra","petroleum minister","petroleum division","motor spirit","high-speed diesel"] },
  { id: "pkr_usd", label: "PKR / USD", weight: 8,
    keywords: ["rupee","pkr","exchange rate","currency depreciation","rupee falls","rupee strengthens","interbank rate","open market rate"] },
  { id: "political", label: "Political Stability", weight: 8,
    keywords: ["pmln","pti","imran khan","nawaz sharif","pakistan parliament","pakistan election","political crisis","pakistan court","dharna","protests in islamabad","prime minister pakistan","pakistan cabinet","no-confidence"] },
  { id: "inflation", label: "Pakistan Inflation", weight: 8,
    keywords: ["inflation","consumer price index","producer price index","food inflation","core inflation","pakistan inflation","inflationary pressure"] },
  { id: "external_debt", label: "External Debt & Reserves", weight: 7,
    keywords: ["foreign reserve","forex reserve","external debt","debt servicing","eurobond","sukuk","current account","balance of payment","sbp reserves","import cover"] },
  { id: "credit_rating", label: "Credit Rating", weight: 7,
    keywords: ["moody's","fitch ratings","credit rating","rating upgrade","rating downgrade","sovereign rating","outlook negative","outlook positive"] },
  { id: "regional_conflict", label: "Regional Conflict", weight: 7,
    keywords: ["india-pakistan","india pakistan","border tension","kashmir","pakistan ceasefire","pakistan nuclear","pakistan missile","pakistan airspace","war with pakistan","surgical strike","pak-india"] },
  { id: "security", label: "Domestic Security", weight: 7,
    keywords: ["terror attack","terrorist","suicide bombing","security forces","ttp","killed in attack","bomb blast","militant"] },
  { id: "global_oil", label: "Global Oil (news)", weight: 6,
    keywords: ["oil price","crude oil","brent crude","opec","oil surges","oil falls","oil drops","crude falls","crude rises"] },
  { id: "fed_rate", label: "US Federal Reserve", weight: 6,
    keywords: ["federal reserve","fed rate","fomc","jerome powell","fed decision","fed hike","fed cut","us interest rate"] },
  { id: "remittances", label: "Remittances", weight: 6,
    keywords: ["remittance","overseas pakistani","worker remittance","home remittance"] },
  { id: "fatf", label: "FATF / AML", weight: 6,
    keywords: ["fatf","grey list","financial action task force","terrorist financing"] },
  { id: "banking", label: "Banking Sector", weight: 6,
    keywords: ["hbl","mcb bank","ubl","bank alfalah","banking sector","banks profit","non-performing loan","banking spread","bank earnings"] },
  { id: "power_energy", label: "Power / Circular Debt", weight: 6,
    keywords: ["circular debt","load shedding","loadshedding","electricity tariff","nepra","wapda","k-electric","capacity payment","fuel adjustment charge"] },
  { id: "china_cpec", label: "China / CPEC", weight: 5,
    keywords: ["cpec","chinese investment","belt and road","sino-pak","chinese loan","gwadar","ml-1"] },
  { id: "global_markets", label: "Global Markets (news)", weight: 5,
    keywords: ["wall street","s&p 500","dow jones","nasdaq","global stocks","market rally","market crash","risk-off","emerging market"] },
  { id: "textile_exports", label: "Textile / Exports", weight: 5,
    keywords: ["textile","garment export","knitwear","apparel export","cotton yarn","eu gsp","tariff on pakistan","pakistan export","pakistan trade deficit"] },
  { id: "privatization", label: "Privatization / SOE", weight: 5,
    keywords: ["privatization","pia sale","pso","ogdc","pakistan petroleum","divestment","stake sale","state-owned"] },
  { id: "dev_finance", label: "ADB / World Bank", weight: 5,
    keywords: ["asian development bank","world bank loan","world bank grant","ifc","development loan","budget support","programme loan"] },
  { id: "commodities", label: "Commodities", weight: 4,
    keywords: ["gold price","wheat price","cotton price","sugar price","commodity rally"] },
  { id: "fertilizer_agri", label: "Agriculture / Fertilizer", weight: 3,
    keywords: ["engro","fauji fertilizer","fertilizer price","urea price","kharif","rabi crop","wheat crop","cotton crop","farm subsidy"] },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type PsxSignalGroup = "technical" | "flows" | "macro" | "news";

export interface PsxMatchedArticle {
  title: string;
  url: string;
  sentiment: "positive" | "negative";
}

export interface PsxSignal {
  id: string;
  group: PsxSignalGroup;
  label: string;
  value: string;
  score: number;
  weight: number;
  detail: string;
  articles?: PsxMatchedArticle[];
}

export interface PsxKeyFactor {
  factor: string;
  impact: "positive" | "negative";
  weight: number;
  detail: string;
}

export interface PsxPrediction {
  direction: "bullish" | "bearish" | "neutral";
  confidence: "high" | "medium" | "low";
  score: number;
  positiveCount: number;
  negativeCount: number;
  signals: PsxSignal[];
  keyFactors: PsxKeyFactor[];
  summary: string;
  disclaimer: string;
  generatedBy: "ai" | "model";
}

export interface DmaReading {
  period: number;
  value: number;
  bullish: boolean;
}

export interface IndexAnalysis {
  symbol: string;
  name: string;
  current: number;
  change: number;
  changePct: number;
  returns: { d1: number; w1: number; m1: number; m3: number; ytd: number };
  dmas: DmaReading[];
  dmaBullCount: number;
  rsi14: number | null;
  rsiState: "overbought" | "oversold" | "neutral";
  goldenCross: boolean | null;
  week52High: number;
  week52Low: number;
  posIn52w: number;
  verdict: "bullish" | "bearish" | "mixed";
  verdictDetail: string;
}

export interface SectorOutlook {
  sector: string;
  outlook: "outperform" | "neutral" | "underperform";
  score: number;
  lastSessionPct: number;
  advancers: number;
  decliners: number;
  stockCount: number;
  foreignFlowM: number | null;
  newsNet: number;
  reasons: string[];
  articles: PsxMatchedArticle[];
}

export interface PsxPredictionPage {
  prediction: PsxPrediction;
  indices: IndexAnalysis[];
  sectors: SectorOutlook[];
  newsStats: { analysed: number; positive: number; negative: number };
  sessionDate: string;
}

const DISCLAIMER =
  "Signal-fusion analytical model combining live market data, technicals, investor flows, global macro and news sentiment. Not financial advice.";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clamp10(n: number): number {
  return clamp(n, -10, 10);
}

function fmtPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtMusd(n: number): string {
  return `${n > 0 ? "+" : ""}$${n.toFixed(1)}M`;
}

function keywordMatches(title: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(title);
}

// ── Index technical analysis ──────────────────────────────────────────────────

const DMA_PERIODS = [5, 20, 30, 50, 100, 150, 200];

function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

async function analyzeIndex(symbol: string, name: string): Promise<IndexAnalysis | null> {
  try {
    const detail = await getIndexDetail(symbol);
    if (!detail || detail.candles.length < 30) return null;

    const closes = detail.candles.map((c) => c.close);
    const price = detail.current;

    const dmas: DmaReading[] = DMA_PERIODS
      .filter((p) => closes.length >= p)
      .map((p) => {
        const slice = closes.slice(-p);
        const value = slice.reduce((s, c) => s + c, 0) / slice.length;
        return { period: p, value, bullish: price > value };
      });
    const dmaBullCount = dmas.filter((d) => d.bullish).length;

    const rsi14 = computeRsi(closes.slice(-120));
    const rsiState: IndexAnalysis["rsiState"] =
      rsi14 == null ? "neutral" : rsi14 >= 70 ? "overbought" : rsi14 <= 30 ? "oversold" : "neutral";

    const dma50 = dmas.find((d) => d.period === 50)?.value ?? null;
    const dma200 = dmas.find((d) => d.period === 200)?.value ?? null;
    const goldenCross = dma50 != null && dma200 != null ? dma50 > dma200 : null;

    const range = detail.week52High - detail.week52Low;
    const posIn52w = range > 0 ? clamp(((price - detail.week52Low) / range) * 100, 0, 100) : 50;

    const verdict: IndexAnalysis["verdict"] =
      dmas.length > 0 && dmaBullCount >= Math.ceil(dmas.length * 0.65) ? "bullish"
      : dmas.length > 0 && dmaBullCount <= Math.floor(dmas.length * 0.35) ? "bearish"
      : "mixed";

    const verdictDetail =
      `Price is above ${dmaBullCount} of ${dmas.length} key moving averages` +
      `${goldenCross != null ? `, 50-DMA is ${goldenCross ? "above" : "below"} the 200-DMA (${goldenCross ? "golden" : "death"}-cross regime)` : ""}` +
      `${rsi14 != null ? `, RSI-14 at ${rsi14.toFixed(0)} (${rsiState})` : ""}` +
      `, trading at ${posIn52w.toFixed(0)}% of its 52-week range.`;

    return {
      symbol,
      name,
      current: price,
      change: detail.change,
      changePct: detail.changePct,
      returns: {
        d1: detail.returns.d1,
        w1: detail.returns.w1,
        m1: detail.returns.m1,
        m3: detail.returns.m3,
        ytd: detail.returns.ytd,
      },
      dmas,
      dmaBullCount,
      rsi14,
      rsiState,
      goldenCross,
      week52High: detail.week52High,
      week52Low: detail.week52Low,
      posIn52w,
      verdict,
      verdictDetail,
    };
  } catch {
    return null;
  }
}

// ── Signal collectors ─────────────────────────────────────────────────────────

function technicalSignalsFromIndex(a: IndexAnalysis | null): PsxSignal[] {
  if (!a) return [];
  const signals: PsxSignal[] = [];

  const d1 = a.returns.d1;
  signals.push({
    id: "kse_session",
    group: "technical",
    label: "KSE-100 Last Session",
    value: fmtPct(d1),
    score: clamp10(d1 * 3.5),
    weight: 7,
    detail: `KSE-100 ${d1 >= 0 ? "gained" : "lost"} ${Math.abs(d1).toFixed(2)}% last session, closing at ${Math.round(a.current).toLocaleString()}. Short-term momentum tends to persist into the next session.`,
  });

  signals.push({
    id: "kse_trend",
    group: "technical",
    label: "KSE-100 Trend (1W / 1M)",
    value: `${fmtPct(a.returns.w1)} / ${fmtPct(a.returns.m1)}`,
    score: clamp10(a.returns.w1 * 1.2 + a.returns.m1 * 0.4),
    weight: 5,
    detail: `One-week return ${fmtPct(a.returns.w1)}, one-month ${fmtPct(a.returns.m1)}, trading at ${a.posIn52w.toFixed(0)}% of the 52-week range.`,
  });

  if (a.dmas.length > 0) {
    const ratio = a.dmaBullCount / a.dmas.length;
    signals.push({
      id: "kse_dma",
      group: "technical",
      label: "KSE-100 vs Moving Averages",
      value: `${a.dmaBullCount}/${a.dmas.length} DMAs bullish`,
      score: clamp10((ratio - 0.5) * 14),
      weight: 6,
      detail: `Price trades above ${a.dmaBullCount} of ${a.dmas.length} tracked DMAs (5–200 day)${a.goldenCross != null ? `; the 50-DMA sits ${a.goldenCross ? "above" : "below"} the 200-DMA — a ${a.goldenCross ? "golden" : "death"}-cross regime` : ""}.`,
    });
  }

  if (a.rsi14 != null && a.rsiState !== "neutral") {
    signals.push({
      id: "kse_rsi",
      group: "technical",
      label: "KSE-100 RSI-14",
      value: a.rsi14.toFixed(0),
      score: a.rsiState === "overbought" ? -4 : 4,
      weight: 4,
      detail: `RSI-14 at ${a.rsi14.toFixed(0)} — ${a.rsiState === "overbought" ? "overbought territory raises pullback risk for the next session" : "oversold territory raises bounce probability for the next session"}.`,
    });
  }

  return signals;
}

async function collectBreadthSignal(): Promise<PsxSignal[]> {
  try {
    const rows = await getMarketRows();
    if (!rows || rows.length < 50) return [];
    const adv = rows.filter((r) => r.changePct > 0.15).length;
    const dec = rows.filter((r) => r.changePct < -0.15).length;
    const total = adv + dec;
    if (total === 0) return [];
    const ratio = (adv - dec) / total;
    return [{
      id: "breadth",
      group: "technical",
      label: "Market Breadth",
      value: `${adv} ▲ / ${dec} ▼`,
      score: clamp10(ratio * 12),
      weight: 6,
      detail: `${adv} advancing vs ${dec} declining symbols on the market watch — ${ratio > 0.1 ? "broad participation supports the move" : ratio < -0.1 ? "broad selling pressure across the board" : "mixed, directionless breadth"}.`,
    }];
  } catch {
    return [];
  }
}

function flowSignalsFrom(data: FipiLipiData | null): PsxSignal[] {
  if (!data || data.source === "sample" || !data.latest) return [];
  const latestM = data.latest.fipiNet.net / 1_000_000;
  const last5M = data.days.slice(-5).reduce((s, d) => s + d.fipiNet.net, 0) / 1_000_000;
  return [{
    id: "fipi",
    group: "flows",
    label: "Foreign Investor Flow (FIPI)",
    value: `${fmtMusd(latestM)} · 5d ${fmtMusd(last5M)}`,
    score: clamp10(latestM * 1.2 + last5M * 0.25),
    weight: 9,
    detail: `NCCPL reports net foreign ${latestM >= 0 ? "buying" : "selling"} of ${fmtMusd(Math.abs(latestM))} in the latest session (${data.latest.date}), ${fmtMusd(last5M)} cumulative over five sessions. Foreign flow is one of the strongest next-session PSX predictors.`,
  }];
}

interface MacroQuoteSpec {
  id: string;
  symbol: string;
  label: string;
  weight: number;
  scoreFn: (changePct: number) => number;
  detailFn: (changePct: number, price: number) => string;
}

const MACRO_QUOTES: MacroQuoteSpec[] = [
  {
    id: "usd_pkr", symbol: "PKR=X", label: "USD / PKR", weight: 8,
    scoreFn: (c) => clamp10(-c * 10),
    detailFn: (c, p) => `Rupee ${c > 0.05 ? "weakened" : c < -0.05 ? "strengthened" : "held steady"} — USD/PKR at ${p.toFixed(1)} (${fmtPct(c)}). Rupee weakness pressures import-heavy sectors and foreign outflows.`,
  },
  {
    id: "brent", symbol: "BZ=F", label: "Brent Crude", weight: 7,
    scoreFn: (c) => clamp10(-c * 2.2),
    detailFn: (c, p) => `Brent at $${p.toFixed(1)} (${fmtPct(c)}). Pakistan imports most of its energy — rising oil widens the import bill and fuels inflation; falling oil is a direct positive.`,
  },
  {
    id: "spx", symbol: "^GSPC", label: "S&P 500", weight: 5,
    scoreFn: (c) => clamp10(c * 3),
    detailFn: (c) => `US equities ${c >= 0 ? "up" : "down"} ${Math.abs(c).toFixed(2)}% — global risk appetite spills over to emerging and frontier markets including PSX.`,
  },
  {
    id: "nifty", symbol: "^NSEI", label: "NIFTY 50 (regional)", weight: 4,
    scoreFn: (c) => clamp10(c * 3),
    detailFn: (c) => `Indian equities ${fmtPct(c)} — regional South-Asia sentiment proxy for foreign EM allocators.`,
  },
  {
    id: "vix", symbol: "^VIX", label: "VIX (risk appetite)", weight: 4,
    scoreFn: (c) => clamp10(-c * 0.7),
    detailFn: (c, p) => `VIX at ${p.toFixed(1)} (${fmtPct(c)}) — ${c > 3 ? "rising fear drains flows from risk assets" : c < -3 ? "falling volatility supports risk-taking" : "stable global risk backdrop"}.`,
  },
  {
    id: "gold", symbol: "GC=F", label: "Gold", weight: 2,
    scoreFn: (c) => clamp10(-c * 1.2),
    detailFn: (c, p) => `Gold at $${p.toFixed(0)} (${fmtPct(c)}) — a sharp gold bid signals risk-off and competes with equities for local savings.`,
  },
];

async function fetchQuoteChange(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`,
      {
        headers: {
          accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; Stockli/1.0; +https://mystockli.qzz.io)",
        },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(6_000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice);
    const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    if (!Number.isFinite(price) || !Number.isFinite(prev) || prev === 0) return null;
    return { price, changePct: ((price - prev) / prev) * 100 };
  } catch {
    return null;
  }
}

interface MacroData {
  signals: PsxSignal[];
  quotes: Record<string, { price: number; changePct: number }>;
}

async function collectMacro(): Promise<MacroData> {
  const quotes: MacroData["quotes"] = {};
  const results = await Promise.all(
    MACRO_QUOTES.map(async (spec): Promise<PsxSignal | null> => {
      const q = await fetchQuoteChange(spec.symbol);
      if (!q) return null;
      quotes[spec.id] = q;
      return {
        id: spec.id,
        group: "macro",
        label: spec.label,
        value: fmtPct(q.changePct),
        score: spec.scoreFn(q.changePct),
        weight: spec.weight,
        detail: spec.detailFn(q.changePct, q.price),
      };
    })
  );
  return { signals: results.filter((s): s is PsxSignal => s !== null), quotes };
}

interface ParamMatch {
  param: (typeof PSX_NEWS_PARAMS)[number];
  posMatches: NewsArticle[];
  negMatches: NewsArticle[];
}

function matchNewsParams(articles: NewsArticle[]): ParamMatch[] {
  const positive = articles.filter((a) => a.psxSentiment === "positive");
  const negative = articles.filter((a) => a.psxSentiment === "negative");
  return PSX_NEWS_PARAMS
    .map((param) => ({
      param,
      posMatches: positive.filter((a) => param.keywords.some((k) => keywordMatches(a.title, k))),
      negMatches: negative.filter((a) => param.keywords.some((k) => keywordMatches(a.title, k))),
    }))
    .filter((m) => m.posMatches.length > 0 || m.negMatches.length > 0);
}

function newsBalanceSignal(articles: NewsArticle[]): PsxSignal {
  const pos = articles.filter((a) => a.psxSentiment === "positive").length;
  const neg = articles.filter((a) => a.psxSentiment === "negative").length;
  const total = pos + neg;
  return {
    id: "news_balance",
    group: "news",
    label: "News Sentiment Balance",
    value: `${pos} +ve / ${neg} −ve`,
    score: total > 0 ? clamp10(((pos - neg) / total) * 8) : 0,
    weight: 7,
    detail: total > 0
      ? `Of ${articles.length} articles scanned in the last 12 hours, ${pos} carry a positive Pakistan-market impact and ${neg} a negative one — the overall news tone ${pos > neg ? "supports" : pos < neg ? "weighs on" : "is balanced for"} the next session.`
      : `No market-moving Pakistan headlines detected in the last 12 hours — news flow is a neutral factor for the next session.`,
  };
}

function collectNewsSignals(paramMatches: ParamMatch[]): PsxSignal[] {
  const signals: PsxSignal[] = paramMatches.map(({ param, posMatches, negMatches }) => {
    const net = posMatches.length - negMatches.length;
    return {
      id: `news_${param.id}`,
      group: "news",
      label: param.label,
      value: `${posMatches.length > 0 ? `+${posMatches.length}` : ""}${posMatches.length > 0 && negMatches.length > 0 ? " / " : ""}${negMatches.length > 0 ? `−${negMatches.length}` : ""} news`,
      score: clamp10(net * 3),
      weight: param.weight,
      detail: `${posMatches.length} positive and ${negMatches.length} negative Pakistan-impact headlines matched this factor in the last 12 hours.`,
      articles: [
        ...posMatches.map((a) => ({ title: a.title, url: a.url, sentiment: "positive" as const })),
        ...negMatches.map((a) => ({ title: a.title, url: a.url, sentiment: "negative" as const })),
      ],
    };
  });
  return signals
    .sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight))
    .slice(0, 8);
}

// ── Sector outlook ────────────────────────────────────────────────────────────

const FLOW_SECTOR_NEEDLES: Record<string, string[]> = {
  "Banks": ["COMMERCIAL BANK"],
  "OMCs": ["MARKETING"],
  "E&Ps": ["EXPLORATION"],
  "Cement": ["CEMENT"],
  "Fertilizer": ["FERTILIZER"],
  "FMCGs": ["FOOD", "PERSONAL CARE"],
  "IPPs": ["POWER"],
  "Telecom": ["TECHNOLOGY", "COMMUNICATION"],
  "Textile": ["TEXTILE"],
};

const NEWS_SECTOR_MAP: { paramId: string; needles: string[]; multiplier: number }[] = [
  { paramId: "banking", needles: ["COMMERCIAL BANK"], multiplier: 1 },
  { paramId: "sbp_rate", needles: ["COMMERCIAL BANK", "CEMENT", "AUTOMOBILE", "ENGINEERING"], multiplier: 1 },
  { paramId: "fuel_domestic", needles: ["MARKETING", "REFINERY"], multiplier: 1 },
  { paramId: "global_oil", needles: ["EXPLORATION"], multiplier: -1 },
  { paramId: "power_energy", needles: ["POWER"], multiplier: 1 },
  { paramId: "fertilizer_agri", needles: ["FERTILIZER"], multiplier: 1 },
  { paramId: "textile_exports", needles: ["TEXTILE"], multiplier: 1 },
  { paramId: "china_cpec", needles: ["CEMENT", "ENGINEERING"], multiplier: 1 },
  { paramId: "privatization", needles: ["EXPLORATION", "MARKETING"], multiplier: 1 },
];

const MACRO_SECTOR_MAP: {
  quoteId: string;
  needles: string[];
  multiplier: number;
  reason: (changePct: number) => string;
}[] = [
  {
    quoteId: "brent", needles: ["EXPLORATION", "REFINERY"], multiplier: 1,
    reason: (c) => `Brent ${c > 0 ? "up" : "down"} ${Math.abs(c).toFixed(1)}% — ${c > 0 ? "higher realised prices and inventory gains support" : "lower realised prices pressure"} oil producers and refiners.`,
  },
  {
    quoteId: "brent", needles: ["CEMENT", "AUTOMOBILE", "TRANSPORT"], multiplier: -1,
    reason: (c) => `Brent ${c > 0 ? "up" : "down"} ${Math.abs(c).toFixed(1)}% — ${c > 0 ? "higher energy and freight input costs squeeze" : "cheaper energy and freight costs help"} this energy-intensive sector.`,
  },
  {
    quoteId: "usd_pkr", needles: ["TEXTILE", "TECHNOLOGY"], multiplier: 1,
    reason: (c) => `Rupee ${c > 0 ? "weakness" : "strength"} (${fmtPct(c)}) ${c > 0 ? "lifts" : "trims"} the PKR value of export revenues.`,
  },
  {
    quoteId: "usd_pkr", needles: ["AUTOMOBILE", "PHARMACEUTICAL"], multiplier: -1,
    reason: (c) => `Rupee ${c > 0 ? "weakness" : "strength"} (${fmtPct(c)}) ${c > 0 ? "raises" : "eases"} imported input costs for this sector.`,
  },
];

function sectorMatchesNeedles(sector: string, needles: string[]): boolean {
  const upper = sector.toUpperCase();
  return needles.some((n) => upper.includes(n));
}

function computeSectorOutlook(
  sectors: SectorPerformance[],
  fipi: FipiLipiData | null,
  paramMatches: ParamMatch[],
  macroQuotes: MacroData["quotes"],
): SectorOutlook[] {
  const fipiLive = fipi && fipi.source !== "sample" && fipi.latest ? fipi : null;

  return sectors
    .filter((s) => s.count >= 3 && s.sector !== "Other")
    .map((s) => {
      const reasons: string[] = [];
      const articles: PsxMatchedArticle[] = [];

      const momentum = clamp(s.avgChangePct * 1.5, -3, 3);
      const breadth = s.count > 0 ? clamp(((s.advancers - s.decliners) / s.count) * 2.5, -2.5, 2.5) : 0;
      reasons.push(
        `Last session ${fmtPct(s.avgChangePct)} average across ${s.count} stocks (${s.advancers} up, ${s.decliners} down).`
      );

      let flow = 0;
      let foreignFlowM: number | null = null;
      if (fipiLive) {
        const flowIdx = FLOW_SECTORS.findIndex(
          (label) => FLOW_SECTOR_NEEDLES[label] && sectorMatchesNeedles(s.sector, FLOW_SECTOR_NEEDLES[label])
        );
        if (flowIdx >= 0) {
          foreignFlowM = fipiLive.latest!.fipiNet.sectors[flowIdx] / 1_000_000;
          flow = clamp(foreignFlowM * 2, -3, 3);
          if (Math.abs(foreignFlowM) >= 0.3) {
            reasons.push(
              `Foreign investors ${foreignFlowM > 0 ? "bought" : "sold"} ${fmtMusd(Math.abs(foreignFlowM))} net in this sector last session (NCCPL).`
            );
          }
        }
      }

      let news = 0;
      let newsNet = 0;
      for (const map of NEWS_SECTOR_MAP) {
        if (!sectorMatchesNeedles(s.sector, map.needles)) continue;
        const match = paramMatches.find((m) => m.param.id === map.paramId);
        if (!match) continue;
        const net = (match.posMatches.length - match.negMatches.length) * map.multiplier;
        if (net === 0 && match.posMatches.length + match.negMatches.length === 0) continue;
        newsNet += net;
        news += clamp(net * 1.5, -3, 3);
        const sectorImpactPositive = net > 0;
        reasons.push(
          `${match.param.label} news flow is ${sectorImpactPositive ? "supportive" : net < 0 ? "a headwind" : "mixed"} for this sector today.`
        );
        for (const a of [...match.posMatches, ...match.negMatches]) {
          const sentiment: "positive" | "negative" =
            (a.psxSentiment === "positive" ? 1 : -1) * map.multiplier > 0 ? "positive" : "negative";
          articles.push({ title: a.title, url: a.url, sentiment });
        }
      }
      news = clamp(news, -4, 4);

      let global = 0;
      for (const map of MACRO_SECTOR_MAP) {
        if (!sectorMatchesNeedles(s.sector, map.needles)) continue;
        const q = macroQuotes[map.quoteId];
        if (!q || Math.abs(q.changePct) < 0.3) continue;
        global += clamp(q.changePct * map.multiplier * 1.2, -2, 2);
        reasons.push(map.reason(q.changePct));
      }
      global = clamp(global, -3, 3);

      const score = momentum + breadth + flow + news + global;
      const outlook: SectorOutlook["outlook"] =
        score >= 1.2 ? "outperform" : score <= -1.2 ? "underperform" : "neutral";

      return {
        sector: s.sector,
        outlook,
        score: Math.round(score * 10) / 10,
        lastSessionPct: s.avgChangePct,
        advancers: s.advancers,
        decliners: s.decliners,
        stockCount: s.count,
        foreignFlowM,
        newsNet,
        reasons,
        articles,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Deterministic fusion ──────────────────────────────────────────────────────

function fuseSignals(signals: PsxSignal[]): {
  score: number;
  direction: PsxPrediction["direction"];
  confidence: PsxPrediction["confidence"];
  positiveCount: number;
  negativeCount: number;
} {
  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const raw = totalWeight > 0
    ? signals.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
    : 0;
  const score = Math.round(clamp(raw * 10, -100, 100));

  const direction: PsxPrediction["direction"] = score >= 10 ? "bullish" : score <= -10 ? "bearish" : "neutral";

  const active = signals.filter((x) => Math.abs(x.score) > 0.5);
  const alignedWeight = active
    .filter((x) => Math.sign(x.score) === Math.sign(score || 1))
    .reduce((s, x) => s + x.weight, 0);
  const activeWeight = active.reduce((s, x) => s + x.weight, 0);
  const agreement = activeWeight > 0 ? alignedWeight / activeWeight : 0;

  const confidence: PsxPrediction["confidence"] =
    Math.abs(score) >= 35 && agreement >= 0.7 ? "high"
    : Math.abs(score) >= 15 ? "medium"
    : "low";

  return {
    score,
    direction,
    confidence,
    positiveCount: signals.filter((x) => x.score > 0.5).length,
    negativeCount: signals.filter((x) => x.score < -0.5).length,
  };
}

function fallbackKeyFactors(signals: PsxSignal[]): PsxKeyFactor[] {
  return [...signals]
    .filter((x) => Math.abs(x.score) > 0.5)
    .sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight))
    .slice(0, 5)
    .map((x) => ({
      factor: x.label,
      impact: x.score > 0 ? "positive" as const : "negative" as const,
      weight: x.weight,
      detail: x.detail,
    }));
}

const GROUP_LABELS: Record<PsxSignalGroup, string> = {
  technical: "market technicals",
  flows: "foreign investor flows",
  macro: "global macro",
  news: "news sentiment",
};

function fallbackSummary(signals: PsxSignal[], score: number, direction: string): string {
  const top = fallbackKeyFactors(signals).slice(0, 3).map((f) => f.factor);
  const groups = [...new Set(signals.map((s) => s.group))].map((g) => GROUP_LABELS[g]);
  return `Fusion of ${signals.length} live signals across ${groups.join(", ")} yields a net score of ${score > 0 ? "+" : ""}${score}/100 — ${direction} bias for the next PSX session.${top.length > 0 ? ` Dominant drivers: ${top.join(", ")}.` : ""}`;
}

// ── AI analyst layer ──────────────────────────────────────────────────────────

function buildDossier(
  signals: PsxSignal[],
  articles: NewsArticle[],
  indices: IndexAnalysis[],
  sectors: SectorOutlook[],
): string {
  const lines = signals.map((s) =>
    `- [${s.group}] ${s.label}: ${s.value} | model score ${s.score.toFixed(1)} × weight ${s.weight} | ${s.detail}`
  );
  const indexLines = indices.map((i) =>
    `- ${i.name}: ${Math.round(i.current).toLocaleString()} (${fmtPct(i.changePct)}), ${i.dmaBullCount}/${i.dmas.length} DMAs bullish, RSI ${i.rsi14?.toFixed(0) ?? "n/a"}, ${i.goldenCross == null ? "" : i.goldenCross ? "golden-cross" : "death-cross"} — ${i.verdict}`
  );
  const sectorLines = sectors.slice(0, 8).map((s) =>
    `- ${s.sector}: model ${s.outlook} (score ${s.score}), last session ${fmtPct(s.lastSessionPct)}${s.foreignFlowM != null ? `, foreign flow ${fmtMusd(s.foreignFlowM)}` : ""}`
  );
  const tagged = articles.filter((a) => a.psxSentiment !== null).slice(0, 15);
  const news = tagged.map((a) => `- [${a.psxSentiment}] (${a.source}) ${a.title}`);

  return `You are a senior PSX (Pakistan Stock Exchange / KSE-100) sell-side strategist writing a next-session outlook.

You are given a quantified evidence dossier. Every signal was measured from live market data or classified news in the last few hours.

EVIDENCE DOSSIER:
${lines.join("\n")}

INDEX TECHNICAL STATE:
${indexLines.join("\n") || "Unavailable."}

SECTOR MODEL VIEW:
${sectorLines.join("\n") || "Unavailable."}

PAKISTAN-IMPACT HEADLINES (last 12h):
${news.length > 0 ? news.join("\n") : "None tagged."}

Instructions:
1. Weigh the evidence like an analyst, not an averager — foreign flows (FIPI) and USD/PKR dominate short-term PSX direction; momentum and DMA positioning matter; a single high-weight news shock (IMF, SBP rate, security) can override technicals.
2. Watch for contradictions and explain them (e.g. oil fell but rupee weakened).
3. Score from -100 (strongly bearish) to +100 (strongly bullish) for the NEXT trading session only.

Return ONLY valid JSON:
{
  "direction": "bullish"|"bearish"|"neutral",
  "confidence": "high"|"medium"|"low",
  "score": <-100..100>,
  "keyFactors": [{"factor":"<signal label>","impact":"positive"|"negative","weight":<1-10>,"detail":"<one specific sentence citing the actual numbers>"}],
  "summary": "<2-3 sentences: the call, the main drivers with numbers, the main risk to the call>"
}
Max 5 keyFactors, each must reference a signal from the dossier.`;
}

async function aiAnalyst(
  signals: PsxSignal[],
  articles: NewsArticle[],
  indices: IndexAnalysis[],
  sectors: SectorOutlook[],
): Promise<{
  direction: PsxPrediction["direction"];
  confidence: PsxPrediction["confidence"];
  score: number;
  keyFactors: PsxKeyFactor[];
  summary: string;
} | null> {
  if (!isZaiConfigured) return null;
  try {
    const res = await fetch(`${config.ai.zaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ai.zaiApiKey}`,
      },
      body: JSON.stringify({
        model: "glm-4.7-flash",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: buildDossier(signals, articles, indices, sectors) }],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}");
    if (!parsed.direction || typeof parsed.score !== "number") return null;
    return {
      direction: parsed.direction === "bullish" || parsed.direction === "bearish" ? parsed.direction : "neutral",
      confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
      score: Math.round(clamp(parsed.score, -100, 100)),
      keyFactors: Array.isArray(parsed.keyFactors)
        ? parsed.keyFactors.slice(0, 5).filter((f: PsxKeyFactor) => f?.factor && f?.detail)
        : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getPredictionPageData(): Promise<PsxPredictionPage> {
  const [worldArticles, nationalArticles] = await Promise.all([
    fetchWorldNews().catch(() => [] as NewsArticle[]),
    fetchNationalNews().catch(() => [] as NewsArticle[]),
  ]);
  const allArticles = [...worldArticles, ...nationalArticles];

  const [kse100, kmi30, breadth, macro, fipi, analytics] = await Promise.all([
    analyzeIndex("KSE100", "KSE-100 Index"),
    analyzeIndex("KMI30", "KMI-30 (Shariah) Index"),
    collectBreadthSignal(),
    collectMacro(),
    getFipiLipiData().catch(() => null),
    getMarketAnalytics().catch(() => null),
  ]);

  const paramMatches = matchNewsParams(allArticles);
  const signals = [
    ...technicalSignalsFromIndex(kse100),
    ...breadth,
    ...flowSignalsFrom(fipi),
    ...macro.signals,
    newsBalanceSignal(allArticles),
    ...collectNewsSignals(paramMatches),
  ];

  const indices = [kse100, kmi30].filter((i): i is IndexAnalysis => i !== null);
  const sectors = analytics ? computeSectorOutlook(analytics.sectors, fipi, paramMatches, macro.quotes) : [];

  const fused = fuseSignals(signals);
  const ai = await aiAnalyst(signals, allArticles, indices, sectors);

  const prediction: PsxPrediction = ai && ai.summary
    ? {
        direction: ai.direction,
        confidence: ai.confidence,
        score: ai.score,
        positiveCount: fused.positiveCount,
        negativeCount: fused.negativeCount,
        signals,
        keyFactors: ai.keyFactors.length > 0 ? ai.keyFactors : fallbackKeyFactors(signals),
        summary: ai.summary,
        disclaimer: DISCLAIMER,
        generatedBy: "ai",
      }
    : {
        direction: fused.direction,
        confidence: fused.confidence,
        score: fused.score,
        positiveCount: fused.positiveCount,
        negativeCount: fused.negativeCount,
        signals,
        keyFactors: fallbackKeyFactors(signals),
        summary: fallbackSummary(signals, fused.score, fused.direction),
        disclaimer: DISCLAIMER,
        generatedBy: "model",
      };

  const tagged = allArticles.filter((a) => a.psxSentiment !== null);
  return {
    prediction,
    indices,
    sectors,
    newsStats: {
      analysed: allArticles.length,
      positive: tagged.filter((a) => a.psxSentiment === "positive").length,
      negative: tagged.filter((a) => a.psxSentiment === "negative").length,
    },
    sessionDate: new Date().toISOString().slice(0, 10),
  };
}
