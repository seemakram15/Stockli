import "server-only";
import { config, isZaiConfigured } from "@/lib/config";
import type { PsxSentiment } from "@/lib/services/world-news";

// ── AI system prompt ──────────────────────────────────────────────────────────

const SYSTEM = `You are a PSX (Pakistan Stock Exchange) market analyst.

For each news article decide:
1. Does it have a DIRECT or STRONG INDIRECT impact on Pakistan economy or PSX/KSE?
2. If yes — is that impact POSITIVE or NEGATIVE for Pakistan markets?

WHAT IMPACTS PSX (classify these):
OIL/FUEL: Price drop = positive (Pakistan imports oil). Price rise = negative.
  Also any domestic petrol/diesel price announcement — minister talks, OGRA notification, pump price adjustment.
SBP/RATE: Rate cut = positive (cheaper credit, market rally). Rate hike = negative.
IMF: Tranche/deal/approval = positive. Delay/review concern = negative.
PKR/USD: Rupee strengthens = positive. Rupee falls = negative.
INFLATION: Falls = positive. Rises = negative.
EXTERNAL DEBT: New loan/relief = positive. Missed payment/default risk = negative.
CREDIT RATING: Upgrade = positive. Downgrade = negative.
REMITTANCES: Rising = positive. Falling = negative.
SECURITY: Terror attack/blast in Pakistan = negative. Operation success = positive.
POWER/ENERGY: Circular debt resolution = positive. Tariff hike/load shedding = negative.
REGIONAL CONFLICT: India-Pakistan tension/nuclear/missile = negative. Ceasefire = positive.
FATF: Whitelist/removed from grey list = positive. Grey/black list = negative.
TEXTILE/EXPORTS: Rising exports = positive. Trade deficit widening = negative.
PRIVATIZATION: PSO/PIA/OGDC stake sale = positive. Delay = slightly negative.
CHINA/CPEC: New investment/project = positive. Delay/cancellation = negative.
GLOBAL MARKETS: Risk-on rally = positive. Crash/risk-off = negative.
BANKING: Strong earnings/credit growth = positive. NPL rise/loss = negative.
GOLD: Rising gold price = slightly positive (Pakistani households hold gold).
COMMODITIES: Wheat/cotton price shifts — wheat up = negative (import cost), cotton up = positive (export).

RULES:
- Tag ONLY if there is a CLEAR connection to Pakistan or global factors that move PSX.
- News about petroleum minister talking to pump owners about price adjustment = DIRECTLY impacts inflation + consumer sentiment = TAG IT.
- General UK/Europe politics with zero Pakistan angle = null.
- Return EXACTLY one JSON object: { "article_id": "positive"|"negative"|null }`;

// ── Keyword fallback ──────────────────────────────────────────────────────────

const PAK_KW = [
  // Pakistan direct
  "pakistan","psx","kse","karachi","islamabad","lahore","rupee","pkr","sbp","cpec",
  "pmln","pti","imran","nawaz","sindh","punjab","balochistan","punjab","federal budget",
  // Fuel / domestic energy
  "petrol","petroleum","diesel","fuel price","pump price","ogra","cng price","motor spirit",
  "petrol levy","hsd","high-speed diesel","petroleum minister","petroleum division",
  // Macro
  "inflation","interest rate","dollar","imf","forex reserve","external debt","credit rating",
  "federal reserve","fed rate","remittance","circular debt","load shedding","loadshedding",
  // Sector
  "textile","cotton","hbl","mcb","ubl","abl","fatf","moody","fitch","privatization",
  "pia","pso","ogdc","sngpl","ssgc","engro","fauji","world bank","adb",
  // Global that moves PSX
  "oil price","crude oil","brent","opec","gold price","wheat price","trade war","tariff",
  "china economy","saudi","uae","gulf","nato","nuclear","missile",
];

const KW_POSITIVE = [
  // Rate / monetary
  "rate cut","sbp cuts","policy rate cut","sbp rate reduction","interest rate cut",
  "monetary easing","imf deal","imf tranche","imf approval","imf disbursement","imf programme approved",
  // Energy / fuel relief
  "petrol price cut","petrol price down","petrol price reduced","diesel price cut",
  "fuel price cut","fuel prices drop","ogra reduces","petroleum prices reduced",
  "oil falls","crude falls","oil drops","oil price down","oil prices ease",
  // Currency / reserves
  "rupee strengthens","rupee gains","pkr strengthens","dollar falls","dollar weakens",
  "forex reserve increase","reserves rise","current account surplus",
  // Macro positive
  "inflation eases","inflation falls","inflation drops","cpi falls","deflation",
  "gdp growth","economic growth","exports rise","trade surplus","export target achieved",
  // Fiscal / debt
  "imf loan","imf relief","debt restructuring","world bank loan","adb loan",
  "eurobond issued","sukuk issued","credit rating upgrade","rating upgrade","outlook positive",
  // Security / stability
  "ceasefire","peace deal","security restored","operation successful","militants eliminated",
  "fatf whitelist","removed from grey list","fatf positive","compliance improved",
  // Capital / investment
  "cpec investment","chinese investment","fdi inflow","foreign investment","privatization proceeds",
  "ipo","stake sale","new project","investment conference","sbp reserves increase",
  // Markets / sector
  "kse gains","psx gains","psx positive","psx up","kse-100 up","index gains",
  "remittance rise","remittances increase","banking profits","strong earnings",
  "circular debt resolved","power sector reform","electricity tariff reduced",
  "textile exports rise","cotton price rise",
];

const KW_NEGATIVE = [
  // Rate / monetary
  "rate hike","sbp hikes","policy rate hike","interest rate hike","monetary tightening",
  "imf delay","imf concern","imf review stalled","imf program suspended","imf conditions",
  // Energy / fuel cost
  "petrol price hike","petrol price increase","petrol price up","petrol prices raised",
  "diesel price hike","fuel price hike","fuel price increase","ogra increases",
  "oil surges","crude surges","oil price rise","brent rises","oil rally","opec cut",
  // Currency / reserves
  "rupee falls","rupee weakens","pkr falls","dollar rises","dollar surge","dollar strengthens",
  "forex reserve fall","reserves drop","import cover falls","current account deficit widens",
  // Macro negative
  "inflation surge","inflation rises","inflation high","cpi rises","stagflation",
  "gdp contraction","recession","economic slowdown","fiscal deficit",
  // Debt / fiscal
  "debt default","default risk","missed payment","debt servicing pressure",
  "credit rating downgrade","rating downgrade","outlook negative","sovereign downgrade",
  "capital outflow","capital flight",
  // Security / stability
  "terror attack","bomb blast","terrorist attack","explosion in","killed in attack",
  "political crisis","political instability","dharna","protests in islamabad",
  "court orders arrest","government falls","no-confidence",
  "fatf grey list","money laundering concerns","aml failure",
  // Power / energy
  "circular debt increases","load shedding increases","electricity tariff hike","power shortage",
  "loadshedding","power cuts","gas shortage","energy crisis",
  // Trade / external
  "trade deficit widens","exports fall","textile exports fall","sanctions on pakistan",
  "trade war impact","tariff on pakistan",
  // Markets / sector
  "kse falls","psx falls","psx negative","kse-100 down","index falls",
  "banking losses","npl rise","non-performing loan","remittances fall","remittance drop",
];

function keywordFallback(
  articles: { id: string; title: string; description: string }[]
): Record<string, PsxSentiment | null> {
  const map: Record<string, PsxSentiment | null> = {};
  for (const a of articles) {
    const t = `${a.title} ${a.description}`.toLowerCase();
    const hasPakLink = PAK_KW.some((k) => t.includes(k));
    if (!hasPakLink) { map[a.id] = null; continue; }
    const pos = KW_POSITIVE.filter((k) => t.includes(k)).length;
    const neg = KW_NEGATIVE.filter((k) => t.includes(k)).length;
    if (pos > neg) map[a.id] = "positive";
    else if (neg > pos) map[a.id] = "negative";
    else map[a.id] = null;
  }
  return map;
}

// ── AI classifier ─────────────────────────────────────────────────────────────

export async function classifyPakistanImpact(
  articles: { id: string; title: string; description: string }[]
): Promise<Record<string, PsxSentiment | null>> {
  if (articles.length === 0) return {};
  if (!isZaiConfigured) return keywordFallback(articles);

  const input = articles.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.description.slice(0, 200),
  }));

  try {
    const res = await fetch(
      `${config.ai.zaiBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.ai.zaiApiKey}`,
        },
        body: JSON.stringify({
          model: "glm-4.7-flash",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `Classify these ${articles.length} articles:\n${JSON.stringify(input)}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) return keywordFallback(articles);

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed: Record<string, unknown> = JSON.parse(raw);

    const map: Record<string, PsxSentiment | null> = {};
    for (const [id, val] of Object.entries(parsed)) {
      if (val === "positive" || val === "negative") map[id] = val;
      else map[id] = null;
    }
    return map;
  } catch {
    return keywordFallback(articles);
  }
}
