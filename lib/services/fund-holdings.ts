import "server-only";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/auth/roles";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";
import type {
  FundPeriodStatus,
  FundHolding,
  SaveHoldingInput,
} from "@/lib/types/fund-holdings";

export type { FundPeriodStatus, FundHolding, SaveHoldingInput };

async function assertSuperadmin() {
  if (!(await isSuperadmin())) throw new Error("Forbidden");
}

/** Public readers must soft-fail in demo mode (no Supabase) instead of hard-crashing. */
function publicAdminClient() {
  if (!isSupabaseAdminConfigured) return null;
  try {
    return createAdminClient();
  } catch (error) {
    console.warn("[fund-holdings] admin client unavailable:", error);
    return null;
  }
}

function normFundName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type ProductionBreakdownHolding = {
  symbol: string | null;
  stockName: string;
  percentage: number;
};

type ProductionBreakdownFund = {
  fundName: string;
  amc?: string;
  holdings: ProductionBreakdownHolding[];
};

type ProductionFundsBreakdown = {
  periodYear: number;
  periodMonth: number;
  funds: ProductionBreakdownFund[];
};

type PublishedHoldingsGroup = {
  fundName: string;
  amc: string;
  holdings: FundHolding[];
};

/** Local demo / no service-role: reuse the same public snapshot funds-breakdown already uses. */
async function fetchProductionFundsBreakdown(): Promise<ProductionFundsBreakdown | null> {
  return fetchProductionPublicData<ProductionFundsBreakdown>({
    path: "/api/public/funds-breakdown",
    refererPath: "/market/funds-breakdown",
    isUsable: (data) => Boolean(data?.funds?.length),
    label: "fund-holdings",
  });
}

function mapProductionHoldings(
  holdings: ProductionBreakdownHolding[]
): FundHolding[] {
  return holdings.map((h, index) => ({
    id: index + 1,
    symbol: h.symbol,
    stockName: h.stockName,
    percentage: Number(h.percentage),
    rank: index + 1,
    status: "published" as const,
  }));
}

function mapProductionHoldingsGroups(
  remote: ProductionFundsBreakdown
): PublishedHoldingsGroup[] {
  return remote.funds.map((f) => ({
    fundName: f.fundName,
    amc: f.amc?.trim() || "Unknown",
    holdings: mapProductionHoldings(f.holdings ?? []),
  }));
}

async function getProductionPublishedHoldingsAll(): Promise<{
  year: number;
  month: number;
  funds: PublishedHoldingsGroup[];
} | null> {
  const remote = await fetchProductionFundsBreakdown();
  if (!remote?.funds?.length) return null;
  return {
    year: remote.periodYear,
    month: remote.periodMonth,
    funds: mapProductionHoldingsGroups(remote),
  };
}

async function getProductionHoldingsForFund(fundName: string): Promise<{
  year: number;
  month: number;
  holdings: FundHolding[];
} | null> {
  const remote = await fetchProductionFundsBreakdown();
  if (!remote) return null;
  const target = normFundName(fundName);
  const fund = remote.funds.find((f) => normFundName(f.fundName) === target);
  if (!fund?.holdings?.length) return null;
  return {
    year: remote.periodYear,
    month: remote.periodMonth,
    holdings: mapProductionHoldings(fund.holdings),
  };
}

/** When exact fund_name misses, resolve via normalized match against the latest published period. */
async function resolvePublishedFundName(fundName: string): Promise<string | null> {
  const target = normFundName(fundName);
  if (!target) return null;
  try {
    const period = await getLatestPublishedPeriod();
    if (!period) return null;
    const funds = await getPublishedHoldingsForPeriod(period.year, period.month);
    return funds.find((f) => normFundName(f.fundName) === target)?.fundName ?? null;
  } catch (error) {
    console.warn("[fund-holdings] resolvePublishedFundName failed:", error);
    return null;
  }
}

/** Which year+month periods have holdings for a fund. */
export async function getFundPeriods(fundName: string): Promise<FundPeriodStatus[]> {
  await assertSuperadmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("mutual_fund_holdings")
    .select("report_year, report_month, status")
    .eq("fund_name", fundName)
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false });
  if (error) throw error;
  // Deduplicate: one entry per (year, month) — take the first status seen
  const seen = new Map<string, FundPeriodStatus>();
  for (const row of data ?? []) {
    const key = `${row.report_year}-${row.report_month}`;
    if (!seen.has(key)) {
      seen.set(key, {
        year: row.report_year,
        month: row.report_month,
        status: row.status as "draft" | "published",
      });
    }
  }
  return [...seen.values()];
}

/** Load holdings for a specific fund/period. */
export async function getPeriodHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<FundHolding[]> {
  await assertSuperadmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("mutual_fund_holdings")
    .select("id, symbol, stock_name, percentage, rank, status")
    .eq("fund_name", fundName)
    .eq("report_year", year)
    .eq("report_month", month)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("percentage", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    symbol: r.symbol,
    stockName: r.stock_name,
    percentage: Number(r.percentage),
    rank: r.rank,
    status: r.status as "draft" | "published",
  }));
}


/** Upsert all holdings for a period (replaces entire period atomically). */
export async function savePeriodHoldings(
  fundName: string,
  amc: string,
  year: number,
  month: number,
  holdings: SaveHoldingInput[],
  status: "draft" | "published",
  createdBy: string
): Promise<void> {
  await assertSuperadmin();
  const db = createAdminClient();

  // Delete existing rows for this period first
  const { error: delError } = await db
    .from("mutual_fund_holdings")
    .delete()
    .eq("fund_name", fundName)
    .eq("report_year", year)
    .eq("report_month", month);
  if (delError) throw delError;

  if (holdings.length === 0) return;

  // Preserve admin-defined order; rank = position in array
  const rows = holdings.map((h, i) => ({
    fund_name: fundName,
    amc,
    report_month: month,
    report_year: year,
    symbol: h.symbol ?? null,
    stock_name: h.stockName,
    percentage: h.percentage,
    rank: i + 1,
    status,
    source: "manual" as const,
    created_by: createdBy,
    updated_at: new Date().toISOString(),
  }));

  const { error: insError } = await db
    .from("mutual_fund_holdings")
    .insert(rows);
  if (insError) throw insError;
}

/** Delete all holdings for a period. */
export async function deletePeriodHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<void> {
  await assertSuperadmin();
  const db = createAdminClient();
  const { error } = await db
    .from("mutual_fund_holdings")
    .delete()
    .eq("fund_name", fundName)
    .eq("report_year", year)
    .eq("report_month", month);
  if (error) throw error;
}

/** Load all published holdings for an AMC/year/month (admin overview). */
export async function getAllPublishedHoldings(opts: {
  amc?: string;
  year?: number;
  month?: number;
}): Promise<
  {
    amc: string;
    fundName: string;
    year: number;
    month: number;
    holdings: FundHolding[];
  }[]
> {
  await assertSuperadmin();
  const db = createAdminClient();
  let q = db
    .from("mutual_fund_holdings")
    .select("id, amc, fund_name, report_year, report_month, symbol, stock_name, percentage, rank, status")
    .eq("status", "published")
    .order("amc")
    .order("fund_name")
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false })
    .order("rank", { ascending: true, nullsFirst: false });

  if (opts.amc) q = q.eq("amc", opts.amc);
  if (opts.year) q = q.eq("report_year", opts.year);
  if (opts.month) q = q.eq("report_month", opts.month);

  const { data, error } = await q;
  if (error) throw error;

  // Group by amc + fund_name + year + month
  const map = new Map<string, (typeof rows)[0]>();
  type Row = { amc: string; fundName: string; year: number; month: number; holdings: FundHolding[] };
  const rows: Row[] = [];

  for (const r of data ?? []) {
    const key = `${r.amc}||${r.fund_name}||${r.report_year}||${r.report_month}`;
    if (!map.has(key)) {
      const entry: Row = { amc: r.amc, fundName: r.fund_name, year: r.report_year, month: r.report_month, holdings: [] };
      map.set(key, entry as unknown as (typeof rows)[0]);
      rows.push(entry);
    }
    (map.get(key) as unknown as Row).holdings.push({
      id: r.id,
      symbol: r.symbol,
      stockName: r.stock_name,
      percentage: Number(r.percentage),
      rank: r.rank,
      status: r.status as "draft" | "published",
    });
  }
  return rows;
}

async function queryPublishedPeriods(
  db: NonNullable<ReturnType<typeof publicAdminClient>>,
  fundName: string
): Promise<{ year: number; month: number }[]> {
  const { data, error } = await db
    .from("mutual_fund_holdings")
    .select("report_year, report_month")
    .eq("fund_name", fundName)
    .eq("status", "published")
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  const out: { year: number; month: number }[] = [];
  for (const r of data ?? []) {
    const k = `${r.report_year}-${r.report_month}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ year: r.report_year, month: r.report_month });
    }
  }
  return out;
}

async function queryPublishedFundHoldings(
  db: NonNullable<ReturnType<typeof publicAdminClient>>,
  fundName: string,
  year: number,
  month: number
): Promise<FundHolding[]> {
  const { data, error } = await db
    .from("mutual_fund_holdings")
    .select("id, symbol, stock_name, percentage, rank, status")
    .eq("fund_name", fundName)
    .eq("report_year", year)
    .eq("report_month", month)
    .eq("status", "published")
    .order("percentage", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    symbol: r.symbol,
    stockName: r.stock_name,
    percentage: Number(r.percentage),
    rank: r.rank,
    status: r.status as "draft" | "published",
  }));
}

/** Public: get distinct published periods for a fund name (no auth required). */
export async function getPublishedPeriods(
  fundName: string
): Promise<{ year: number; month: number }[]> {
  const db = publicAdminClient();
  if (!db) {
    if (!canUseProductionPublicFallback()) return [];
    const remote = await getProductionHoldingsForFund(fundName);
    return remote ? [{ year: remote.year, month: remote.month }] : [];
  }
  try {
    let out = await queryPublishedPeriods(db, fundName);
    if (!out.length) {
      const resolved = await resolvePublishedFundName(fundName);
      if (resolved && resolved !== fundName) {
        out = await queryPublishedPeriods(db, resolved);
      }
    }
    if (out.length) return out;
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionHoldingsForFund(fundName);
      if (remote) return [{ year: remote.year, month: remote.month }];
    }
    return [];
  } catch (error) {
    console.warn("[fund-holdings] getPublishedPeriods failed:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionHoldingsForFund(fundName);
      if (remote) return [{ year: remote.year, month: remote.month }];
    }
    return [];
  }
}

/** Public: get published holdings for a fund+period (no auth required). */
export async function getPublishedFundHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<FundHolding[]> {
  const db = publicAdminClient();
  if (!db) {
    if (!canUseProductionPublicFallback()) return [];
    const remote = await getProductionHoldingsForFund(fundName);
    if (!remote || remote.year !== year || remote.month !== month) return [];
    return remote.holdings;
  }
  try {
    let holdings = await queryPublishedFundHoldings(db, fundName, year, month);
    if (!holdings.length) {
      const resolved = await resolvePublishedFundName(fundName);
      if (resolved && resolved !== fundName) {
        holdings = await queryPublishedFundHoldings(db, resolved, year, month);
      }
    }
    if (holdings.length) return holdings;
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionHoldingsForFund(fundName);
      if (remote && remote.year === year && remote.month === month) {
        return remote.holdings;
      }
    }
    return [];
  } catch (error) {
    console.warn("[fund-holdings] getPublishedFundHoldings failed:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionHoldingsForFund(fundName);
      if (remote && remote.year === year && remote.month === month) {
        return remote.holdings;
      }
    }
    return [];
  }
}

/** Public: load all published holdings for all funds in a given period (no auth required). */
export async function getPublishedHoldingsForPeriod(
  year: number,
  month: number
): Promise<PublishedHoldingsGroup[]> {
  const db = publicAdminClient();
  if (!db) {
    if (!canUseProductionPublicFallback()) return [];
    const remote = await getProductionPublishedHoldingsAll();
    if (!remote || remote.year !== year || remote.month !== month) return [];
    return remote.funds;
  }
  try {
    const { data, error } = await db
      .from("mutual_fund_holdings")
      .select("amc, fund_name, symbol, stock_name, percentage, rank")
      .eq("status", "published")
      .eq("report_year", year)
      .eq("report_month", month)
      .order("amc")
      .order("fund_name")
      .order("rank", { ascending: true, nullsFirst: false });
    if (error) throw error;

    const map = new Map<string, PublishedHoldingsGroup>();
    for (const r of data ?? []) {
      const key = `${r.amc}||${r.fund_name}`;
      if (!map.has(key)) map.set(key, { fundName: r.fund_name, amc: r.amc, holdings: [] });
      map.get(key)!.holdings.push({
        id: 0,
        symbol: r.symbol,
        stockName: r.stock_name,
        percentage: Number(r.percentage),
        rank: r.rank,
        status: "published",
      });
    }
    const groups = Array.from(map.values());
    if (groups.length) return groups;
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionPublishedHoldingsAll();
      if (remote && remote.year === year && remote.month === month) {
        return remote.funds;
      }
    }
    return [];
  } catch (error) {
    console.warn("[fund-holdings] getPublishedHoldingsForPeriod failed:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionPublishedHoldingsAll();
      if (remote && remote.year === year && remote.month === month) {
        return remote.funds;
      }
    }
    return [];
  }
}

/** Public: find the most recent published period across all funds (no auth required). */
export async function getLatestPublishedPeriod(): Promise<{ year: number; month: number } | null> {
  const db = publicAdminClient();
  if (!db) {
    if (!canUseProductionPublicFallback()) return null;
    const remote = await getProductionPublishedHoldingsAll();
    return remote ? { year: remote.year, month: remote.month } : null;
  }
  try {
    const { data, error } = await db
      .from("mutual_fund_holdings")
      .select("report_year, report_month")
      .eq("status", "published")
      .order("report_year", { ascending: false })
      .order("report_month", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data?.length) {
      return { year: data[0].report_year, month: data[0].report_month };
    }
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionPublishedHoldingsAll();
      if (remote) return { year: remote.year, month: remote.month };
    }
    return null;
  } catch (error) {
    console.warn("[fund-holdings] getLatestPublishedPeriod failed:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionPublishedHoldingsAll();
      if (remote) return { year: remote.year, month: remote.month };
    }
    return null;
  }
}

/** Public: load the most recent published holdings for all funds (no auth required). */
export async function getLatestPublishedHoldingsAll(): Promise<{
  year: number;
  month: number;
  funds: PublishedHoldingsGroup[];
}> {
  try {
    const period = await getLatestPublishedPeriod();
    if (!period) {
      if (canUseProductionPublicFallback()) {
        const remote = await getProductionPublishedHoldingsAll();
        if (remote?.funds.length) return remote;
      }
      return { year: 0, month: 0, funds: [] };
    }
    const funds = await getPublishedHoldingsForPeriod(period.year, period.month);
    if (funds.length) return { ...period, funds };
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionPublishedHoldingsAll();
      if (remote?.funds.length) return remote;
    }
    return { ...period, funds };
  } catch (error) {
    console.warn("[fund-holdings] getLatestPublishedHoldingsAll failed:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await getProductionPublishedHoldingsAll();
      if (remote?.funds.length) return remote;
    }
    return { year: 0, month: 0, funds: [] };
  }
}

/** Load PSX tickers for the stock picker. */
export async function getActiveTickers(): Promise<{ symbol: string; companyName: string }[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tickers")
    .select("symbol, company_name")
    .eq("is_active", true)
    .order("symbol");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    symbol: r.symbol,
    companyName: r.company_name ?? r.symbol,
  }));
}
