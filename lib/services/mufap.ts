import "server-only";
import { parse } from "node-html-parser";

const MUFAP_BASE = "https://www.mufap.com.pk";
const INVESTMENT_AMOUNT = 100_000;

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
}

export interface MufapFundsData {
  funds: MufapFund[];
  amcs: string[];
  types: string[];
  updatedAt: string;
  sourceUrl: string;
  investmentAmount: number;
}

export async function getMufapFunds({
  includeEtfs = false,
}: {
  includeEtfs?: boolean;
} = {}): Promise<MufapFundsData> {
  const performancePath = `/Industry/IndustryStatDaily?tab=${includeEtfs ? "2" : "1"}`;
  const performanceHtml = await fetchMufap(performancePath);

  const funds = parsePerformance(performanceHtml)
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
    const detail = await fetchMufapFundDetail(fundId);
    return {
      ...fund,
      ...detail,
      riskProfile: detail.riskProfile ?? fund.riskProfile,
      offerPrice: detail.offerPrice ?? fund.offerPrice,
      amcLogoUrl: detail.amcLogoUrl ?? fund.amcLogoUrl,
    };
  } catch {
    return fund;
  }
}

async function fetchMufap(path: string) {
  const res = await fetch(`${MUFAP_BASE}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Stockli/1.0; +https://stock-portfolio-khaki.vercel.app)",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MUFAP request failed: ${res.status}`);
  return res.text();
}

function parsePerformance(html: string) {
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
      const amc = inferAmc(name);

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
        amcShort: shortAmc(amc),
        offerPrice: null,
        riskProfile: null,
        classFilter: classifyFund(sector, category, name),
        profileUrl: fundId ? `${MUFAP_BASE}/FundProfile/FundDetail?FundID=${fundId}` : null,
        profitOn100k: d1 == null ? null : (INVESTMENT_AMOUNT * d1) / 100,
        assetAllocation: [],
        topHoldings: [],
        holdingsNote: null,
        detailDate: null,
        amcLogoUrl: null,
      };
    })
    .filter(Boolean) as MufapFund[];
}

async function fetchMufapFundDetail(fundId: string): Promise<Partial<MufapFund>> {
  const res = await fetch(`${MUFAP_BASE}/AMC/GetFundDetailbyAMCByDate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "User-Agent":
        "Mozilla/5.0 (compatible; Stockli/1.0; +https://stock-portfolio-khaki.vercel.app)",
    },
    body: JSON.stringify({
      FundID: fundId,
      Date: firstDayOfMonth(),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`MUFAP detail request failed: ${res.status}`);

  const outer = (await res.json()) as { data?: string | object };
  const payload = typeof outer.data === "string" ? JSON.parse(outer.data) : outer.data;
  const tables = payload as {
    Table?: Array<Record<string, unknown>>;
    Table2?: Array<Record<string, unknown>>;
    Table3?: Array<Record<string, unknown>>;
  };
  const summary = tables.Table?.[0] ?? {};
  const allocationRow = tables.Table2?.[0] ?? {};
  const holdingRows = tables.Table3 ?? [];
  const topHoldings = holdingRows
    .map((row, index) => parseHolding(row, index))
    .filter(Boolean) as MufapFundHolding[];
  const readableCount = topHoldings.filter((holding) => holding.readableName).length;

  return {
    offerPrice: toNumUnknown(summary.OfferPrice ?? summary.Offer ?? summary["Offer Price"]),
    riskProfile: nullableUnknown(summary.RiskProfile ?? summary.Risk ?? summary["Risk Profile"]),
    amcLogoUrl: logoUrl(summary.AMCLogo ?? summary.Logo ?? summary.logo),
    assetAllocation: parseAssetAllocation(allocationRow),
    topHoldings,
    holdingsNote: topHoldings.length && readableCount === 0
      ? "MUFAP has published holding weights for this period, but not readable stock names. Stockli is showing the official allocation data without guessing names."
      : null,
    detailDate: nullableUnknown(allocationRow.Date ?? summary.Date ?? summary.ReportDate),
  };
}

function parseAssetAllocation(row: Record<string, unknown>): MufapAssetAllocation[] {
  const definitions: Array<[string, string, string]> = [
    ["Stocks / Equities", "StocksOREquities", "StocksOREquitiesPercent"],
    ["Cash", "Cash", "Cashpercent"],
    ["T-Bills", "TBills", "TBillsPercent"],
    ["PIBs", "PIBs", "PIBsPercent"],
    ["TFC / Sukuk", "TFCsSukuks", "TFCsSukuksPercent"],
    ["Commercial Paper", "CommercialPaper", "CommercialPaperPercent"],
    ["Placements", "Placements", "PlacementsPercent"],
    ["Term deposits", "TermDeposit", "TermDepositPercent"],
    ["Other assets", "OtherAssets", "OtherAssetsPercent"],
  ];

  return definitions
    .map(([label, amountKey, percentKey]) => ({
      label,
      amount: toNumUnknown(row[amountKey]),
      percent: toNumUnknown(row[percentKey]),
    }))
    .filter((item) => item.amount != null || item.percent != null);
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
  if (haystack.includes("islamic") || haystack.includes("shariah")) return "islamic";
  return "conventional";
}

function inferAmc(name: string) {
  const first = name.split(/\s+/)[0] ?? "";
  const known: Record<string, string> = {
    ABL: "ABL Asset Management Company Limited",
    Alfalah: "Alfalah Investments Limited",
    Alhamra: "MCB Investment Management Limited",
    Atlas: "Atlas Asset Management Limited",
    HBL: "HBL Asset Management Limited",
    JS: "JS Investments Limited",
    Meezan: "Al Meezan Investment Management Limited",
    NBP: "NBP Fund Management Limited",
    NIT: "National Investment Trust Limited",
    UBL: "UBL Fund Managers Limited",
  };
  return known[first] ?? (first || "Other AMC");
}

function shortAmc(amc: string) {
  return amc
    .replace(/Asset Management Company Limited|Asset Management Limited|Investment Management Limited|Investments Limited|Fund Management Limited|Fund Managers Limited|Limited/gi, "")
    .replace(/\s+/g, " ")
    .trim();
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
