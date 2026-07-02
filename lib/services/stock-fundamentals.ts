import "server-only";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { getRedisClients } from "@/lib/cache/redis";
import { getStaleCached } from "@/lib/cache/stale";
import { config } from "@/lib/config";
import { formatCompact, formatMarketPrice, formatNumber, formatPKR, formatPercent } from "@/lib/format";
import { getEodCandlesCached } from "@/lib/services/history";
import { getQuote } from "@/lib/services/prices";
import { normalizeSymbol } from "@/lib/security/validation";
import type { Candle, Quote } from "@/lib/types";
import type {
  FundamentalsCompany,
  FinancialMetric,
  FinancialTabData,
  FinancialTable,
  FinancialTableRow,
  StockFinancialPeerComparison,
  StockFinancialPeerRow,
  StockFinancialsAvailability,
  StockFinancialsData,
  StockFinancialTabId,
} from "@/lib/types/stock-fundamentals";

const FUNDAMENTALS_BASE = config.fundamentals.baseUrl.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 25_000;
const FINANCIALS_CACHE_TTL_SECONDS = 6 * 60 * 60;
const FINANCIALS_CACHE_STALE_SECONDS = 5 * 365 * 24 * 60 * 60;
const COMPANY_LIST_TTL_SECONDS = 7 * 24 * 60 * 60;
const COMPANY_LIST_STALE_SECONDS = 365 * 24 * 60 * 60;
const READY_COMPANY_LIST_TTL_SECONDS = 30 * 60;
const READY_COMPANY_LIST_STALE_SECONDS = 24 * 60 * 60;
const ARCHIVE_BATCH_SIZE = 1;
const FINANCIAL_FETCH_ATTEMPTS = 3;
const FUNDAMENTALS_CACHE_KEY_PREFIX = "stock-fundamentals:v4:";
const INCOMPLETE_FUNDAMENTALS_KEY_PREFIX = "stock-fundamentals:incomplete:v1:";
const REQUIRED_FINANCIAL_TABS: StockFinancialTabId[] = [
  "overview",
  "latest",
  "income",
  "balance",
  "cashflow",
  "ratios",
];

type FundamentalsCacheEnvelope = {
  value: StockFinancialsData;
  storedAt: string;
  freshUntil: number;
  staleUntil: number;
};

export type StockFinancialsIncompleteRecord = {
  symbol: string;
  company: FundamentalsCompany | null;
  data: StockFinancialsData;
  availableTabs: StockFinancialTabId[];
  missingTabs: StockFinancialTabId[];
  attempts: number;
  lastAttemptAt?: string | null;
  updatedAt: string;
  lastError?: string | null;
};

type CacheStatus = "fresh" | "stale" | "miss";

export type StockFinancialsCacheResult = {
  value: StockFinancialsData;
  status: CacheStatus;
  storedAt: string;
};

type NormalizedFundamentalsCompany = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  sectorId: number | null;
  image: string | null;
};

export type StockFinancialsRefreshResult = {
  value: StockFinancialsData;
  storedAt: string;
  usedFallback: boolean;
  hadMeaningfulFreshData: boolean;
  complete: boolean;
  missingTabs: StockFinancialTabId[];
};

interface RawDataPoint {
  year?: string | number;
  label?: string | number;
  value?: string | number | null;
}

interface RawFinancialRow {
  label?: string;
  unit?: string;
  bold?: string | number | boolean;
  data?: RawDataPoint[];
}

interface RawFinancialSection {
  label?: string;
  section?: string;
  data?: RawFinancialRow[];
}

interface StatementDate {
  start_date: string;
  end_date: string;
  value: string;
  label: string;
}

interface StatementDatesResponse {
  dates?: {
    annual?: StatementDate[];
    quarter?: StatementDate[];
  };
}

type FetchInit = Omit<RequestInit, "headers" | "body"> & {
  headers?: HeadersInit;
  body?: BodyInit | null;
};

const EMPTY_TABS: Record<StockFinancialTabId, FinancialTabData> = {
  overview: emptyTab("Overview", "Trading, valuation and historical financial snapshots."),
  latest: emptyTab("Latest results", "Latest quarterly and year-to-date P&L summary."),
  income: emptyTab("Income statement", "Annual revenue, profit, margins and EPS history."),
  balance: emptyTab("Balance sheet", "Annual assets, liabilities and equity history."),
  cashflow: emptyTab("Cash flow", "Annual operating cash flow, capex and free cash flow history."),
  ratios: emptyTab("Ratios", "Valuation, margins, returns, health, activity and growth metrics."),
};

export async function getStockFinancials(symbolRaw: string) {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return null;

  const cached = await readStockFinancialsSnapshot(symbol);
  if (cached?.value) {
    const hydrated = await enrichOverviewSnapshot(cached.value);
    return {
      value: hydrated,
      status: Date.now() < cached.freshUntil ? "fresh" : "stale",
      storedAt: cached.storedAt,
    } satisfies StockFinancialsCacheResult;
  }

  const incomplete = await readIncompleteStockFinancials(symbol);
  if (incomplete) {
    const hydrated = await enrichOverviewSnapshot(attachFinancialAvailability(incomplete.data, incomplete));
    return {
      value: hydrated,
      status: "miss",
      storedAt: incomplete.updatedAt,
    } satisfies StockFinancialsCacheResult;
  }

  const company = await resolveCompany(symbol);
  const preparing = await enrichOverviewSnapshot(buildPreparingFinancials(symbol, company));
  return {
    value: preparing,
    status: "miss",
    storedAt: new Date().toISOString(),
  } satisfies StockFinancialsCacheResult;
}

export async function refreshStockFinancials(
  symbolRaw: string
): Promise<StockFinancialsRefreshResult | null> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return null;

  const previous = await readStockFinancialsSnapshot(symbol);
  const value = await fetchStockFinancialsWithRetries(symbol, previous?.value);
  const hasMeaningfulFreshData = hasMeaningfulFinancialData(value);

  if (previous?.value && !hasMeaningfulFreshData) {
    const previousComplete = hasCompleteFinancialData(previous.value);
    if (!previousComplete) {
      const missingTabs = getMissingFinancialTabs(previous.value);
      await deleteStockFinancialsSnapshot(symbol);
      const incomplete = await markStockFinancialsIncomplete(
        symbol,
        previous.value,
        missingTabs,
        "Fresh fundamentals did not include statement rows."
      );
      const hydrated = await enrichOverviewSnapshot(
        attachFinancialAvailability(previous.value, incomplete)
      );
      return {
        value: hydrated,
        storedAt: incomplete.updatedAt,
        usedFallback: true,
        hadMeaningfulFreshData: false,
        complete: false,
        missingTabs,
      };
    }

    const envelope = await storeStockFinancialsSnapshot(symbol, previous.value);
    const hydrated = await enrichOverviewSnapshot(previous.value);
    return {
      value: hydrated,
      storedAt: envelope.storedAt,
      usedFallback: true,
      hadMeaningfulFreshData: false,
      complete: true,
      missingTabs: [],
    };
  }

  const nextValue = previous?.value ? mergeStockFinancialSnapshots(previous.value, value) : value;
  if (!hasCompleteFinancialData(nextValue)) {
    if (previous?.value && hasCompleteFinancialData(previous.value)) {
      const envelope = await storeStockFinancialsSnapshot(symbol, previous.value);
      const hydrated = await enrichOverviewSnapshot(previous.value);
      return {
        value: hydrated,
        storedAt: envelope.storedAt,
        usedFallback: true,
        hadMeaningfulFreshData: hasMeaningfulFreshData,
        complete: true,
        missingTabs: [],
      };
    }

    await deleteStockFinancialsSnapshot(symbol);
    const missingTabs = getMissingFinancialTabs(nextValue);
    const incomplete = await markStockFinancialsIncomplete(
      symbol,
      nextValue,
      missingTabs,
      `Incomplete fundamentals: ${missingTabs.join(", ")}`
    );
    const hydrated = await enrichOverviewSnapshot(attachFinancialAvailability(nextValue, incomplete));
    return {
      value: hydrated,
      storedAt: new Date().toISOString(),
      usedFallback: false,
      hadMeaningfulFreshData: hasMeaningfulFreshData,
      complete: false,
      missingTabs,
    };
  }

  const envelope = await storeStockFinancialsSnapshot(symbol, nextValue);
  const hydrated = await enrichOverviewSnapshot(nextValue);
  return {
    value: hydrated,
    storedAt: envelope.storedAt,
    usedFallback: false,
    hadMeaningfulFreshData: hasMeaningfulFreshData,
    complete: hasCompleteFinancialData(nextValue),
    missingTabs: getMissingFinancialTabs(nextValue),
  };
}

export async function getStockFinancialPeerComparison({
  symbol: symbolRaw,
  tabId,
  metricLabel,
}: {
  symbol: string;
  tabId: StockFinancialTabId;
  metricLabel: string;
}) {
  const symbol = normalizeSymbol(symbolRaw);
  const metric = metricLabel.trim().slice(0, 120);
  if (!symbol || !metric || tabId === "overview") return null;

  const snapshot = await readStockFinancialsSnapshot(symbol);
  if (!snapshot?.value || !hasCompleteFinancialData(snapshot.value)) return null;

  const value = await buildCachedStockFinancialPeerComparison(symbol, tabId, metric);
  return {
    value,
    status: "fresh",
    storedAt: value.updatedAt,
  } satisfies { value: StockFinancialPeerComparison; status: CacheStatus; storedAt: string };
}

export async function getStockFundamentalsCompanies({
  readyOnly = false,
}: {
  readyOnly?: boolean;
} = {}) {
  const normalized = normalizeFundamentalsCompanies(await getFundamentalsCompanies());
  if (!readyOnly) return normalized;

  const readySymbols = new Set(await getReadyFundamentalsCompanySymbols(normalized));
  return normalized.filter((company) => readySymbols.has(company.symbol));
}

export async function getArchivedStockFinancialsBatch({
  offset = 0,
  limit = 25,
}: {
  offset?: number;
  limit?: number;
} = {}) {
  const companies = await getStockFundamentalsCompanies({ readyOnly: true });
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const window = companies.slice(safeOffset, safeOffset + safeLimit);
  const records = (
    await Promise.all(
      window.map(async (company) => {
        const snapshot = await readStockFinancialsSnapshot(company.symbol);
        if (!snapshot?.value || !hasCompleteFinancialData(snapshot.value)) return null;
        return {
          symbol: company.symbol,
          storedAt: snapshot.storedAt,
          data: snapshot.value,
        };
      })
    )
  ).filter(
    (
      record
    ): record is {
      symbol: string;
      storedAt: string;
      data: StockFinancialsData;
    } => Boolean(record)
  );

  const nextOffset = safeOffset + window.length >= companies.length ? null : safeOffset + window.length;

  return {
    total: companies.length,
    offset: safeOffset,
    limit: safeLimit,
    nextOffset,
    records,
  };
}

export async function archiveStockFundamentals({
  offset = 0,
  limit = 25,
  symbols,
}: {
  offset?: number;
  limit?: number;
  symbols?: string[];
} = {}) {
  const allCompanies = await getFundamentalsCompanies();
  const requestedSymbols = new Set(
    (symbols ?? [])
      .map((symbol) => normalizeSymbol(symbol))
      .filter(Boolean)
  );
  const candidates = requestedSymbols.size
    ? allCompanies.filter((company) =>
        requestedSymbols.has(normalizeSymbol(company.symbol || company.label2))
      )
    : allCompanies.slice(Math.max(0, offset), Math.max(0, offset) + Math.min(Math.max(1, limit), 50));

  const startedAt = new Date().toISOString();
  const results = await mapLimit(candidates, ARCHIVE_BATCH_SIZE, async (company) => {
    const symbol = normalizeSymbol(company.symbol || company.label2);
    if (!symbol) {
      return {
        symbol: company.symbol || company.label2 || "UNKNOWN",
        ok: false,
        error: "Missing symbol",
      };
    }

    try {
      const previous = await readStockFinancialsSnapshot(symbol);
      const data = await fetchStockFinancialsWithRetries(symbol, previous?.value);
      const hasMeaningfulFreshData = hasMeaningfulFinancialData(data);

      if (previous?.value && !hasMeaningfulFreshData) {
        const previousComplete = hasCompleteFinancialData(previous.value);
        if (!previousComplete) {
          await deleteStockFinancialsSnapshot(symbol);
          const missingTabs = getMissingFinancialTabs(previous.value);
          await markStockFinancialsIncomplete(
            symbol,
            previous.value,
            missingTabs,
            "Fresh fundamentals did not include statement rows."
          );
          return {
            symbol,
            ok: true,
            partial: true,
            preserved: true,
            complete: false,
            missingTabs,
          };
        }

        await storeStockFinancialsSnapshot(symbol, previous.value);
        return {
          symbol,
          ok: true,
          preserved: true,
          complete: true,
          missingTabs: [],
        };
      }

      const nextValue = previous?.value ? mergeStockFinancialSnapshots(previous.value, data) : data;
      if (!hasCompleteFinancialData(nextValue)) {
        if (previous?.value && hasCompleteFinancialData(previous.value)) {
          await storeStockFinancialsSnapshot(symbol, previous.value);
          return {
            symbol,
            ok: true,
            preserved: true,
            complete: true,
            missingTabs: [],
          };
        }

        await deleteStockFinancialsSnapshot(symbol);
        const missingTabs = getMissingFinancialTabs(nextValue);
        await markStockFinancialsIncomplete(
          symbol,
          nextValue,
          missingTabs,
          `Incomplete fundamentals: ${missingTabs.join(", ")}`
        );
        return {
          symbol,
          ok: true,
          partial: true,
          complete: false,
          missingTabs,
          warning: `Incomplete fundamentals: ${missingTabs.join(", ")}`,
        };
      }

      await storeStockFinancialsSnapshot(symbol, nextValue);
      return {
        symbol,
        ok: true,
        preserved: false,
        complete: hasCompleteFinancialData(nextValue),
        missingTabs: getMissingFinancialTabs(nextValue),
      };
    } catch (error) {
      return {
        symbol,
        ok: false,
        error: error instanceof Error ? error.message : "Archive failed",
      };
    }
  });

  const failed = results.filter((result) => !result.ok);
  const partial = results.filter((result) => result.ok && result.complete === false);
  const stored = results.length - failed.length;
  const nextOffset =
    requestedSymbols.size || offset + candidates.length >= allCompanies.length
      ? null
      : offset + candidates.length;

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    totalCompanies: allCompanies.length,
    offset,
    limit: candidates.length,
    stored,
    partial,
    failed,
    nextOffset,
  };
}

async function fetchStockFinancials(symbol: string): Promise<StockFinancialsData> {
  const company = await resolveCompany(symbol);
  if (!company) {
    return {
      symbol,
      company: null,
      source: "fundamentals",
      updatedAt: new Date().toISOString(),
      tabs: {
        ...EMPTY_TABS,
        overview: {
          ...EMPTY_TABS.overview,
          status: "empty",
          message: `No fundamentals mapping was found for ${symbol}.`,
        },
      },
    };
  }

  const overview = await safeTab(() => buildOverviewTab(company), EMPTY_TABS.overview);
  const latest = await safeTab(() => buildLatestTab(company), EMPTY_TABS.latest);
  const income = await safeTab(() => buildStatementTab(company, "income"), EMPTY_TABS.income);
  const balance = await safeTab(() => buildStatementTab(company, "balance"), EMPTY_TABS.balance);
  const cashflow = await safeTab(() => buildCashflowTab(company), EMPTY_TABS.cashflow);
  const ratios = await safeTab(() => buildRatiosTab(company), EMPTY_TABS.ratios);

  return {
    symbol,
    company,
    source: "fundamentals",
    updatedAt: new Date().toISOString(),
    tabs: {
      overview,
      latest,
      income,
      balance,
      cashflow,
      ratios,
    },
  };
}

async function buildCachedStockFinancialPeerComparison(
  symbol: string,
  tabId: Exclude<StockFinancialTabId, "overview">,
  metricLabel: string
): Promise<StockFinancialPeerComparison> {
  const currentSnapshot = await readStockFinancialsSnapshot(symbol);
  const currentCompany = currentSnapshot?.value.company ?? (await resolveCompany(symbol));
  if (!currentCompany) {
    return {
      symbol,
      companyName: symbol,
      sector: "Unknown",
      tabId,
      metricLabel,
      periods: [],
      peers: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const companies = normalizeFundamentalsCompanies(await getFundamentalsCompanies());
  const readySymbols = new Set(await getReadyFundamentalsCompanySymbols(companies));
  const currentSectorId = currentCompany.sector_id ?? null;
  const currentSector = (currentCompany.sector || "").trim().toUpperCase();
  const peers = [
    {
      id: currentCompany.id,
      symbol,
      name: currentCompany.name || currentCompany.label || symbol,
      sector: currentCompany.sector || "Unknown",
      image: currentCompany.image ?? currentSnapshot?.value.company?.image ?? null,
    },
    ...companies.filter((candidate) => {
      if (candidate.symbol === symbol || !readySymbols.has(candidate.symbol)) return false;
      if (currentSectorId) return candidate.sectorId === currentSectorId;
      return candidate.sector.trim().toUpperCase() === currentSector;
    }),
  ].slice(0, 24);

  const peerRows = (
    await mapLimit(peers, 8, async (peer): Promise<StockFinancialPeerRow | null> => {
      const peerSymbol = normalizeSymbol(peer.symbol);
      if (!peerSymbol) return null;
      const snapshot = await readStockFinancialsSnapshot(peerSymbol);
      const tab = snapshot?.value.tabs[tabId];
      const row = findMetricRow(tab, metricLabel);
      if (!row) return null;

      return {
        symbol: peerSymbol,
        companyName: peer.name || peerSymbol,
        sector: peer.sector || "Unknown",
        image: peer.image ?? snapshot?.value.company?.image ?? null,
        values: row.values,
        sparkline: row.sparkline,
      };
    })
  ).filter((row): row is StockFinancialPeerRow => Boolean(row));

  return {
    symbol,
    companyName: currentCompany.name || currentCompany.label || symbol,
    sector: currentCompany.sector || "Unknown",
    tabId,
    metricLabel,
    periods: collectPeerPeriods(peerRows),
    peers: peerRows,
    updatedAt: new Date().toISOString(),
  };
}

async function resolveCompany(symbol: string): Promise<FundamentalsCompany | null> {
  const companies = await getFundamentalsCompanies();
  return (
    companies.find((company) => company.symbol?.toUpperCase() === symbol) ??
    companies.find((company) => company.label2?.toUpperCase() === symbol) ??
    null
  );
}

async function getFundamentalsCompanies(): Promise<FundamentalsCompany[]> {
  const cached = await getStaleCached({
    key: "stock-fundamentals:companies:v2",
    ttlSeconds: COMPANY_LIST_TTL_SECONDS,
    staleSeconds: COMPANY_LIST_STALE_SECONDS,
    load: () => fundamentalsFetch<FundamentalsCompany[]>("/companylistwithids"),
    isUsable: (value) => Array.isArray(value) && value.length > 0,
  });
  return cached.value;
}

function normalizeFundamentalsCompanies(
  companies: FundamentalsCompany[]
): NormalizedFundamentalsCompany[] {
  const normalized: NormalizedFundamentalsCompany[] = [];
  for (const company of companies) {
    const symbol = normalizeSymbol(company.symbol || company.label2);
    if (!symbol) continue;
    normalized.push({
      id: company.id,
      symbol,
      name: company.name || company.label || company.symbol || company.label2,
      sector: company.sector || "Unknown",
      sectorId: typeof company.sector_id === "number" ? company.sector_id : null,
      image: company.image ?? null,
    });
  }
  return normalized.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function getReadyFundamentalsCompanySymbols(
  companies: NormalizedFundamentalsCompany[]
): Promise<string[]> {
  const cached = await getStaleCached({
    key: "stock-fundamentals:companies:ready:v1",
    ttlSeconds: READY_COMPANY_LIST_TTL_SECONDS,
    staleSeconds: READY_COMPANY_LIST_STALE_SECONDS,
    load: async () => {
      const archivedSymbols = await readAllArchivedStockFinancialSymbols();
      if (archivedSymbols.length > 0) {
        const companySymbols = new Set(companies.map((company) => company.symbol));
        return archivedSymbols.filter((symbol) => companySymbols.has(symbol));
      }

      const ready = await mapLimit(companies, 12, async (company) => {
        const snapshot = await readStockFinancialsSnapshot(company.symbol);
        return snapshot?.value && hasCompleteFinancialData(snapshot.value) ? company.symbol : null;
      });
      return ready.filter((symbol): symbol is string => Boolean(symbol)).sort((a, b) => a.localeCompare(b));
    },
    isUsable: Array.isArray,
  });
  return cached.value;
}

async function storeStockFinancialsSnapshot(
  symbol: string,
  value: StockFinancialsData
): Promise<FundamentalsCacheEnvelope> {
  const now = Date.now();
  const key = `${FUNDAMENTALS_CACHE_KEY_PREFIX}${symbol}`;
  const valueWithAvailability = attachFinancialAvailability(value);
  const envelope: FundamentalsCacheEnvelope = {
    value: valueWithAvailability,
    storedAt: new Date(now).toISOString(),
    freshUntil: now + FINANCIALS_CACHE_TTL_SECONDS * 1000,
    staleUntil: now + FINANCIALS_CACHE_STALE_SECONDS * 1000,
  };

  setMemoryCache(key, envelope, FINANCIALS_CACHE_STALE_SECONDS);
  await Promise.allSettled(
    getRedisClients().map((redis) => redis.set(key, envelope, { ex: FINANCIALS_CACHE_STALE_SECONDS }))
  );
  await clearStockFinancialsIncomplete(symbol);
  return envelope;
}

async function deleteStockFinancialsSnapshot(symbol: string) {
  const key = `${FUNDAMENTALS_CACHE_KEY_PREFIX}${symbol}`;
  setMemoryCache(key, null, 1);
  await Promise.allSettled(getRedisClients().map((redis) => redis.del(key)));
}

async function readStockFinancialsSnapshot(symbol: string) {
  const key = `${FUNDAMENTALS_CACHE_KEY_PREFIX}${symbol}`;
  const memory = getMemoryCache<FundamentalsCacheEnvelope>(key);
  if (memory) return { ...memory, value: attachFinancialAvailability(memory.value) };

  for (const redis of getRedisClients()) {
    try {
      const cached = await redis.get<FundamentalsCacheEnvelope>(key);
      if (cached) return { ...cached, value: attachFinancialAvailability(cached.value) };
    } catch (error) {
      console.warn(`[fundamentals] cache read failed for ${key}:`, error);
    }
  }

  return null;
}

export async function getIncompleteStockFundamentalsQueue({
  offset = 0,
  limit = 25,
}: {
  offset?: number;
  limit?: number;
} = {}) {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const records = await readAllIncompleteStockFinancialsWithMissingCompanies();
  const window = records.slice(safeOffset, safeOffset + safeLimit);

  return {
    total: records.length,
    offset: safeOffset,
    limit: safeLimit,
    nextOffset: safeOffset + window.length >= records.length ? null : safeOffset + window.length,
    records: window,
  };
}

async function markStockFinancialsIncomplete(
  symbol: string,
  value: StockFinancialsData,
  missingTabs: StockFinancialTabId[],
  lastError?: string | null
) {
  const previous = await readIncompleteStockFinancials(symbol);
  const record = createIncompleteRecord({
    symbol,
    value,
    missingTabs,
    attempts: (previous?.attempts ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError,
  });
  const key = `${INCOMPLETE_FUNDAMENTALS_KEY_PREFIX}${symbol}`;
  setMemoryCache(key, record, FINANCIALS_CACHE_STALE_SECONDS);
  await Promise.allSettled(
    getRedisClients().map((redis) => redis.set(key, record, { ex: FINANCIALS_CACHE_STALE_SECONDS }))
  );
  return record;
}

async function clearStockFinancialsIncomplete(symbol: string) {
  const key = `${INCOMPLETE_FUNDAMENTALS_KEY_PREFIX}${symbol}`;
  setMemoryCache(key, null, 1);
  await Promise.allSettled(getRedisClients().map((redis) => redis.del(key)));
}

async function readIncompleteStockFinancials(symbol: string) {
  const key = `${INCOMPLETE_FUNDAMENTALS_KEY_PREFIX}${symbol}`;
  const memory = getMemoryCache<StockFinancialsIncompleteRecord>(key);
  if (memory) return memory;

  for (const redis of getRedisClients()) {
    try {
      const cached = await redis.get<StockFinancialsIncompleteRecord>(key);
      if (cached) return cached;
    } catch (error) {
      console.warn(`[fundamentals] incomplete queue read failed for ${key}:`, error);
    }
  }

  return null;
}

async function readAllIncompleteStockFinancialsWithMissingCompanies() {
  const records = new Map<string, StockFinancialsIncompleteRecord>();
  for (const record of await readAllIncompleteStockFinancials()) {
    records.set(record.symbol, record);
  }

  const companies = await getFundamentalsCompanies();
  await mapLimit(companies, 10, async (company) => {
    const symbol = normalizeSymbol(company.symbol || company.label2);
    if (!symbol || records.has(symbol)) return;

    const snapshot = await readStockFinancialsSnapshot(symbol);
    if (snapshot?.value && hasCompleteFinancialData(snapshot.value)) return;

    const value =
      snapshot?.value ??
      buildPreparingFinancials(
        symbol,
        company,
        null
      );
    records.set(
      symbol,
      createIncompleteRecord({
        symbol,
        value,
        missingTabs: getMissingFinancialTabs(value),
        attempts: 0,
        lastAttemptAt: null,
        lastError: snapshot?.value ? "Cached fundamentals are incomplete." : "Fundamentals are not archived yet.",
      })
    );
  });

  return sortIncompleteRecords(Array.from(records.values()));
}

async function readAllIncompleteStockFinancials() {
  const records = new Map<string, StockFinancialsIncompleteRecord>();
  for (const redis of getRedisClients()) {
    try {
      let cursor = 0;
      do {
        const scanResult = await (redis as unknown as {
          scan: (
            cursor: number,
            options: { match: string; count: number }
          ) => Promise<[number, string[]]>;
        }).scan(cursor, {
          match: `${INCOMPLETE_FUNDAMENTALS_KEY_PREFIX}*`,
          count: 100,
        });
        cursor = Number(scanResult[0]);
        for (const key of scanResult[1]) {
          const record = await redis.get<StockFinancialsIncompleteRecord>(key);
          if (record?.symbol) records.set(record.symbol, record);
        }
      } while (cursor !== 0);
    } catch (error) {
      console.warn("[fundamentals] incomplete queue scan failed:", error);
    }
  }

  return sortIncompleteRecords(Array.from(records.values()));
}

async function readAllArchivedStockFinancialSymbols() {
  const symbols = new Set<string>();
  for (const redis of getRedisClients()) {
    try {
      let cursor = 0;
      do {
        const scanResult = await (redis as unknown as {
          scan: (
            cursor: number,
            options: { match: string; count: number }
          ) => Promise<[number, string[]]>;
        }).scan(cursor, {
          match: `${FUNDAMENTALS_CACHE_KEY_PREFIX}*`,
          count: 200,
        });
        cursor = Number(scanResult[0]);
        for (const key of scanResult[1]) {
          const symbol = key.slice(FUNDAMENTALS_CACHE_KEY_PREFIX.length).trim().toUpperCase();
          if (symbol) symbols.add(symbol);
        }
      } while (cursor !== 0);
    } catch (error) {
      console.warn("[fundamentals] archived snapshot scan failed:", error);
    }
  }

  return Array.from(symbols).sort((a, b) => a.localeCompare(b));
}

function sortIncompleteRecords(records: StockFinancialsIncompleteRecord[]) {
  return records.sort((a, b) => {
    const byAttempts = a.attempts - b.attempts;
    if (byAttempts !== 0) return byAttempts;
    return a.symbol.localeCompare(b.symbol);
  });
}

function createIncompleteRecord({
  symbol,
  value,
  missingTabs,
  attempts,
  lastAttemptAt,
  lastError,
}: {
  symbol: string;
  value: StockFinancialsData;
  missingTabs: StockFinancialTabId[];
  attempts: number;
  lastAttemptAt?: string | null;
  lastError?: string | null;
}) {
  const now = new Date().toISOString();
  let record: StockFinancialsIncompleteRecord = {
    symbol,
    company: value.company,
    data: value,
    availableTabs: getAvailableFinancialTabs(value),
    missingTabs,
    attempts,
    lastAttemptAt,
    updatedAt: now,
    lastError: lastError ?? null,
  };
  record = {
    ...record,
    data: attachFinancialAvailability(value, record),
  };
  return record;
}

async function fetchStockFinancialsWithRetries(
  symbol: string,
  baseline?: StockFinancialsData
): Promise<StockFinancialsData> {
  let best: StockFinancialsData | null = baseline ?? null;

  for (let attempt = 1; attempt <= FINANCIAL_FETCH_ATTEMPTS; attempt += 1) {
    const next = await fetchStockFinancials(symbol);
    best = best ? mergeStockFinancialSnapshots(best, next) : next;
    if (hasCompleteFinancialData(best)) break;
    if (attempt < FINANCIAL_FETCH_ATTEMPTS) {
      await delay(650 * attempt);
    }
  }

  return best ?? buildPreparingFinancials(symbol);
}

function hasMeaningfulFinancialData(value: StockFinancialsData) {
  return (Object.entries(value.tabs) as Array<[StockFinancialTabId, FinancialTabData]>).some(
    ([tabId, tab]) => tabId !== "overview" && tabHasRows(tab)
  );
}

function hasCompleteFinancialData(value: StockFinancialsData) {
  return getMissingFinancialTabs(value).length === 0;
}

function getMissingFinancialTabs(value: StockFinancialsData): StockFinancialTabId[] {
  if (!value.company) return REQUIRED_FINANCIAL_TABS;
  return REQUIRED_FINANCIAL_TABS.filter((tabId) => !tabIsCachedSection(value.tabs[tabId]));
}

function getAvailableFinancialTabs(value: StockFinancialsData): StockFinancialTabId[] {
  if (!value.company) return [];
  return REQUIRED_FINANCIAL_TABS.filter((tabId) => tabIsCachedSection(value.tabs[tabId]));
}

function attachFinancialAvailability(
  value: StockFinancialsData,
  record?: StockFinancialsIncompleteRecord | null
): StockFinancialsData {
  const missingTabs = record?.missingTabs ?? getMissingFinancialTabs(value);
  const availableTabs = record?.availableTabs ?? getAvailableFinancialTabs(value);
  const availability: StockFinancialsAvailability = {
    complete: missingTabs.length === 0,
    availableTabs,
    missingTabs,
    queued: Boolean(record && missingTabs.length > 0),
    attempts: record?.attempts,
    lastAttemptAt: record?.lastAttemptAt ?? null,
    updatedAt: record?.updatedAt ?? value.updatedAt,
    message:
      missingTabs.length > 0
        ? "Some sections are still being prepared and will appear as soon as the cache completes."
        : "All required financial sections are cached.",
  };

  return {
    ...value,
    availability,
  };
}

function tabIsCachedSection(tab: FinancialTabData | undefined) {
  return tabHasUsableContent(tab);
}

function tabHasUsableContent(tab: FinancialTabData | undefined) {
  if (!tab || tab.status === "error") return false;
  return tabHasRows(tab) || Boolean(tab.highlights?.length);
}

function tabHasRows(tab: FinancialTabData | undefined) {
  return Boolean(tab?.tables.some((table) => table.rows.length > 0));
}

function mergeStockFinancialSnapshots(
  previous: StockFinancialsData,
  next: StockFinancialsData
): StockFinancialsData {
  const tabs = { ...next.tabs };
  let merged = false;

  (Object.entries(next.tabs) as Array<[StockFinancialTabId, FinancialTabData]>).forEach(
    ([tabId, tab]) => {
      const hasFreshRows = tabHasUsableContent(tab);
      const previousTab = previous.tabs[tabId];
      const hasPreviousRows = tabHasUsableContent(previousTab);
      if (!hasFreshRows && hasPreviousRows) {
        tabs[tabId] = previousTab;
        merged = true;
      }
    }
  );

  return merged ? { ...next, tabs } : next;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPreparingFinancials(
  symbol: string,
  company: FundamentalsCompany | null = null,
  record?: StockFinancialsIncompleteRecord | null
): StockFinancialsData {
  const tabs = { ...EMPTY_TABS };
  for (const tabId of Object.keys(tabs) as StockFinancialTabId[]) {
    const isAvailable = record?.availableTabs.includes(tabId);
    tabs[tabId] = {
      ...tabs[tabId],
      status: isAvailable ? "ok" : "empty",
      message: isAvailable
        ? "This section is available in the cache."
        : "Company fundamentals are preparing and will appear here shortly.",
    };
  }

  return attachFinancialAvailability(
    {
      symbol,
      company,
      source: "fundamentals",
      updatedAt: record?.updatedAt ?? new Date().toISOString(),
      tabs,
    },
    record
  );
}

async function buildOverviewTab(company: FundamentalsCompany): Promise<FinancialTabData> {
  const normalizedSymbol = normalizeSymbol(company.symbol || company.label2) ?? company.symbol ?? company.label2;
  const [
    priceResult,
    companyFinancialsResult,
    stockDataResult,
    industryAveragesResult,
    quoteResult,
    candlesResult,
  ] = await Promise.allSettled([
    fundamentalsFetch<Record<string, unknown>>(`/sharepricedatanew/${company.id}`),
    fundamentalsFetch<RawFinancialRow[]>(
      `/companyfinancialnew/${company.id}?companyfinancial=true&&test=true`
    ),
    fundamentalsFetch<RawFinancialSection[]>(`/stockpricedatanew/${company.id}`),
    fundamentalsFetch<Array<{ label?: string; unit?: string; value?: string | number | null }>>(
      `/industrynew/${company.id}`
    ),
    getQuote(normalizedSymbol),
    getEodCandlesCached(normalizedSymbol),
  ]);

  const price = fulfilledOr(priceResult, {});
  const companyFinancials = fulfilledOr(companyFinancialsResult, []);
  const stockData = fulfilledOr(stockDataResult, []);
  const industryAverages = fulfilledOr(industryAveragesResult, []);
  const tables: FinancialTable[] = [
    normalizeFlatRows("Company financials", companyFinancials),
    normalizeSectionedRows("Stock data", stockData),
    {
      title: "Industry averages",
      years: ["Latest"],
      rows: industryAverages.map((row) => ({
        label: row.label ?? "Metric",
        unit: row.unit ?? null,
        values: { Latest: row.value ?? null },
        sparkline: [],
      })),
    },
  ].filter((table) => table.rows.length > 0);

  const snapshot: StockFinancialsData = {
    symbol: normalizedSymbol,
    company,
    source: "fundamentals",
    updatedAt: new Date().toISOString(),
    tabs: {
      ...EMPTY_TABS,
      overview: {
        title: "Overview",
        description: "Trading, valuation and historical financial snapshots.",
        status: tables.length ? "ok" : "empty",
        tables,
      },
    },
  };
  const highlights = buildOverviewHighlights(snapshot, {
    price,
    quote: fulfilledOr<Quote | null>(quoteResult, null),
    candles: fulfilledOr<Candle[]>(candlesResult, []),
  });

  return {
    title: "Overview",
    description: "Trading, valuation and historical financial snapshots.",
    status: tables.length || highlights.length ? "ok" : "empty",
    highlights,
    tables,
  };
}

async function buildLatestTab(company: FundamentalsCompany): Promise<FinancialTabData> {
  const rows = await fundamentalsFetch<RawFinancialRow[]>(`/result/${company.id}`);
  const table = normalizeFlatRows("Latest result - P&L summary", rows);
  return {
    title: "Latest results",
    description: "Latest quarterly and year-to-date P&L summary.",
    status: table.rows.length ? "ok" : "empty",
    tables: table.rows.length ? [table] : [],
  };
}

async function buildStatementTab(
  company: FundamentalsCompany,
  kind: "income" | "balance"
): Promise<FinancialTabData> {
  const endpoint = kind === "income" ? "iss" : "bss";
  const meta = await fundamentalsFetch<StatementDatesResponse>(`/${endpoint}/${company.id}`);
  const annualDates = (meta.dates?.annual ?? []).slice().sort((a, b) =>
    a.start_date.localeCompare(b.start_date)
  );

  if (annualDates.length === 0) {
    return {
      ...EMPTY_TABS[kind],
      status: "empty",
      message: "No annual financial history is available yet.",
    };
  }

  const first = annualDates[0];
  const last = annualDates[annualDates.length - 1];
  const rows = await fundamentalsFetch<RawFinancialRow[] | RawFinancialSection[]>(
    `/${endpoint}/${company.id}`,
    {
      method: "POST",
      body: JSON.stringify({
        company,
        sdate: first.start_date,
        edate: last.value,
        period: "annual",
      }),
    }
  );

  const table =
    kind === "income"
      ? normalizeFlatRows("Income statement - PKR (mn)", rows as RawFinancialRow[])
      : normalizeSectionedRows("Balance sheet - PKR (mn)", rows as RawFinancialSection[]);

  return {
    title: kind === "income" ? "Income statement" : "Balance sheet",
    description:
      kind === "income"
        ? "Annual revenue, profit, margins and EPS history."
        : "Annual assets, liabilities and equity history.",
    status: table.rows.length ? "ok" : "empty",
    tables: table.rows.length ? [table] : [],
  };
}

async function buildCashflowTab(company: FundamentalsCompany): Promise<FinancialTabData> {
  const data = await fundamentalsFetch<Record<string, RawFinancialRow[]>>(`/cf/${company.id}`);
  const indirect = normalizeFlatRows("Cash flow statement - PKR (mn)", data.indirect ?? []);
  const direct = normalizeFlatRows("Cash flow statement - direct method", data.direct ?? []);
  const tables = [indirect, direct].filter((table) => table.rows.length > 0);
  return {
    title: "Cash flow",
    description: "Annual operating cash flow, capex and free cash flow history.",
    status: tables.length ? "ok" : "empty",
    tables,
  };
}

async function buildRatiosTab(company: FundamentalsCompany): Promise<FinancialTabData> {
  const sections = await fundamentalsFetch<RawFinancialSection[]>(`/rationew/${company.id}`);
  const table = normalizeSectionedRows("Ratios", sections);
  return {
    title: "Ratios",
    description: "Valuation, margins, returns, health, activity and growth metrics.",
    status: table.rows.length ? "ok" : "empty",
    tables: table.rows.length ? [table] : [],
  };
}

async function safeTab(
  load: () => Promise<FinancialTabData>,
  fallback: FinancialTabData
): Promise<FinancialTabData> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FINANCIAL_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const tab = await load();
      if (tabHasUsableContent(tab) || attempt === FINANCIAL_FETCH_ATTEMPTS) return tab;
    } catch (error) {
      lastError = error;
      if (attempt < FINANCIAL_FETCH_ATTEMPTS) await delay(450 * attempt);
    }
  }

  console.warn("[fundamentals] tab fetch failed:", lastError);
  return {
    ...fallback,
    status: "error",
    message:
      "Fundamental data could not be refreshed right now. Cached data will be used when available.",
  };
}

function fulfilledOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

function normalizeFlatRows(
  title: string,
  rows: RawFinancialRow[] = [],
  options: { maxYears?: number } = {}
): FinancialTable {
  const normalized = rows
    .filter((row) => row?.label && Array.isArray(row.data))
    .map((row) => normalizeRow(row));
  const years = collectYears(normalized);
  return {
    title,
    years: options.maxYears ? years.slice(-options.maxYears) : years,
    rows: normalized,
  };
}

function normalizeSectionedRows(
  title: string,
  sections: RawFinancialSection[] = []
): FinancialTable {
  const rows: FinancialTableRow[] = [];

  for (const section of sections) {
    const sectionLabel = section.section ?? section.label;
    if (sectionLabel) {
      rows.push({
        label: sectionLabel,
        isSection: true,
        isBold: true,
        values: {},
        sparkline: [],
      });
    }
    for (const row of section.data ?? []) {
      if (row?.label && Array.isArray(row.data)) {
        rows.push({ ...normalizeRow(row), section: sectionLabel ?? null });
      }
    }
  }

  return {
    title,
    years: collectYears(rows),
    rows,
  };
}

function normalizeRow(row: RawFinancialRow): FinancialTableRow {
  const values: FinancialTableRow["values"] = {};
  const sparkline: number[] = [];

  for (const point of row.data ?? []) {
    const period = String(point.label ?? point.year ?? "");
    if (!period) continue;
    values[period] = point.value ?? null;
    const numeric = toNumber(point.value);
    if (Number.isFinite(numeric)) sparkline.push(numeric);
  }

  return {
    label: row.label ?? "Metric",
    unit: row.unit ?? null,
    isBold: row.bold === 1 || row.bold === "1" || row.bold === true,
    values,
    sparkline,
  };
}

function collectYears(rows: FinancialTableRow[]) {
  const years: string[] = [];
  for (const row of rows) {
    for (const year of Object.keys(row.values)) {
      if (!years.includes(year)) years.push(year);
    }
  }
  return years;
}

async function enrichOverviewSnapshot(value: StockFinancialsData): Promise<StockFinancialsData> {
  const symbol = normalizeSymbol(value.symbol);
  if (!symbol) return value;

  const [quoteResult, candlesResult] = await Promise.allSettled([
    getQuote(symbol),
    getEodCandlesCached(symbol),
  ]);
  const highlights = buildOverviewHighlights(value, {
    price: {},
    quote: fulfilledOr<Quote | null>(quoteResult, null),
    candles: fulfilledOr<Candle[]>(candlesResult, []),
  });

  if (highlights.length === 0) return value;

  return {
    ...value,
    tabs: {
      ...value.tabs,
      overview: {
        ...value.tabs.overview,
        status:
          value.tabs.overview.tables.length || highlights.length ? "ok" : value.tabs.overview.status,
        highlights,
      },
    },
  };
}

function buildOverviewHighlights(
  value: StockFinancialsData,
  context: {
    price: Record<string, unknown>;
    quote: Quote | null;
    candles: Candle[];
  }
): FinancialMetric[] {
  const { price, quote, candles } = context;
  const currentPrice = firstFinite(
    quote?.price ?? null,
    toNumber(price.current),
    toNumber(price.close),
    deriveCurrentPrice(value)
  );
  const previousClose = firstFinite(
    quote?.ldcp ?? null,
    candles.length > 1 ? candles[candles.length - 2]?.close ?? null : null
  );
  const change = firstFinite(
    quote?.change ?? null,
    toNumber(price.change),
    currentPrice != null && previousClose != null ? currentPrice - previousClose : null
  );
  const changePct = firstFinite(
    quote?.changePct ?? null,
    toNumber(price.change_in_percentage),
    change != null && previousClose != null && previousClose !== 0
      ? (change / previousClose) * 100
      : null
  );
  const dayLow = firstFinite(quote?.low ?? null, toNumber(price.low));
  const dayHigh = firstFinite(quote?.high ?? null, toNumber(price.high));
  const volume = firstFinite(quote?.volume ?? null, toNumber(price.volume));
  const marketCapMn = deriveMarketCapMn(value, currentPrice);
  const pe = derivePe(value, currentPrice, toNumber(price.pe));
  const pbv = derivePbv(value, currentPrice, toNumber(price.pbv));
  const dividendYield = deriveDividendYield(value, currentPrice, toNumber(price.dividend_yield));
  const trailingYear = candles.slice(-252);
  const week52High = firstFinite(
    trailingYear.length ? Math.max(...trailingYear.map((candle) => candle.high)) : null,
    currentPrice,
    toNumber(price.fifty_two_week_high)
  );
  const week52Low = firstFinite(
    trailingYear.length ? Math.min(...trailingYear.map((candle) => candle.low)) : null,
    currentPrice,
    toNumber(price.fifty_two_week_low)
  );

  return [
    metric("Current price", formatPrice(currentPrice)),
    metric("Change", formatChange(change, changePct), change ?? undefined),
    metric("Day range", formatDayRange(dayLow, dayHigh)),
    metric("Volume", volume == null ? "—" : formatCompact(volume)),
    metric("Market cap", formatMarketCapCrore(marketCapMn)),
    metric("PE", formatMultiple(pe)),
    metric("PBV", formatMultiple(pbv)),
    metric("Dividend yield", dividendYield == null ? "—" : `${formatNumber(dividendYield, 2)}%`),
    metric("52W high", formatPrice(week52High)),
    metric("52W low", formatPrice(week52Low)),
  ];
}

function deriveCurrentPrice(value: StockFinancialsData) {
  const per = findLatestMetric(value, [/^per$/i, /^per \(x\)$/i, /^p\/e/i], ["ratios", "overview"]);
  const eps = findLatestMetric(value, [/^eps$/i, /^eps - basic$/i], ["ratios", "income", "latest"]);
  const pbv = findLatestMetric(value, [/^pbv$/i, /^p\/b/i], ["ratios", "overview"]);
  const bvps = findLatestMetric(value, [/^bvps$/i, /book value/i], ["ratios", "overview", "latest"]);

  return firstFinite(
    per != null && eps != null ? per * eps : null,
    pbv != null && bvps != null ? pbv * bvps : null
  );
}

function deriveMarketCapMn(value: StockFinancialsData, currentPrice: number | null) {
  const totalSharesMn = findLatestMetric(
    value,
    [/^total shares$/i, /^outstanding shares$/i, /outstanding shares - adjusted/i],
    ["overview"]
  );
  const cash = findLatestMetric(value, [/^cash & bank balances$/i], ["balance"]);
  const cashAsPctMktCap = findLatestMetric(value, [/^cash as a % mkt cap$/i], ["ratios"]);

  return firstFinite(
    currentPrice != null && totalSharesMn != null ? currentPrice * totalSharesMn : null,
    cash != null && cashAsPctMktCap != null && cashAsPctMktCap > 0
      ? cash / (cashAsPctMktCap / 100)
      : null
  );
}

function derivePe(value: StockFinancialsData, currentPrice: number | null, directPe: number) {
  const eps = findLatestMetric(value, [/^eps$/i, /^eps - basic$/i], ["ratios", "income", "latest"]);
  return firstFinite(
    currentPrice != null && eps != null && eps !== 0 ? currentPrice / eps : null,
    directPe,
    findLatestMetric(value, [/^per$/i, /^per \(x\)$/i, /^p\/e/i], ["ratios", "overview"])
  );
}

function derivePbv(value: StockFinancialsData, currentPrice: number | null, directPbv: number) {
  const bvps = findLatestMetric(value, [/^bvps$/i, /book value/i], ["ratios", "overview", "latest"]);
  return firstFinite(
    currentPrice != null && bvps != null && bvps !== 0 ? currentPrice / bvps : null,
    directPbv,
    findLatestMetric(value, [/^pbv$/i, /^p\/b/i], ["ratios", "overview"])
  );
}

function deriveDividendYield(
  value: StockFinancialsData,
  currentPrice: number | null,
  directDividendYield: number
) {
  const dps = findLatestMetric(value, [/^dps$/i, /dividend per share/i], ["ratios", "latest"]);
  return firstFinite(
    currentPrice != null && dps != null && currentPrice > 0 ? (dps / currentPrice) * 100 : null,
    directDividendYield,
    findLatestMetric(value, [/^div yield$/i, /dividend yield/i], ["ratios", "overview"])
  );
}

function findLatestMetric(
  value: StockFinancialsData,
  patterns: RegExp[],
  tabs: StockFinancialTabId[]
) {
  for (const tabId of tabs) {
    const tab = value.tabs[tabId];
    for (const table of tab?.tables ?? []) {
      for (const row of table.rows) {
        if (row.isSection) continue;
        if (!patterns.some((pattern) => pattern.test(row.label))) continue;
        const latest = latestNumericValue(row);
        if (latest != null) return latest;
      }
    }
  }
  return null;
}

function latestNumericValue(row: FinancialTableRow) {
  const entries = Object.entries(row.values).sort((left, right) =>
    compareFinancialPeriods(left[0], right[0])
  );
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const numeric = toNumber(entries[index][1]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function firstFinite(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (value != null && Number.isFinite(value)) return value;
  }
  return null;
}

function formatPrice(value: number | null) {
  return value == null ? "—" : formatMarketPrice(value, "Rs");
}

function formatChange(change: number | null, changePct: number | null) {
  if (change == null && changePct == null) return "—";
  if (change == null) return formatPercent(changePct);
  const move = formatPKR(change, { sign: true });
  if (changePct == null) return move;
  return `${move} (${formatPercent(changePct)})`;
}

function formatDayRange(low: number | null, high: number | null) {
  if (low == null && high == null) return "—";
  if (low == null) return formatPrice(high);
  if (high == null) return formatPrice(low);
  return `${formatPrice(low)} - ${formatPrice(high)}`;
}

function formatMultiple(value: number | null) {
  return value == null ? "—" : `${formatNumber(value, 2)}x`;
}

function formatMarketCapCrore(valueMn: number | null) {
  return valueMn == null ? "—" : `Rs ${formatNumber(valueMn / 10, 2)} Cr`;
}

function findMetricRow(
  tab: FinancialTabData | undefined,
  metricLabel: string
): FinancialTableRow | null {
  const target = normalizeMetricLabel(metricLabel);
  for (const table of tab?.tables ?? []) {
    for (const row of table.rows) {
      if (!row.isSection && normalizeMetricLabel(row.label) === target) return row;
    }
  }
  return null;
}

function collectPeerPeriods(rows: StockFinancialPeerRow[]) {
  const periods: string[] = [];
  for (const row of rows) {
    for (const period of Object.keys(row.values)) {
      if (!periods.includes(period)) periods.push(period);
    }
  }
  return periods.sort(compareFinancialPeriods);
}

function compareFinancialPeriods(a: string, b: string) {
  return periodSortValue(a) - periodSortValue(b);
}

function periodSortValue(period: string) {
  const year = Number(period);
  if (Number.isFinite(year)) return year * 10;
  const quarterMatch = period.match(/(\d)QFY(\d{2})/i);
  if (quarterMatch) return (2000 + Number(quarterMatch[2])) * 10 + Number(quarterMatch[1]);
  const yearMatch = period.match(/(\d{4})/);
  if (yearMatch) return Number(yearMatch[1]) * 10;
  return Number.MAX_SAFE_INTEGER;
}

function normalizeMetricLabel(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function metric(label: string, value: string, signedValue?: number): FinancialMetric {
  return {
    label,
    value,
    tone:
      signedValue === undefined
        ? "neutral"
        : signedValue > 0
          ? "positive"
          : signedValue < 0
            ? "negative"
            : "neutral",
  };
}

async function fundamentalsFetch<T>(path: string, init: FetchInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const { headers: initHeaders, ...rest } = init;
  const body = init.body ?? undefined;
  const headers = new Headers(initHeaders);
  headers.set("accept", headers.get("accept") ?? "application/json");
  headers.set("content-type", headers.get("content-type") ?? "application/json");
  headers.set("user-agent", headers.get("user-agent") ?? "Stockli/1.0 (+https://mystockli.vercel.app)");

  try {
    const response = await fetch(`${FUNDAMENTALS_BASE}${path}`, {
      ...rest,
      body,
      signal: controller.signal,
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Fundamentals ${path} failed with ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.replace(/[(),]/g, "").trim();
  if (!normalized) return Number.NaN;
  const parsed = Number(normalized);
  return value.includes("(") ? -parsed : parsed;
}

function emptyTab(title: string, description: string): FinancialTabData {
  return {
    title,
    description,
    status: "empty",
    tables: [],
  };
}
