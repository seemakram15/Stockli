import "server-only";
import { parse } from "node-html-parser";
import { identifyAmcBrand, shortAmcName } from "@/lib/amc-brands";
import { getStaleCached } from "@/lib/cache/stale";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  FUND_INVESTMENT_AMOUNT,
  profitOnInvestment,
} from "@/lib/services/fund-return-estimate";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

const MUFAP_BASE = "https://www.mufap.com.pk";
const INVESTMENT_AMOUNT = FUND_INVESTMENT_AMOUNT;
const MUFAP_TTL_SECONDS = 15 * 60;
const MUFAP_DETAIL_TTL_SECONDS = 60 * 60;
const MUFAP_STALE_SECONDS = 24 * 60 * 60;

export type FundClassFilter = "all" | "islamic" | "conventional" | "pension";

export interface MufapAssetAllocation {
  label: string;
  amount: number | null;
  percent: number | null;
}

export interface MufapFundHolding {
  name: string;
  percent: number | null;
  date: string | null;
  readableName: boolean;
}

export interface MufapNavPoint {
  date: string;
  nav: number;
}

export interface MufapFund {
  fundId: string | null;
  name: string;
  sector: string;
  category: string;
  type: string;
  rating: string | null;
  benchmark: string | null;
  validityDate: string | null;
  nav: number | null;
  ytd: number | null;
  mtd: number | null;
  d1: number | null;
  d15: number | null;
  d30: number | null;
  d90: number | null;
  d180: number | null;
  d270: number | null;
  d365: number | null;
  y2: number | null;
  y3: number | null;
  amc: string;
  amcShort: string;
  offerPrice: number | null;
  riskProfile: string | null;
  classFilter: FundClassFilter;
  profileUrl: string | null;
  profitOn100k: number | null;
  assetAllocation: MufapAssetAllocation[];
  topHoldings: MufapFundHolding[];
  holdingsNote: string | null;
  detailDate: string | null;
  amcLogoUrl: string | null;
  navHistory: MufapNavPoint[];
  fundCode: string | null;
  inceptionDate: string | null;
  frontLoad: number | null;
  backLoad: number | null;
  contingentLoad: number | null;
  dealingDays: string | null;
  cutOffTime: string | null;
  priceMechanism: string | null;
  trusteeName: string | null;
  ratingDate: string | null;
  leverage: string | null;
  amcEmail: string | null;
  amcPhone: string | null;
  amcUrl: string | null;
  netAssets: number | null;
  netAssetsExFof: number | null;
  terYtd: number | null;
  terMtd: number | null;
  govLeviesYtd: number | null;
  govLeviesMtd: number | null;
  sellingMarketingPct: number | null;
}

export interface MufapFundsData {
  funds: MufapFund[];
  amcs: string[];
  types: string[];
  updatedAt: string;
  sourceUrl: string;
  investmentAmount: number;
  unavailable?: boolean;
  errorMessage?: string;
}

export async function getMufapFunds({
  includeEtfs = false,
}: {
  includeEtfs?: boolean;
} = {}): Promise<MufapFundsData> {
  try {
    const cached = await getStaleCached({
      key: `mufap:funds:${includeEtfs ? "etfs" : "mutual"}`,
      ttlSeconds: shouldRefreshPsxData() ? MUFAP_TTL_SECONDS : psxLiveCacheTtlSeconds(),
      staleSeconds: Math.max(MUFAP_STALE_SECONDS, psxLiveCacheTtlSeconds()),
      load: () => loadMufapFunds({ includeEtfs }),
      isUsable: (data) => data.funds.length > 0,
    });
    return cached.value;
  } catch (error) {
    console.warn("[mufap] source unavailable:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionPublicData<MufapFundsData>({
        path: `/api/public/mufap?kind=${includeEtfs ? "etfs" : "mutual"}`,
        refererPath: includeEtfs ? "/market/etfs" : "/market/mutual-funds",
        isUsable: (data) => Boolean(data?.funds?.length),
        label: "mufap",
      });
      if (remote?.funds.length) return remote;
    }
    return emptyMufapFundsData(includeEtfs, error);
  }
}

async function loadMufapFunds({
  includeEtfs = false,
}: {
  includeEtfs?: boolean;
} = {}): Promise<MufapFundsData> {
  const performancePath = `/Industry/IndustryStatDaily?tab=${includeEtfs ? "2" : "1"}`;
  const [performanceHtml, directoryHtml] = await Promise.all([
    fetchMufap(performancePath),
    fetchMufap("/FundProfile/FundDirectory").catch(() => ""),
  ]);
  const directory = directoryHtml ? parseFundDirectory(directoryHtml) : emptyDirectory();

  const funds = parsePerformance(performanceHtml, directory)
    .filter((fund) =>
      includeEtfs
        ? fund.sector.toLowerCase().includes("exchange traded")
        : !fund.sector.toLowerCase().includes("exchange traded")
    )
    .sort((a, b) => (b.d1 ?? -Infinity) - (a.d1 ?? -Infinity));

  return {
    funds,
    amcs: uniqueSorted(funds.map((fund) => fund.amc).filter(Boolean)),
    types: uniqueSorted(funds.map((fund) => fund.type).filter(Boolean)),
    updatedAt: new Date().toISOString(),
    sourceUrl: `${MUFAP_BASE}${performancePath}`,
    investmentAmount: INVESTMENT_AMOUNT,
  };
}

export async function getMufapFundById(fundId: string): Promise<MufapFund | null> {
  const [funds, etfs] = await Promise.all([
    getMufapFunds(),
    getMufapFunds({ includeEtfs: true }),
  ]);
  const fund = [...funds.funds, ...etfs.funds].find((item) => item.fundId === fundId) ?? null;
  if (!fund) return null;

  try {
    const { value: detail } = await getStaleCached({
      key: `mufap:detail:${fundId}`,
      ttlSeconds: shouldRefreshPsxData() ? MUFAP_DETAIL_TTL_SECONDS : psxLiveCacheTtlSeconds(),
      staleSeconds: Math.max(MUFAP_STALE_SECONDS, psxLiveCacheTtlSeconds()),
      load: () => fetchMufapFundDetail(fundId),
    });
    return {
      ...fund,
      ...detail,
      riskProfile: detail.riskProfile ?? fund.riskProfile,
      offerPrice: detail.offerPrice ?? fund.offerPrice,
      amcLogoUrl: detail.amcLogoUrl ?? fund.amcLogoUrl,
      benchmark: detail.benchmark ?? fund.benchmark,
      nav: detail.nav ?? fund.nav,
      ytd: detail.ytd ?? fund.ytd,
      mtd: detail.mtd ?? fund.mtd,
      d1: detail.d1 ?? fund.d1,
      d15: detail.d15 ?? fund.d15,
      d30: detail.d30 ?? fund.d30,
      d90: detail.d90 ?? fund.d90,
      d180: detail.d180 ?? fund.d180,
      d270: detail.d270 ?? fund.d270,
      d365: detail.d365 ?? fund.d365,
      y2: detail.y2 ?? fund.y2,
      y3: detail.y3 ?? fund.y3,
      profitOn100k:
        detail.d1 != null ? profitOnInvestment(detail.d1, INVESTMENT_AMOUNT) : fund.profitOn100k,
    };
  } catch {
    return fund;
  }
}

async function fetchMufap(path: string) {
  const res = await fetch(`${MUFAP_BASE}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; MyStockli/1.0; +https://mystockli.com)",
    },
    next: { revalidate: MUFAP_TTL_SECONDS },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`MUFAP request failed: ${res.status}`);
  return res.text();
}

interface FundDirectoryEntry {
  fundId: string | null;
  name: string;
  amc: string;
  category: string | null;
  nav: number | null;
  offerPrice: number | null;
  riskProfile: string | null;
  logoUrl: string | null;
}

interface FundDirectory {
  byFundId: Map<string, FundDirectoryEntry>;
  byName: Map<string, FundDirectoryEntry>;
}

function parsePerformance(html: string, directory: FundDirectory) {
  const root = parse(html);
  const rows = root.querySelectorAll("#table_id tbody tr");

  return rows
    .map((row): MufapFund | null => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 18) return null;

      const link = cells[2].querySelector("a");
      const name = clean(link?.text ?? cells[2].text);
      if (!name) return null;

      const href = link?.getAttribute("href") ?? "";
      const fundId = getFundId(href);
      const sector = clean(cells[0].text);
      const category = clean(cells[1].text);
      const type = cleanType(category);
      const d1 = toNum(cells[9].text);
      const directoryEntry = lookupDirectoryEntry(directory, fundId, name);
      const brand = identifyAmcBrand(directoryEntry?.amc ?? name);
      const amc = directoryEntry?.amc ?? brand.fullName;

      return {
        fundId,
        name,
        sector,
        category,
        type,
        rating: nullableText(cells[3].text),
        benchmark: nullableText(cells[4].text),
        validityDate: nullableText(cells[5].text),
        nav: toNum(cells[6].text),
        ytd: toNum(cells[7].text),
        mtd: toNum(cells[8].text),
        d1,
        d15: toNum(cells[10].text),
        d30: toNum(cells[11].text),
        d90: toNum(cells[12].text),
        d180: toNum(cells[13].text),
        d270: toNum(cells[14].text),
        d365: toNum(cells[15].text),
        y2: toNum(cells[16].text),
        y3: toNum(cells[17].text),
        amc,
        amcShort: shortAmcName(amc),
        offerPrice: directoryEntry?.offerPrice ?? null,
        riskProfile: directoryEntry?.riskProfile ?? null,
        classFilter: classifyFund(sector, category, name),
        profileUrl: fundId ? `${MUFAP_BASE}/FundProfile/FundDetail?FundID=${fundId}` : null,
        profitOn100k: d1 == null ? null : profitOnInvestment(d1, INVESTMENT_AMOUNT),
        assetAllocation: [],
        topHoldings: [],
        holdingsNote: null,
        detailDate: null,
        amcLogoUrl: directoryEntry?.logoUrl ?? null,
        navHistory: [],
        fundCode: null,
        inceptionDate: null,
        frontLoad: null,
        backLoad: null,
        contingentLoad: null,
        dealingDays: null,
        cutOffTime: null,
        priceMechanism: null,
        trusteeName: null,
        ratingDate: null,
        leverage: null,
        amcEmail: null,
        amcPhone: null,
        amcUrl: null,
        netAssets: null,
        netAssetsExFof: null,
        terYtd: null,
        terMtd: null,
        govLeviesYtd: null,
        govLeviesMtd: null,
        sellingMarketingPct: null,
      };
    })
    .filter(Boolean) as MufapFund[];
}

function parseFundDirectory(html: string): FundDirectory {
  const root = parse(html);
  const byFundId = new Map<string, FundDirectoryEntry>();
  const byName = new Map<string, FundDirectoryEntry>();

  for (const row of root.querySelectorAll("#table_id tbody tr")) {
    const cells = row.querySelectorAll("td");
    const name = clean(row.querySelector("h3.card-title")?.text ?? "");
    if (!name) continue;

    const link = row.querySelector("a[href*='FundID=']");
    const fundId = getFundId(link?.getAttribute("href") ?? "");
    const hiddenAmc = clean(cells[2]?.text ?? "");
    const visibleAmc = clean(row.querySelector(".card-title + div span")?.text ?? "");
    const amc = hiddenAmc || visibleAmc;
    if (!amc) continue;

    const logoSrc = row.querySelector("img")?.getAttribute("src") ?? "";
    const entry: FundDirectoryEntry = {
      fundId,
      name,
      amc,
      category: nullableText(cells[3]?.text ?? ""),
      nav: toNum(row.querySelector("#netval")?.text),
      offerPrice: toNum(row.querySelector("#unitPrice")?.text),
      riskProfile: nullableText(row.querySelector("[class^='risk-']")?.text ?? ""),
      logoUrl: logoUrl(logoSrc),
    };

    if (fundId) byFundId.set(fundId, entry);
    byName.set(normalizeFundName(name), entry);
  }

  return { byFundId, byName };
}

function emptyDirectory(): FundDirectory {
  return { byFundId: new Map(), byName: new Map() };
}

function lookupDirectoryEntry(directory: FundDirectory, fundId: string | null, name: string) {
  return (fundId ? directory.byFundId.get(fundId) : null) ??
    directory.byName.get(normalizeFundName(name)) ??
    null;
}

async function fetchMufapFundDetail(fundId: string): Promise<Partial<MufapFund>> {
  const res = await fetch(`${MUFAP_BASE}/AMC/GetFundDetailbyAMCByDate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "User-Agent":
        "Mozilla/5.0 (compatible; MyStockli/1.0; +https://mystockli.com)",
    },
    body: JSON.stringify({
      FundID: fundId,
      Date: firstDayOfMonth(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`MUFAP detail request failed: ${res.status}`);

  const outer = (await res.json()) as { data?: string | object };
  const payload = typeof outer.data === "string" ? JSON.parse(outer.data) : outer.data;
  const tables = payload as {
    Table?: Array<Record<string, unknown>>;
    Table1?: Array<Record<string, unknown>>;
    Table2?: Array<Record<string, unknown>>;
    Table3?: Array<Record<string, unknown>>;
    Table4?: Array<Record<string, unknown>>;
    Table5?: Array<Record<string, unknown>>;
  };
  const summary = tables.Table?.[0] ?? {};
  const navRows = tables.Table1 ?? [];
  const allocationRow = tables.Table2?.[0] ?? {};
  const holdingRows = tables.Table3 ?? [];
  const returnsRow = tables.Table4?.[0] ?? {};
  const expenseRow = tables.Table5?.[0] ?? {};
  const topHoldings = holdingRows
    .map((row, index) => parseHolding(row, index))
    .filter(Boolean) as MufapFundHolding[];
  const readableCount = topHoldings.filter((holding) => holding.readableName).length;
  const netAssets = toNumUnknown(allocationRow.Total);
  const fofAmount = toNumUnknown(allocationRow.OtherInvestAmountFundOfFund);

  return {
    offerPrice: toNumUnknown(summary.OfferPrice ?? summary.Offer ?? summary["Offer Price"]),
    riskProfile: nullableUnknown(summary.ProfileRiskOfFund ?? summary.RiskProfile ?? summary.Risk),
    amcLogoUrl: logoUrl(summary.AMCLogo ?? summary.Logo ?? summary.logo),
    benchmark: nullableUnknown(summary.BenchMark),
    assetAllocation: parseAssetAllocation(allocationRow),
    topHoldings,
    holdingsNote: topHoldings.length && readableCount === 0
      ? "MUFAP has published holding weights for this period, but not readable stock names. MyStockli is showing the official allocation data without guessing names."
      : null,
    detailDate: nullableUnknown(allocationRow.Date ?? summary.Date ?? summary.ReportDate),
    nav: toNumUnknown(returnsRow.CurrentNav),
    ytd: toNumUnknown(returnsRow.YTD),
    mtd: toNumUnknown(returnsRow.MTD),
    d1: toNumUnknown(returnsRow.Day1),
    d15: toNumUnknown(returnsRow.Day15),
    d30: toNumUnknown(returnsRow.Day30),
    d90: toNumUnknown(returnsRow.Day90),
    d180: toNumUnknown(returnsRow.Day180),
    d270: toNumUnknown(returnsRow.Day270),
    d365: toNumUnknown(returnsRow.Year1),
    y2: toNumUnknown(returnsRow.Year2),
    y3: toNumUnknown(returnsRow.Year3),
    navHistory: parseNavHistory(navRows),
    fundCode: nullableUnknown(summary.Fund_Code),
    inceptionDate: nullableUnknown(summary.inception),
    frontLoad: toNumUnknown(summary.FrontLoad),
    backLoad: toNumUnknown(summary.BackLoad),
    contingentLoad: toNumUnknown(summary.ContingentLoad),
    dealingDays: nullableUnknown(summary.DealingDays),
    cutOffTime: nullableUnknown(summary.CutOffTime),
    trusteeName: nullableUnknown(summary.TrusteeNAME),
    ratingDate: nullableUnknown(summary.FundStabilityRatingDate),
    leverage: nullableUnknown(summary.Leverage),
    amcEmail: nullableUnknown(summary.email_addr),
    amcPhone: nullableUnknown(summary.phone_no),
    amcUrl: nullableUnknown(summary.url ?? summary.externalurl),
    netAssets,
    netAssetsExFof: netAssets != null ? netAssets - (fofAmount ?? 0) : null,
    terYtd: toNumUnknown(expenseRow.TotalExpenseRatioYTD),
    terMtd: toNumUnknown(expenseRow.TotalExpenseRatioMTD),
    govLeviesYtd: toNumUnknown(expenseRow.GovernmentLeviesYTD),
    govLeviesMtd: toNumUnknown(expenseRow.GovernmentLeviesMTD),
    sellingMarketingPct: toNumUnknown(expenseRow.selmarkexpense),
  };
}

function parseNavHistory(rows: Array<Record<string, unknown>>): MufapNavPoint[] {
  return rows
    .map((row): MufapNavPoint | null => {
      const date = nullableUnknown(row.entryDate ?? row.CalDate);
      const nav = toNumUnknown(row.netval);
      if (!date || nav == null) return null;
      return { date, nav };
    })
    .filter(Boolean) as MufapNavPoint[];
}

function emptyMufapFundsData(includeEtfs: boolean, error: unknown): MufapFundsData {
  const performancePath = `/Industry/IndustryStatDaily?tab=${includeEtfs ? "2" : "1"}`;
  return {
    funds: [],
    amcs: [],
    types: [],
    updatedAt: new Date().toISOString(),
    sourceUrl: `${MUFAP_BASE}${performancePath}`,
    investmentAmount: INVESTMENT_AMOUNT,
    unavailable: true,
    errorMessage:
      error instanceof Error && error.name === "TimeoutError"
        ? "MUFAP is taking too long to respond. Please refresh in a moment."
        : "MUFAP data is temporarily unavailable. Please refresh in a moment.",
  };
}

function parseAssetAllocation(row: Record<string, unknown>): MufapAssetAllocation[] {
  const definitions: Array<[string, string, string]> = [
    ["Stocks / Equities", "StocksOREquities", "StocksOREquitiesPercent"],
    ["Cash", "Cash", "Cashpercent"],
    ["T-Bills", "TBills", "TBillsPercent"],
    ["PIBs", "PIBs", "PIBsPercent"],
    ["TFCs", "TFCs", "TFCsPercent"],
    ["Ijarah Sukuks", "IjarahSukuks", "IjarahSukuksPercent"],
    ["Commercial Papers", "Commercialpapers", "CommercialpapersPercent"],
    ["Govt. Backed / Guaranteed", "GovernmentBackedORGuaranteedSecurities", "GovernmentBackedORGuaranteedSecuritiesPercent"],
    ["Placements with Banks / DFIs", "PlacementsWithBanksandDFIs", "PlacementsWithBanksandDFIsPercent"],
    ["Placements with NBFCs", "PlacementsWithNBFCs", "PlacementsWithNBFCsPercent"],
    ["Reverse Repo (Govt.)", "ReverseReposAgainstGovernmentSecurities", "ReverseReposAgainstGovernmentSecuritiesPercent"],
    ["Reverse Repo (Other)", "ReverseReposAgainstAllOtherSecurities", "ReverseReposAgainstAllOtherSecuritiesPercent"],
    ["CFS / MTS", "CFS", "CFSPercent"],
    ["Spread Transactions", "SpreadTransactions", "SpreadTransactionPercent"],
    ["Commodity", "Commodity", "CommodityPercent"],
    ["Fund of Funds", "OtherInvestAmountFundOfFund", "OtherInvestAmountFundOfFundPercent"],
    ["Other Incl. Receivables", "OtherIncludingReceivable", "OtherIncludingReceivablePercent"],
    ["Liabilities", "Laibilities", "LaibilitiesPercent"],
  ];

  return definitions
    .map(([label, amountKey, percentKey]) => ({
      label,
      amount: toNumUnknown(row[amountKey]),
      percent: toNumUnknown(row[percentKey]),
    }))
    .filter(
      (item) =>
        (item.amount != null && Math.abs(item.amount) > 0.0001) ||
        (item.percent != null && Math.abs(item.percent) > 0.0001)
    );
}

function parseHolding(row: Record<string, unknown>, index: number): MufapFundHolding | null {
  const asset = clean(String(row.Asset ?? row.Holding ?? row.Security ?? ""));
  const percent = toNumUnknown(row.Percentage ?? row.Percent ?? row.Weight);
  if (!asset && percent == null) return null;
  const readableName = Boolean(asset && !/^-?\d+(\.\d+)?$/.test(asset));
  return {
    name: readableName ? asset : `MUFAP disclosure row ${index + 1}`,
    percent,
    date: nullableUnknown(row.Date),
    readableName,
  };
}

function classifyFund(sector: string, category: string, name: string): FundClassFilter {
  const haystack = `${sector} ${category} ${name}`.toLowerCase();
  if (haystack.includes("pension") || haystack.includes("vps")) return "pension";
  if (
    haystack.includes("islamic") ||
    haystack.includes("shariah") ||
    haystack.includes("sharia") ||
    haystack.includes("meezan") ||
    haystack.includes("alhamra") ||
    /\bal\s*ameen\b/.test(haystack)
  ) {
    return "islamic";
  }
  return "conventional";
}

function cleanType(value: string) {
  return clean(value)
    .replace(/\((Annualized|Absolute)\s+Return\s*\)/gi, "")
    .replace(/^Shariah Compliant\s+/i, "")
    .trim();
}

function getFundId(href: string) {
  const match = href.match(/FundID=(\d+)/i);
  return match?.[1] ?? null;
}

function toNum(value: string | null | undefined): number | null {
  const text = clean(value ?? "");
  if (!text || /^n\/?a$/i.test(text) || text === "-") return null;
  const negative = /^\(.+\)$/.test(text);
  const parsed = Number(text.replace(/[,%()]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function toNumUnknown(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return toNum(value);
  return null;
}

function nullableUnknown(value: unknown) {
  return typeof value === "string" ? nullableText(value) : null;
}

function logoUrl(value: unknown) {
  const text = typeof value === "string" ? clean(value) : "";
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `${MUFAP_BASE}/${text.replace(/^\/+/, "")}`;
}

function normalizeFundName(value: string) {
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ");
}

function firstDayOfMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function nullableText(value: string) {
  const text = clean(value);
  return !text || /^n\/?a$/i.test(text) || text === "-" ? null : text;
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
