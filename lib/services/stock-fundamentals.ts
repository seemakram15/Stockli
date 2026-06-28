import "server-only";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { getRedisClients } from "@/lib/cache/redis";
import { getStaleCached } from "@/lib/cache/stale";
import { config } from "@/lib/config";
import { normalizeSymbol } from "@/lib/security/validation";
import type {
  FundamentalsCompany,
  FinancialMetric,
  FinancialTabData,
  FinancialTable,
  FinancialTableRow,
  StockFinancialPeerComparison,
  StockFinancialPeerRow,
  StockFinancialsData,
  StockFinancialTabId,
} from "@/lib/types/stock-fundamentals";

const FUNDAMENTALS_BASE = config.fundamentals.baseUrl.replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 25_000;
const FINANCIALS_CACHE_TTL_SECONDS = 6 * 60 * 60;
const FINANCIALS_CACHE_STALE_SECONDS = 5 * 365 * 24 * 60 * 60;
const COMPANY_LIST_TTL_SECONDS = 7 * 24 * 60 * 60;
const COMPANY_LIST_STALE_SECONDS = 365 * 24 * 60 * 60;
const ARCHIVE_BATCH_SIZE = 3;

type FundamentalsCacheEnvelope = {
  value: StockFinancialsData;
  storedAt: string;
  freshUntil: number;
  staleUntil: number;
};

type CacheStatus = "fresh" | "stale" | "miss";

export type StockFinancialsCacheResult = {
  value: StockFinancialsData;
  status: CacheStatus;
  storedAt: string;
};

export type StockFinancialsRefreshResult = {
  value: StockFinancialsData;
  storedAt: string;
  usedFallback: boolean;
  hadMeaningfulFreshData: boolean;
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
    return {
      value: cached.value,
      status: Date.now() < cached.freshUntil ? "fresh" : "stale",
      storedAt: cached.storedAt,
    } satisfies StockFinancialsCacheResult;
  }

  return {
    value: buildPreparingFinancials(symbol),
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
  const value = await fetchStockFinancials(symbol);
  const hasMeaningfulFreshData = hasMeaningfulFinancialData(value);

  if (previous?.value && !hasMeaningfulFreshData) {
    const envelope = await storeStockFinancialsSnapshot(symbol, previous.value);
    return {
      value: previous.value,
      storedAt: envelope.storedAt,
      usedFallback: true,
      hadMeaningfulFreshData: false,
    };
  }

  const nextValue = previous?.value ? mergeStockFinancialSnapshots(previous.value, value) : value;
  const envelope = await storeStockFinancialsSnapshot(symbol, nextValue);
  return {
    value: nextValue,
    storedAt: envelope.storedAt,
    usedFallback: false,
    hadMeaningfulFreshData: hasMeaningfulFreshData,
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

  const value = await buildCachedStockFinancialPeerComparison(symbol, tabId, metric);
  return {
    value,
    status: "fresh",
    storedAt: value.updatedAt,
  } satisfies { value: StockFinancialPeerComparison; status: CacheStatus; storedAt: string };
}

export async function getStockFundamentalsCompanies() {
  const companies = await getFundamentalsCompanies();
  return companies
    .map((company) => ({
      id: company.id,
      symbol: normalizeSymbol(company.symbol || company.label2),
      name: company.name || company.label || company.symbol || company.label2,
      sector: company.sector || "Unknown",
      image: company.image ?? null,
    }))
    .filter(
      (
        company
      ): company is {
        id: number;
        symbol: string;
        name: string;
        sector: string;
        image: string | null;
      } => Boolean(company.symbol)
    )
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function getArchivedStockFinancialsBatch({
  offset = 0,
  limit = 25,
}: {
  offset?: number;
  limit?: number;
} = {}) {
  const companies = await getStockFundamentalsCompanies();
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.min(Math.max(1, limit), 50);
  const window = companies.slice(safeOffset, safeOffset + safeLimit);
  const records = (
    await Promise.all(
      window.map(async (company) => {
        const snapshot = await readStockFinancialsSnapshot(company.symbol);
        if (!snapshot?.value) return null;
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
      const data = await fetchStockFinancials(symbol);
      const hasMeaningfulFreshData = hasMeaningfulFinancialData(data);

      if (previous?.value && !hasMeaningfulFreshData) {
        await storeStockFinancialsSnapshot(symbol, previous.value);
        return { symbol, ok: true, preserved: true };
      }

      const nextValue = previous?.value ? mergeStockFinancialSnapshots(previous.value, data) : data;
      await storeStockFinancialsSnapshot(symbol, nextValue);
      return { symbol, ok: true, preserved: false };
    } catch (error) {
      return {
        symbol,
        ok: false,
        error: error instanceof Error ? error.message : "Archive failed",
      };
    }
  });

  const failed = results.filter((result) => !result.ok);
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

  const [overview, latest, income, balance, cashflow, ratios] = await Promise.all([
    safeTab(() => buildOverviewTab(company), EMPTY_TABS.overview),
    safeTab(() => buildLatestTab(company), EMPTY_TABS.latest),
    safeTab(() => buildStatementTab(company, "income"), EMPTY_TABS.income),
    safeTab(() => buildStatementTab(company, "balance"), EMPTY_TABS.balance),
    safeTab(() => buildCashflowTab(company), EMPTY_TABS.cashflow),
    safeTab(() => buildRatiosTab(company), EMPTY_TABS.ratios),
  ]);

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

  const companies = await getFundamentalsCompanies();
  const sectorCompanies = companies
    .filter((candidate) =>
      currentCompany.sector_id
        ? candidate.sector_id === currentCompany.sector_id
        : candidate.sector?.toUpperCase() === currentCompany.sector?.toUpperCase()
    );
  const peers = [
    currentCompany,
    ...sectorCompanies.filter((candidate) => candidate.id !== currentCompany.id),
  ].slice(0, 24);

  const peerRows = (
    await mapLimit(peers, 8, async (peer): Promise<StockFinancialPeerRow | null> => {
      const peerSymbol = normalizeSymbol(peer.symbol || peer.label2);
      if (!peerSymbol) return null;
      const snapshot = await readStockFinancialsSnapshot(peerSymbol);
      const tab = snapshot?.value.tabs[tabId];
      const row = findMetricRow(tab, metricLabel);
      if (!row) return null;

      return {
        symbol: peerSymbol,
        companyName: peer.name || peer.label || peerSymbol,
        sector: peer.sector || currentCompany.sector || "Unknown",
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

async function storeStockFinancialsSnapshot(
  symbol: string,
  value: StockFinancialsData
): Promise<FundamentalsCacheEnvelope> {
  const now = Date.now();
  const key = `stock-fundamentals:v4:${symbol}`;
  const envelope: FundamentalsCacheEnvelope = {
    value,
    storedAt: new Date(now).toISOString(),
    freshUntil: now + FINANCIALS_CACHE_TTL_SECONDS * 1000,
    staleUntil: now + FINANCIALS_CACHE_STALE_SECONDS * 1000,
  };

  setMemoryCache(key, envelope, FINANCIALS_CACHE_STALE_SECONDS);
  await Promise.allSettled(
    getRedisClients().map((redis) => redis.set(key, envelope, { ex: FINANCIALS_CACHE_STALE_SECONDS }))
  );
  return envelope;
}

async function readStockFinancialsSnapshot(symbol: string) {
  const key = `stock-fundamentals:v4:${symbol}`;
  const memory = getMemoryCache<FundamentalsCacheEnvelope>(key);
  if (memory) return memory;

  for (const redis of getRedisClients()) {
    try {
      const cached = await redis.get<FundamentalsCacheEnvelope>(key);
      if (cached) return cached;
    } catch (error) {
      console.warn(`[fundamentals] cache read failed for ${key}:`, error);
    }
  }

  return null;
}

function hasMeaningfulFinancialData(value: StockFinancialsData) {
  return (Object.entries(value.tabs) as Array<[StockFinancialTabId, FinancialTabData]>).some(
    ([tabId, tab]) => tabId !== "overview" && tab.tables.some((table) => table.rows.length > 0)
  );
}

function mergeStockFinancialSnapshots(
  previous: StockFinancialsData,
  next: StockFinancialsData
): StockFinancialsData {
  const tabs = { ...next.tabs };
  let merged = false;

  (Object.entries(next.tabs) as Array<[StockFinancialTabId, FinancialTabData]>).forEach(
    ([tabId, tab]) => {
      if (tabId === "overview") return;
      const hasFreshRows = tab.tables.some((table) => table.rows.length > 0);
      const previousTab = previous.tabs[tabId];
      const hasPreviousRows = previousTab.tables.some((table) => table.rows.length > 0);
      if (!hasFreshRows && hasPreviousRows) {
        tabs[tabId] = previousTab;
        merged = true;
      }
    }
  );

  return merged ? { ...next, tabs } : next;
}

function buildPreparingFinancials(symbol: string): StockFinancialsData {
  const tabs = { ...EMPTY_TABS };
  for (const tabId of Object.keys(tabs) as StockFinancialTabId[]) {
    tabs[tabId] = {
      ...tabs[tabId],
      status: "empty",
      message: "Company fundamentals are preparing and will appear here shortly.",
    };
  }

  return {
    symbol,
    company: null,
    source: "fundamentals",
    updatedAt: new Date().toISOString(),
    tabs,
  };
}

async function buildOverviewTab(company: FundamentalsCompany): Promise<FinancialTabData> {
  const [priceResult, companyFinancialsResult, stockDataResult, industryAveragesResult] =
    await Promise.allSettled([
      fundamentalsFetch<Record<string, unknown>>(`/sharepricedatanew/${company.id}`),
      fundamentalsFetch<RawFinancialRow[]>(
        `/companyfinancialnew/${company.id}?companyfinancial=true&&test=true`
      ),
      fundamentalsFetch<RawFinancialSection[]>(`/stockpricedatanew/${company.id}`),
      fundamentalsFetch<Array<{ label?: string; unit?: string; value?: string | number | null }>>(
        `/industrynew/${company.id}`
      ),
    ]);

  const price = fulfilledOr(priceResult, {});
  const companyFinancials = fulfilledOr(companyFinancialsResult, []);
  const stockData = fulfilledOr(stockDataResult, []);
  const industryAverages = fulfilledOr(industryAveragesResult, []);

  const highlights = buildOverviewHighlights(price);
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
  try {
    return await load();
  } catch (error) {
    console.warn("[fundamentals] tab fetch failed:", error);
    return {
      ...fallback,
      status: "error",
      message:
        "Fundamental data could not be refreshed right now. Cached data will be used when available.",
    };
  }
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

function buildOverviewHighlights(price: Record<string, unknown>): FinancialMetric[] {
  const change = toNumber(price.change);
  const changePct = valueToString(price.change_in_percentage);
  return [
    metric("Current price", valueToString(price.current, "—")),
    metric("Change", `${valueToString(price.change, "—")} (${changePct}%)`, change),
    metric("Day range", `${valueToString(price.low, "—")} - ${valueToString(price.high, "—")}`),
    metric("Volume", valueToString(price.volume, "—")),
    metric("Market cap", valueToString(price.market_cap, "—")),
    metric("PE", valueToString(price.pe, "—")),
    metric("PBV", valueToString(price.pbv, "—")),
    metric("Dividend yield", `${valueToString(price.dividend_yield, "—")}%`),
    metric("52W high", valueToString(price.fifty_two_week_high, "—")),
    metric("52W low", valueToString(price.fifty_two_week_low, "—")),
  ];
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

function valueToString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function emptyTab(title: string, description: string): FinancialTabData {
  return {
    title,
    description,
    status: "empty",
    tables: [],
  };
}
