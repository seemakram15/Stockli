import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/auth/roles";
import type {
  FundPeriodStatus,
  FundHolding,
  SaveHoldingInput,
} from "@/lib/types/fund-holdings";

export type { FundPeriodStatus, FundHolding, SaveHoldingInput };

async function assertSuperadmin() {
  if (!(await isSuperadmin())) throw new Error("Forbidden");
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

/** Public: get distinct published periods for a fund name (no auth required). */
export async function getPublishedPeriods(
  fundName: string
): Promise<{ year: number; month: number }[]> {
  const db = createAdminClient();
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
    if (!seen.has(k)) { seen.add(k); out.push({ year: r.report_year, month: r.report_month }); }
  }
  return out;
}

/** Public: get published holdings for a fund+period (no auth required). */
export async function getPublishedFundHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<FundHolding[]> {
  const db = createAdminClient();
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
