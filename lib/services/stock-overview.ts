import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { config } from "@/lib/config";
import { getSeedTicker } from "@/lib/psx/symbols";
import { getQuote } from "@/lib/services/prices";
import { formatDate } from "@/lib/format";
import {
  getBookClosuresData,
  getDividendHistoryData,
  type BookClosureRow,
  type DividendHistoryRow,
} from "@/lib/services/market-resources";
import { normalizeSymbol } from "@/lib/security/validation";
import {
  hasWikiMarkup,
  splitWikiPipes,
  stripMediaWikiTemplates,
  stripWikiLinks,
  wikiToPlainText,
} from "@/lib/text/plain-text";
import type {
  StockCompanyProfile,
  StockEquityProfile,
  StockKeyPerson,
  StockOverviewData,
  StockPayoutHistory,
  StockPayoutRow,
} from "@/lib/types/stock-overview";

export type {
  StockCompanyProfile,
  StockEquityProfile,
  StockKeyPerson,
  StockOverviewData,
  StockPayoutHistory,
  StockPayoutRow,
} from "@/lib/types/stock-overview";

const FUNDAMENTALS_BASE = config.fundamentals.baseUrl.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "MyStockli/1.0 (+https://mystockli.com)";
const PROFILE_TTL_SECONDS = 24 * 60 * 60;
const PROFILE_STALE_SECONDS = 30 * 24 * 60 * 60;
const PAYOUT_TTL_SECONDS = 6 * 60 * 60;
const PAYOUT_STALE_SECONDS = 14 * 24 * 60 * 60;
/** PSX cash dividends are typically quoted as % of face/par value; most ordinary shares are Rs 10. */
const DEFAULT_FACE_VALUE = 10;

interface FundamentalsCompany {
  id: number;
  symbol?: string;
  label2?: string;
  name?: string;
  label?: string;
  sector?: string;
}

interface RawSection {
  label?: string;
  data?: Array<{
    label?: string;
    unit?: string;
    data?: Array<{ year?: string | number; value?: string | number | null }>;
  }>;
}

export async function getStockOverview(symbolRaw: string): Promise<StockOverviewData | null> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return null;

  const [profileResult, payoutsResult] = await Promise.all([
    getStaleCached({
      key: `stock-overview:profile:v6:${symbol}`,
      ttlSeconds: PROFILE_TTL_SECONDS,
      staleSeconds: PROFILE_STALE_SECONDS,
      load: () => loadCompanyProfile(symbol),
      isUsable: (value) => Boolean(value?.symbol),
    }).catch(() => null),
    getStaleCached({
      key: `stock-overview:payouts:v2:${symbol}`,
      ttlSeconds: PAYOUT_TTL_SECONDS,
      staleSeconds: PAYOUT_STALE_SECONDS,
      load: () => loadPayoutHistory(symbol),
      isUsable: (value) => Boolean(value?.symbol),
    }).catch(() => null),
  ]);

  const profile =
    profileResult?.value ??
    emptyProfile(symbol, getSeedTicker(symbol)?.company ?? null, getSeedTicker(symbol)?.sector ?? null);
  const payouts =
    payoutsResult?.value ??
    ({
      symbol,
      rows: [],
      sourceLabel: "—",
      updatedAt: new Date().toISOString(),
    } satisfies StockPayoutHistory);

  return {
    symbol,
    profile,
    payouts,
    updatedAt: new Date().toISOString(),
  };
}

async function loadCompanyProfile(symbol: string): Promise<StockCompanyProfile> {
  const seed = getSeedTicker(symbol);
  const sources: string[] = [];
  const equitySources: string[] = [];

  const [company, quote, scs] = await Promise.all([
    resolveFundamentalsCompany(symbol).catch(() => null),
    getQuote(symbol).catch(() => null),
    loadScsCompanySnapshot(symbol).catch(() => null),
  ]);

  const companyName = company?.name || company?.label || seed?.company || null;
  const sector = company?.sector || seed?.sector || null;

  const [askEquity, wiki] = await Promise.all([
    company
      ? loadAskAnalystEquity(company.id).catch(() => emptyEquity())
      : Promise.resolve(emptyEquity()),
    loadWikipediaProfile(companyName ?? symbol).catch(() => null),
  ]);

  // Prefer SCS Trade equity (aligns with PSX free-float). AskAnalyst's latest
  // annual free-float series can diverge from the exchange (e.g. FFC 60% vs 55%).
  const equity = mergeEquityProfiles({
    primary: scs?.equity ?? null,
    fallback: askEquity,
    price: quote?.price ?? null,
    scsMarketCapBillions: scs?.marketCapBillions ?? null,
  });

  if (scs && hasEquityMetrics(scs.equity)) equitySources.push("SCS Trade");
  else if (hasEquityMetrics(askEquity)) equitySources.push("AskAnalyst");
  if (quote?.price != null && equity.shares != null && equity.marketCapBillions != null) {
    equitySources.push("PSX quote");
  }

  const description = composeDescription({
    wikiDescription: wiki?.description ?? null,
    wikiFacts: wiki?.facts ?? [],
    scsDescription: scs?.description ?? null,
  });

  if (company) sources.push("AskAnalyst");
  if (
    wiki?.description ||
    wiki?.facts.length ||
    wiki?.keyPeople.length ||
    wiki?.website ||
    wiki?.address
  ) {
    sources.push("Wikipedia");
  }
  if (scs?.description) sources.push("SCS Trade");

  return {
    symbol,
    companyName: wiki?.companyName || companyName,
    sector,
    description,
    keyPeople: wiki?.keyPeople ?? [],
    address: wiki?.address ?? null,
    website: wiki?.website ?? null,
    equity,
    sources: sources.length ? sources : ["—"],
    equitySources: equitySources.length ? equitySources : ["—"],
    updatedAt: new Date().toISOString(),
  };
}

/** AskAnalyst outstanding-shares series — used only when SCS is unavailable. */
async function loadAskAnalystEquity(companyId: number): Promise<StockEquityProfile> {
  const sections = await fundamentalsFetch<RawSection[]>(`/stockpricedatanew/${companyId}`);
  const sharesMn = latestSectionValue(sections, [/total shares/i, /outstanding shares/i]);
  const freeFloatSharesMn = latestSectionValue(sections, [/free float shares/i]);
  const freeFloatPct = latestSectionValue(sections, [/^free float$/i, /free float\s*%/i]);

  const shares =
    sharesMn != null && Number.isFinite(sharesMn) ? sharesMn * 1_000_000 : null;
  const freeFloatShares =
    freeFloatSharesMn != null && Number.isFinite(freeFloatSharesMn)
      ? freeFloatSharesMn * 1_000_000
      : null;

  return {
    marketCapBillions: null,
    shares,
    freeFloatShares,
    freeFloatPct: freeFloatPct != null && Number.isFinite(freeFloatPct) ? freeFloatPct : null,
    sharesUnit: shares != null ? "shares" : null,
  };
}

/**
 * SCS Trade company snapshot mirrors PSX share-structure figures (free float %,
 * total shares). We deliberately do not scrape dps.psx.com.pk.
 */
async function loadScsCompanySnapshot(symbol: string): Promise<{
  equity: StockEquityProfile;
  marketCapBillions: number | null;
  description: string | null;
} | null> {
  const url = `https://www.scstrade.com/stockscreening/SS_CompanySnapShot.aspx?symbol=${encodeURIComponent(
    symbol
  )}`;
  const html = await fetchText(url);
  if (!/ContentPlaceHolder1_/i.test(html)) return null;

  const sharesMn = parseScsMagnitude(extractScsSpan(html, "lbl_nos"));
  const freeFloatMn = parseScsMagnitude(extractScsSpan(html, "lbl_freefloat"));
  const freeFloatPct = parseScsPercent(extractScsSpan(html, "lblFreeFloatP"));
  const marketCapBillions = parseScsMagnitude(
    extractScsSpan(html, "lbl_mktcap") ?? extractScsSpan(html, "lblMarketCap")
  );
  const description = cleanText(extractScsSpan(html, "lblProfile") ?? "");

  const shares =
    sharesMn != null && Number.isFinite(sharesMn) ? sharesMn * 1_000_000 : null;
  const freeFloatShares =
    freeFloatMn != null && Number.isFinite(freeFloatMn) ? freeFloatMn * 1_000_000 : null;

  // Prefer exchange-reported %; otherwise derive from share counts when both exist.
  let resolvedFreeFloatPct =
    freeFloatPct != null && Number.isFinite(freeFloatPct) ? freeFloatPct : null;
  if (
    resolvedFreeFloatPct == null &&
    shares != null &&
    freeFloatShares != null &&
    shares > 0
  ) {
    resolvedFreeFloatPct = (freeFloatShares / shares) * 100;
  }

  return {
    equity: {
      marketCapBillions: null,
      shares,
      freeFloatShares,
      freeFloatPct: resolvedFreeFloatPct,
      sharesUnit: shares != null ? "shares" : null,
    },
    marketCapBillions:
      marketCapBillions != null && Number.isFinite(marketCapBillions)
        ? marketCapBillions
        : null,
    description: description || null,
  };
}

function mergeEquityProfiles({
  primary,
  fallback,
  price,
  scsMarketCapBillions,
}: {
  primary: StockEquityProfile | null;
  fallback: StockEquityProfile;
  price: number | null;
  scsMarketCapBillions: number | null;
}): StockEquityProfile {
  const preferPrimary = primary != null && hasEquityMetrics(primary);

  // When SCS is available, never mix in AskAnalyst free-float (known to diverge).
  const shares = preferPrimary ? primary!.shares : fallback.shares ?? null;
  const freeFloatShares = preferPrimary ? primary!.freeFloatShares : null;
  const freeFloatPct = preferPrimary ? primary!.freeFloatPct : null;

  const marketCapBillions =
    price != null && shares != null && Number.isFinite(price) && shares > 0
      ? (price * shares) / 1_000_000_000
      : scsMarketCapBillions != null && Number.isFinite(scsMarketCapBillions)
        ? scsMarketCapBillions
        : null;

  return {
    marketCapBillions,
    shares,
    freeFloatShares,
    freeFloatPct,
    sharesUnit: shares != null ? "shares" : null,
  };
}

function hasEquityMetrics(equity: StockEquityProfile): boolean {
  return (
    equity.shares != null ||
    equity.freeFloatShares != null ||
    equity.freeFloatPct != null ||
    equity.marketCapBillions != null
  );
}

function extractScsSpan(html: string, idSuffix: string): string | null {
  const pattern = new RegExp(
    `id="ContentPlaceHolder1_${idSuffix}"[^>]*>([\\s\\S]*?)</span>`,
    "i"
  );
  const match = html.match(pattern);
  return match?.[1]?.trim() ?? null;
}

/** Parse values like "1,439.02 mn", "770.06 bn", "Rs. 850.97 bn". */
function parseScsMagnitude(raw: string | null): number | null {
  if (!raw) return null;
  const text = cleanText(raw).replace(/,/g, "");
  const match = text.match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseScsPercent(raw: string | null): number | null {
  if (!raw) return null;
  const text = cleanText(raw).replace(/,/g, "");
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Build 1–3 readable paragraphs: Wikipedia intro first, then a short
 * grounded facts paragraph, then SCS only when it adds unique business detail.
 * Never invents content; strips HTML to plaintext.
 */
function composeDescription({
  wikiDescription,
  wikiFacts,
  scsDescription,
}: {
  wikiDescription: string | null;
  wikiFacts: string[];
  scsDescription: string | null;
}): string | null {
  const paragraphs: string[] = [];
  const wiki = limitProse(cleanText(wikiDescription ?? ""), 4, 900);
  if (wiki) paragraphs.push(wiki);

  const covered = paragraphs.join(" ").toLowerCase();
  const uncoveredFacts = wikiFacts
    .map((fact) => cleanText(fact))
    .filter(Boolean)
    .filter((fact) => !isNearDuplicate(fact, covered))
    .slice(0, 3);
  if (uncoveredFacts.length) {
    paragraphs.push(uncoveredFacts.join(" "));
  }

  const scs = limitProse(cleanText(scsDescription ?? ""), 2, 420);
  if (scs && !isNearDuplicate(scs, paragraphs.join(" "))) {
    paragraphs.push(scs);
  }

  return paragraphs.length ? paragraphs.join("\n\n") : null;
}

function limitProse(text: string, maxSentences: number, maxChars: number): string {
  if (!text) return "";
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  let out = "";
  for (const sentence of sentences.slice(0, maxSentences)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (out && next.length > maxChars) break;
    out = next;
    if (out.length >= maxChars) break;
  }
  if (!out) return text.slice(0, maxChars).trim();
  return out.length > maxChars ? `${out.slice(0, maxChars).replace(/\s+\S*$/, "").trim()}…` : out;
}

function isNearDuplicate(candidate: string, against: string): boolean {
  const key = candidate.toLowerCase().trim();
  const blob = against.toLowerCase();
  if (!key) return true;
  if (blob.includes(key) || key.includes(blob)) return true;
  return tokenOverlap(blob, key) >= 0.72;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter((t) => t.length > 3));
  const tb = new Set(b.split(/\s+/).filter((t) => t.length > 3));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

function latestSectionValue(sections: RawSection[], patterns: RegExp[]): number | null {
  for (const section of sections) {
    for (const row of section.data ?? []) {
      const label = row.label ?? "";
      if (!patterns.some((pattern) => pattern.test(label))) continue;
      const points = [...(row.data ?? [])].sort((a, b) => Number(a.year ?? 0) - Number(b.year ?? 0));
      for (let i = points.length - 1; i >= 0; i -= 1) {
        const numeric = toNumber(points[i]?.value);
        if (numeric != null) return numeric;
      }
    }
  }
  return null;
}

async function resolveFundamentalsCompany(symbol: string): Promise<FundamentalsCompany | null> {
  const cached = await getStaleCached({
    key: "stock-fundamentals:companies:v2",
    ttlSeconds: 7 * 24 * 60 * 60,
    staleSeconds: 365 * 24 * 60 * 60,
    load: () => fundamentalsFetch<FundamentalsCompany[]>("/companylistwithids"),
    isUsable: (value) => Array.isArray(value) && value.length > 0,
  });
  const companies = cached.value;
  return (
    companies.find((company) => company.symbol?.toUpperCase() === symbol) ??
    companies.find((company) => company.label2?.toUpperCase() === symbol) ??
    null
  );
}

async function loadWikipediaProfile(query: string): Promise<{
  companyName: string | null;
  description: string | null;
  facts: string[];
  keyPeople: StockKeyPerson[];
  address: string | null;
  website: string | null;
} | null> {
  const title = await findWikipediaTitle(query);
  if (!title) return null;

  const [summary, extracts, wikitext] = await Promise.all([
    fetchJson<{ extract?: string; title?: string }>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    ).catch(() => null),
    fetchJson<{
      query?: { pages?: Record<string, { extract?: string; title?: string }> };
    }>(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=0&explaintext=1&redirects=1&titles=${encodeURIComponent(
        title
      )}&format=json`
    ).catch(() => null),
    fetchJson<{
      parse?: { wikitext?: { ["*"]?: string } };
    }>(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
        title
      )}&prop=wikitext&format=json&redirects=1`
    ).catch(() => null),
  ]);

  const raw = wikitext?.parse?.wikitext?.["*"] ?? "";
  const infobox = extractInfobox(raw);
  const keyPeople = parseKeyPeople(infobox.key_people ?? "");
  const website = normalizeWebsite(infobox.website ?? "");
  const address = buildAddress(infobox);
  const pageExtract = Object.values(extracts?.query?.pages ?? {})[0]?.extract ?? "";
  // Prefer the short REST summary intro; fall back to the longer page extract.
  const description =
    cleanText(summary?.extract ?? "") ||
    cleanText(pageExtract) ||
    null;
  const facts = buildInfoboxFacts(infobox, description);

  if (!description && !facts.length && !keyPeople.length && !website && !address) {
    return null;
  }

  return {
    companyName: cleanText(infobox.name ?? summary?.title ?? "") || null,
    description,
    facts,
    keyPeople,
    address,
    website,
  };
}

/** Factual one-liners from the company infobox — only when grounded in wiki fields. */
function buildInfoboxFacts(
  infobox: Record<string, string>,
  existingDescription: string | null
): string[] {
  const facts: string[] = [];
  const blob = (existingDescription ?? "").toLowerCase();
  const covers = (...needles: string[]) =>
    needles.some((needle) => needle && blob.includes(needle.toLowerCase()));

  const founded = parseInfoboxYear(infobox.founded ?? infobox.establishment ?? "");
  if (founded && !covers(String(founded), "founded", "established", "incorporated in")) {
    facts.push(`Founded in ${founded}.`);
  }

  const tradedAs = cleanWikiLink(infobox.traded_as ?? "");
  if (
    tradedAs &&
    /psx|kse|pakistan stock|karse/i.test(tradedAs) &&
    !covers("listed on", "pakistan stock exchange", "psx", "kse")
  ) {
    facts.push("Listed on the Pakistan Stock Exchange (PSX).");
  }

  const locations = cleanWikiLink(infobox.num_locations ?? infobox.location ?? "");
  if (locations && locations.length > 3 && !covers("operates", "plants", "facilities")) {
    const plantCount = locations.split(/,| and /i).map((p) => p.trim()).filter(Boolean).length;
    if (plantCount >= 2) {
      facts.push(
        `Operations and offices span ${locations}${/[.!?]$/.test(locations) ? "" : "."}`
      );
    }
  }

  const products = cleanWikiLink(infobox.products ?? "");
  if (products && !covers("produces", "products include", products.split(/,/)[0] ?? "")) {
    facts.push(`Products include ${products.replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim()}.`);
  }

  const production = cleanWikiLink(infobox.production ?? "");
  if (production && !covers("production", "mt/day", "capacity")) {
    facts.push(`Production capacity is about ${production}.`);
  }

  const employees = cleanWikiLink(infobox.num_employees ?? "");
  const employeesYear = cleanWikiLink(infobox.num_employees_year ?? "");
  if (employees && !covers("employ", "employees", "workforce")) {
    facts.push(
      `Employs about ${employees} people${employeesYear ? ` (${employeesYear})` : ""}.`
    );
  }

  const owner = cleanWikiLink(infobox.owner ?? "");
  if (owner && !covers("subsidiary", "owned by", owner.split("(")[0]?.trim() ?? "")) {
    facts.push(`Owned by ${owner}.`);
  }

  return facts.map((fact) => cleanText(fact)).filter(Boolean);
}

function parseInfoboxYear(raw: string): string | null {
  if (!raw.trim()) return null;
  const startDate = raw.match(/\{\{start date(?: and age)?\|(\d{4})/i);
  if (startDate?.[1]) return startDate[1];
  const year = raw.match(/\b(19|20)\d{2}\b/);
  return year?.[0] ?? null;
}

async function findWikipediaTitle(query: string): Promise<string | null> {
  const cleaned = cleanText(query)
    .replace(/\b(ltd|limited|co\.?|company)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const searches = [
    cleaned,
    `${cleaned} Pakistan`,
    `${cleaned} Limited`,
  ];

  for (const search of searches) {
    const payload = await fetchJson<{
      query?: { search?: Array<{ title: string; snippet?: string }> };
    }>(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        search
      )}&srlimit=5&format=json`
    ).catch(() => null);

    const hits = payload?.query?.search ?? [];
    const preferred =
      hits.find((hit) => /pakistan|psx|karachi|fertilizer|cement|bank|limited/i.test(
        `${hit.title} ${hit.snippet ?? ""}`
      )) ?? hits[0];
    if (preferred?.title) return preferred.title;
  }
  return null;
}

function extractInfobox(wikitext: string): Record<string, string> {
  const match = wikitext.match(/\{\{Infobox company([\s\S]*?)\n\}\}/i);
  if (!match) return {};
  const body = match[1];
  const fields: Record<string, string> = {};
  const lines = body.split("\n");
  let currentKey: string | null = null;
  let currentValue = "";

  const flush = () => {
    if (!currentKey) return;
    fields[currentKey] = currentValue.trim();
    currentKey = null;
    currentValue = "";
  };

  for (const line of lines) {
    const field = line.match(/^\|\s*([a-z0-9_]+)\s*=\s*(.*)$/i);
    if (field) {
      flush();
      currentKey = field[1].toLowerCase();
      currentValue = field[2] ?? "";
    } else if (currentKey) {
      currentValue += `\n${line}`;
    }
  }
  flush();
  return fields;
}

function parseKeyPeople(raw: string): StockKeyPerson[] {
  if (!raw.trim()) return [];
  const people: StockKeyPerson[] = [];
  const prepared = stripMediaWikiTemplates(raw);
  const chunks = prepared
    .split(/\n|\*/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    if (/plainlist|infobox|unbulleted|^ubl$/i.test(chunk)) continue;

    // `Name|[[role|label]]` or shattered leftovers — keep person, attach role.
    const pipeParts = splitWikiPipes(chunk)
      .map((part) => part.trim())
      .filter(Boolean);
    if (pipeParts.length >= 2) {
      const maybeName = cleanWikiLink(pipeParts[0]);
      const maybeRole = normalizePersonRole(pipeParts.slice(1).join(" "));
      if (maybeName && !isRoleOnlyLabel(maybeName) && isPlausiblePersonName(maybeName)) {
        if (isRoleOnlyLabel(pipeParts.slice(1).join(" ")) || maybeRole !== "Key person") {
          people.push({
            name: maybeName,
            role: maybeRole || "Key person",
          });
          continue;
        }
      }
      // Role-only fragment after a person (e.g. `[[chairperson` / `chairman]]`).
      if (isRoleOnlyLabel(cleanWikiLink(chunk)) || pipeParts.every((p) => isRoleOnlyLabel(cleanWikiLink(p)))) {
        attachRoleToLastPerson(people, normalizePersonRole(chunk));
        continue;
      }
    }

    if (isRoleOnlyLabel(cleanWikiLink(chunk))) {
      attachRoleToLastPerson(people, normalizePersonRole(chunk));
      continue;
    }

    const roleMatch = chunk.match(/\(\[\[([^\]]+)\]\]\)|\(([^)]+)\)/);
    const roleRaw = roleMatch?.[1] ?? roleMatch?.[2] ?? "";
    let role = normalizePersonRole(roleRaw);
    let namePart = chunk;
    if (roleMatch) namePart = chunk.slice(0, roleMatch.index).trim();
    const name = cleanWikiLink(namePart);
    if (!name || name.length < 3) continue;
    if (/^(?:ubl|plainlist|flatlist|hlist)$/i.test(name)) continue;
    if (isRoleOnlyLabel(name) || !isPlausiblePersonName(name)) continue;
    if (!role || role === "Key person") {
      role = guessRole(chunk) || "Key person";
      // Avoid promoting the person's own name into a fake role.
      if (role.toLowerCase() === name.toLowerCase()) role = "Key person";
    }
    people.push({ name, role });
  }

  // Prefer one entry per normalized role (Chairperson / CEO), else dedupe by name+role.
  return dedupeKeyPeople(people);
}

function attachRoleToLastPerson(people: StockKeyPerson[], role: string) {
  if (!people.length || !role || role === "Key person") return;
  const last = people[people.length - 1];
  if (!last.role || last.role === "Key person") {
    last.role = role;
  }
}

function isRoleOnlyLabel(text: string): boolean {
  const t = text.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 64) return false;
  return /^(?:chair(?:man|person|woman)?|vice[- ]?chair(?:man|person|woman)?|chief executive(?: officer)?|ceo|managing director|md|cfo|chief financial(?: officer)?|company secretary|secretary|director|president|founder|co[- ]?founder)$/i.test(
    t
  );
}

function isPlausiblePersonName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return false;
  if (hasWikiMarkup(name)) return false;
  if (isRoleOnlyLabel(name)) return false;
  // Require at least one letter; reject pure punctuation / markup debris.
  if (!/[A-Za-z]/.test(name)) return false;
  return true;
}

function dedupeKeyPeople(people: StockKeyPerson[]): StockKeyPerson[] {
  const byRole = new Map<string, StockKeyPerson>();
  const rest: StockKeyPerson[] = [];
  const seen = new Set<string>();

  for (const person of people) {
    const roleKey = person.role.toLowerCase();
    if (roleKey === "chairperson" || roleKey === "ceo") {
      if (!byRole.has(roleKey)) byRole.set(roleKey, person);
      continue;
    }
    const key = `${person.name}|${person.role}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rest.push(person);
  }

  const preferred = ["chairperson", "ceo"]
    .map((role) => byRole.get(role))
    .filter((person): person is StockKeyPerson => Boolean(person));
  return [...preferred, ...rest];
}

function normalizePersonRole(raw: string): string {
  let role = cleanWikiLink(raw);
  if (role.includes("|")) role = splitWikiPipes(role).pop()?.trim() ?? role;
  if (/chief executive|\bceo\b/i.test(role)) return "CEO";
  if (/chair/i.test(role)) return "Chairperson";
  if (/managing director|\bmd\b/i.test(role)) return "Managing Director";
  if (/secretary/i.test(role)) return "Company Secretary";
  if (/cfo|chief financial/i.test(role)) return "CFO";
  if (isRoleOnlyLabel(role)) {
    // Title-case leftover known roles that didn't match above.
    return role.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return role || "Key person";
}

function guessRole(text: string): string {
  if (/chief executive|\bceo\b/i.test(text)) return "CEO";
  if (/chair/i.test(text)) return "Chairperson";
  if (/managing director|\bmd\b/i.test(text)) return "Managing Director";
  if (/secretary/i.test(text)) return "Company Secretary";
  if (/cfo|chief financial/i.test(text)) return "CFO";
  return "Key person";
}

function buildAddress(infobox: Record<string, string>): string | null {
  const parts = [
    cleanWikiLink(infobox.hq_location ?? ""),
    cleanWikiLink(infobox.hq_location_city ?? ""),
    cleanWikiLink(infobox.hq_location_country ?? ""),
    cleanWikiLink(infobox.headquarters ?? ""),
  ].filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length ? unique.join(", ") : null;
}

function normalizeWebsite(raw: string): string | null {
  const urlMatch = raw.match(/\{\{URL\|([^}|]+)(?:\|[^}]*)?\}\}/i);
  const candidate = cleanText(urlMatch?.[1] ?? raw);
  if (!candidate) return null;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(candidate)) return `https://${candidate}`;
  return null;
}

function cleanWikiLink(value: string): string {
  let text = value;
  text = stripMediaWikiTemplates(text);
  text = stripWikiLinks(text);
  text = text.replace(/<ref[\s\S]*?<\/ref>/gi, " ");
  text = text.replace(/'''?/g, "");
  return cleanText(text);
}

function cleanText(value: string): string {
  return wikiToPlainText(value)
    .replace(/\([^)]*pronunciation[^)]*\)/gi, " ")
    .replace(/\b[A-Z]{2,}(?:-[a-z]+)+\b/g, " ") // drop FOW-jee-FER-ti-LY-zer style respellings
    .replace(/\s+/g, " ")
    .trim();
}

async function loadPayoutHistory(symbol: string): Promise<StockPayoutHistory> {
  // Prefer the existing dividend-history feed (credited dates + payout text).
  // Enrich with book-closures for face value + book-closure dates.
  // Never merge SCS + KSE payout text into one table (that caused duplicate 85% rows).
  const [historyData, bookData] = await Promise.all([
    getDividendHistoryData().catch(() => null),
    getBookClosuresData().catch(() => null),
  ]);

  const bookRows = (bookData?.rows ?? []).filter(
    (row) => row.symbol.toUpperCase() === symbol && row.payout
  );
  const faceValue = resolveFaceValue(bookRows) ?? DEFAULT_FACE_VALUE;

  const historyRows = (historyData?.rows ?? []).filter(
    (row) => row.symbol.toUpperCase() === symbol
  );

  const fromHistory = historyRows
    .map((row) => mapHistoryPayoutRow(row, faceValue, bookRows))
    .filter((row): row is StockPayoutRow => Boolean(row));

  const mapped =
    fromHistory.length > 0
      ? fromHistory
      : bookRows
          .map((row) => mapBookClosurePayoutRow(row, faceValue))
          .filter((row): row is StockPayoutRow => Boolean(row));

  const rows = dedupePayoutRows(mapped)
    .sort((a, b) => b.dateSort.localeCompare(a.dateSort))
    .slice(0, 10);

  return {
    symbol,
    rows,
    sourceLabel: fromHistory.length > 0
      ? historyData?.sourceLabel || "Dividend history"
      : bookData?.sourceLabel || "Book closures",
    updatedAt: new Date().toISOString(),
  };
}

function mapHistoryPayoutRow(
  row: DividendHistoryRow,
  faceValue: number,
  bookRows: BookClosureRow[]
): StockPayoutRow | null {
  const parsed = parseCashPayout(row.payout, faceValue);
  if (!parsed) return null;
  const dateSort = toSortableDate(row.creditedOn);
  if (!dateSort) return null;

  const matched = matchBookClosure(bookRows, parsed.payoutPercent, dateSort);

  return {
    id: row.id,
    symbol: row.symbol,
    date: formatPayoutDate(row.creditedOn) || "—",
    dateSort,
    payoutPercent: parsed.payoutPercent,
    payoutLabel: parsed.payoutLabel,
    amountPerShare: parsed.amountPerShare,
    bookClosureDate: matched
      ? formatBookClosureDisplay(matched.bookClosureFrom, matched.bookClosureTo)
      : "—",
  };
}

function mapBookClosurePayoutRow(
  row: BookClosureRow,
  faceValue: number
): StockPayoutRow | null {
  const parsed = parseCashPayout(row.payout, faceValue);
  if (!parsed) return null;
  const from = row.bookClosureFrom;
  const to = row.bookClosureTo;
  const dateSort = toSortableDate(from) || toSortableDate(to);
  if (!dateSort) return null;

  return {
    id: row.id,
    symbol: row.symbol,
    date: formatPayoutDate(from) || formatPayoutDate(to) || "—",
    dateSort,
    payoutPercent: parsed.payoutPercent,
    payoutLabel: parsed.payoutLabel,
    amountPerShare: parsed.amountPerShare,
    bookClosureDate: formatBookClosureDisplay(from, to),
  };
}

/** Match a credited payout to a book-closure row by % and nearby dates. */
function matchBookClosure(
  bookRows: BookClosureRow[],
  payoutPercent: number | null,
  creditedSort: string
): BookClosureRow | null {
  if (!bookRows.length) return null;
  const creditedMs = Date.parse(creditedSort);
  if (Number.isNaN(creditedMs)) return null;

  let best: BookClosureRow | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of bookRows) {
    const parsed = parseCashPayout(row.payout, DEFAULT_FACE_VALUE);
    if (
      payoutPercent != null &&
      parsed?.payoutPercent != null &&
      Math.abs(parsed.payoutPercent - payoutPercent) > 0.05
    ) {
      continue;
    }
    const closureSort =
      toSortableDate(row.bookClosureFrom) || toSortableDate(row.bookClosureTo);
    if (!closureSort) continue;
    const closureMs = Date.parse(closureSort);
    if (Number.isNaN(closureMs)) continue;
    // Book closure usually precedes credit; allow a wide window for schedule lag.
    const delta = Math.abs(creditedMs - closureMs);
    if (delta > 366 * 86_400_000) continue;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = row;
    }
  }
  return best;
}

function resolveFaceValue(rows: BookClosureRow[]): number | null {
  for (const row of rows) {
    const parsed = parseFaceValue(row.faceValue);
    if (parsed != null) return parsed;
  }
  return null;
}

function parseFaceValue(raw: string | null | undefined): number | null {
  if (!raw || raw === "—") return null;
  const match = String(raw).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Extract cash dividend % and PKR per share from payout text.
 * Prefer explicit percent × face value; fall back to an explicit Rs amount.
 * SCS often emits "Dividend 85" without a % sign — treat that as 85%.
 */
function parseCashPayout(
  payout: string,
  faceValue: number
): { payoutPercent: number | null; payoutLabel: string; amountPerShare: number | null } | null {
  const text = payout.replace(/\s+/g, " ").trim();
  if (!text) return null;
  // Skip pure bonus / right entitlements — this card is cash payout focused.
  const isRightOnly = /\bright\b/i.test(text) && !/dividend|cash/i.test(text);
  const isBonusOnly = /\bbonus\b/i.test(text) && !/dividend|cash/i.test(text);
  if (isRightOnly || isBonusOnly) return null;

  const percentMatch =
    text.match(/(\d+(?:\.\d+)?)\s*%/) ??
    text.match(/(?:dividend|cash|interim|final)(?:\s+\w+)*\s+(\d+(?:\.\d+)?)\b/i);
  if (percentMatch) {
    const payoutPercent = Number(percentMatch[1]);
    if (!Number.isFinite(payoutPercent) || payoutPercent <= 0) return null;
    return {
      payoutPercent,
      payoutLabel: formatPercentLabel(payoutPercent),
      amountPerShare: roundPayoutAmount((payoutPercent / 100) * faceValue),
    };
  }

  const rsMatch = text.match(/(?:rs\.?|pkr)\s*([\d.]+)/i);
  if (rsMatch) {
    const amountPerShare = roundPayoutAmount(Number(rsMatch[1]));
    if (amountPerShare == null || amountPerShare <= 0) return null;
    const payoutPercent =
      faceValue > 0 ? roundPayoutAmount((amountPerShare / faceValue) * 100) : null;
    return {
      payoutPercent,
      payoutLabel: payoutPercent != null ? formatPercentLabel(payoutPercent) : "—",
      amountPerShare,
    };
  }

  return null;
}

function formatPercentLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return `${Math.round(rounded)}%`;
  return `${rounded}%`;
}

function roundPayoutAmount(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10_000) / 10_000;
}

function formatPayoutDate(value: string | null | undefined): string {
  if (!value || value === "—") return "";
  const formatted = formatDate(toSortableDate(value) || value);
  return formatted === "—" ? value : formatted;
}

function formatBookClosureDisplay(from: string, to: string): string {
  const fromLabel = formatPayoutDate(from);
  const toLabel = formatPayoutDate(to);
  if (fromLabel && toLabel && fromLabel !== toLabel) return `${fromLabel} – ${toLabel}`;
  return fromLabel || toLabel || "—";
}

function toSortableDate(value: string | null | undefined): string {
  if (!value || value === "—") return "";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function dedupePayoutRows(rows: StockPayoutRow[]): StockPayoutRow[] {
  const seen = new Set<string>();
  const out: StockPayoutRow[] = [];
  for (const row of rows) {
    const pctKey =
      row.payoutPercent != null ? String(row.payoutPercent) : row.payoutLabel.toLowerCase();
    const key = `${row.symbol}|${pctKey}|${row.dateSort}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function emptyEquity(): StockEquityProfile {
  return {
    marketCapBillions: null,
    shares: null,
    freeFloatShares: null,
    freeFloatPct: null,
    sharesUnit: null,
  };
}

function emptyProfile(
  symbol: string,
  companyName: string | null,
  sector: string | null
): StockCompanyProfile {
  return {
    symbol,
    companyName,
    sector,
    description: null,
    keyPeople: [],
    address: null,
    website: null,
    equity: emptyEquity(),
    sources: ["—"],
    equitySources: ["—"],
    updatedAt: new Date().toISOString(),
  };
}

async function fundamentalsFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${FUNDAMENTALS_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Fundamentals ${path} failed with ${response.status}`);
  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.json()) as T;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[(),%\s,]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
