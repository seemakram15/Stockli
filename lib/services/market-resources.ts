import "server-only";
import { parse } from "node-html-parser";
import { getStaleCached } from "@/lib/cache/stale";
import { PSX_TIMEZONE } from "@/lib/constants";
import {
  psxClosedMaxStaleSeconds,
  psxLiveCacheTtlSeconds,
  shouldRefreshPsxData,
} from "@/lib/psx/market-hours";
import { getSeedTicker } from "@/lib/psx/symbols";
import { getMarketRows } from "@/lib/services/prices";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

const USER_AGENT =
  "Mozilla/5.0 (compatible; MyStockli/1.0; +https://mystockli.com)";
const REQUEST_TIMEOUT_MS = 8_000;
const DAILY_TTL_SECONDS = 30 * 60;
const DAILY_STALE_SECONDS = 7 * 24 * 60 * 60;

const SOURCES = {
  boardMeetingsPrimary: "https://scstrade.com/MarketStatistics/MS_BoardMeetings.aspx",
  boardMeetingsFallback: "https://ksestocks.com/blog/psx-kse-board-meetings-schedule/",
  bookClosuresPrimary: "https://scstrade.com/MarketStatistics/MS_xDates.aspx",
  bookClosuresFallback: "https://www.ksestocks.com/BookClosures",
  // Prefer KSE Stocks — do not scrape dps.psx.com.pk for payouts.
  dividendPrimary: "https://ksestocks.com/blog/dividend-schedule/",
  dividendFallback: "https://ksestocks.com/blog/dividend-schedule/",
  pivotReference: "https://www.ksestocks.com/PivotPoints",
};

export interface UsefulLinkItem {
  title: string;
  description: string;
  href: string;
  category: string;
  official?: boolean;
}

export interface UsefulLinkGroup {
  title: string;
  description: string;
  links: UsefulLinkItem[];
}

export interface UsefulLinksData {
  groups: UsefulLinkGroup[];
  updatedAt: string;
  sourceUrl: string;
}

export interface BoardMeetingRow {
  id: string;
  symbol: string | null;
  company: string;
  meetingDate: string;
  meetingTime: string;
  subject: string;
  sourceLabel: string;
}

export interface BoardMeetingsData {
  rows: BoardMeetingRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
}

export interface BookClosureRow {
  id: string;
  symbol: string;
  company: string;
  faceValue: string;
  bookClosureFrom: string;
  bookClosureTo: string;
  payout: string;
  lastClose: string;
  sourceLabel: string;
}

export interface BookClosuresData {
  rows: BookClosureRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
}

export interface DividendHistoryRow {
  id: string;
  symbol: string;
  payout: string;
  creditedOn: string;
  sourceLabel: string;
}

export interface DividendHistoryData {
  rows: DividendHistoryRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
}

export interface PivotPointRow {
  symbol: string;
  companyName: string;
  sector: string;
  current: number;
  high: number;
  low: number;
  previousClose: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  range: number;
  capturedAt: string | null;
}

export interface PivotPointsData {
  rows: PivotPointRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
  method: string;
}

interface KseBookClosuresPayload {
  cur?: KseBookClosureRaw[];
  old?: KseBookClosureRaw[];
}

interface KseBookClosureRaw {
  symbol?: string;
  cname?: string;
  faceval?: string;
  bcfrom?: string;
  bcto?: string;
  payout?: string;
  lc?: string;
}

interface SscBoardMeetingRaw {
  company_code?: string;
  company_name?: string;
  bm_date?: string;
  bm_time?: string;
  bm_place?: string;
  bm_year?: string;
  bm_quarter_number?: string;
}

interface SscBookClosureRaw {
  company_code?: string;
  company_name?: string;
  bm_dividend?: string;
  bm_bonus?: string;
  bm_right_per?: string;
  bm_bc_exp?: string;
}

const CURATED_USEFUL_LINK_GROUPS: UsefulLinkGroup[] = [
  {
    title: "Market institutions",
    description: "Official PSX ecosystem sites for trading, regulation, custody and clearing.",
    links: [
      {
        title: "Pakistan Stock Exchange",
        description: "Official PSX homepage — market news, listings and investor tools.",
        href: "https://www.psx.com.pk/",
        category: "Institutions",
        official: true,
      },
      {
        title: "PSX Investor Guide",
        description: "How investing on PSX works, brokers, CDC and NCCPL roles.",
        href: "https://www.psx.com.pk/psx/resources-and-tools/investors/guide-to-investors",
        category: "Institutions",
        official: true,
      },
      {
        title: "PSX Data Portal (DPS)",
        description: "Official company announcements, financials and market data portal.",
        href: "https://dps.psx.com.pk/",
        category: "Institutions",
        official: true,
      },
      {
        title: "Listed Companies",
        description: "PSX directory of listed companies.",
        href: "https://www.psx.com.pk/psx/resources-and-tools/listings/listed-companies",
        category: "Institutions",
        official: true,
      },
      {
        title: "Find a Broker",
        description: "PSX brokerage firm directory for account opening.",
        href: "https://www.psx.com.pk/psx/resources-and-tools/brokerage-firms/",
        category: "Institutions",
        official: true,
      },
      {
        title: "SECP",
        description: "Securities and Exchange Commission of Pakistan — capital market regulator.",
        href: "https://www.secp.gov.pk/",
        category: "Institutions",
        official: true,
      },
      {
        title: "SECP Investor Basics",
        description: "Investor education and financial basics from SECP.",
        href: "https://www.secp.gov.pk/for-investors/financial-basics/",
        category: "Institutions",
        official: true,
      },
      {
        title: "SECP Capital Market Statistics",
        description: "Official capital markets data and statistics.",
        href: "https://www.secp.gov.pk/data-and-statistics/capital-markets/",
        category: "Institutions",
        official: true,
      },
      {
        title: "NCCPL",
        description: "National Clearing Company — trade clearing, UIN and settlement.",
        href: "https://www.nccpl.com.pk/",
        category: "Institutions",
        official: true,
      },
      {
        title: "CDC Pakistan",
        description: "Central Depository Company — share custody and investor accounts.",
        href: "https://www.cdcpakistan.com/",
        category: "Institutions",
        official: true,
      },
      {
        title: "MUFAP",
        description: "Mutual Funds Association of Pakistan — NAVs and industry stats.",
        href: "https://www.mufap.com.pk/",
        category: "Institutions",
        official: true,
      },
      {
        title: "PMEX",
        description: "Pakistan Mercantile Exchange — commodities futures market.",
        href: "https://www.pmex.com.pk/",
        category: "Institutions",
        official: true,
      },
    ],
  },
  {
    title: "Economy",
    description: "Macro calendars, inflation, trade and rates resources for Pakistan.",
    links: [
      {
        title: "SBP Monetary Policy",
        description: "Monetary policy statements, calendar and rate decisions.",
        href: "https://www.sbp.org.pk/our-operations/monetary-policy",
        category: "Economy",
        official: true,
      },
      {
        title: "SBP Economic Data",
        description: "Inflation, FX reserves, interest rates and other macro series.",
        href: "https://www.sbp.org.pk/economic-data",
        category: "Economy",
        official: true,
      },
      {
        title: "SBP Interest & Exchange Rates",
        description: "Policy rate, PKRV-related rates and FX reference pages.",
        href: "https://www.sbp.org.pk/rates/",
        category: "Economy",
        official: true,
      },
      {
        title: "PKRV / PIB Pricing (MUFAP)",
        description: "Daily PKRV / PKISRV / PKFRV pricing used for bond rate direction.",
        href: "https://www.mufap.com.pk/WebRegulations/Index?Head=Pricing&title=PKRV/PKISRV/PKFRV",
        category: "Economy",
        official: true,
      },
      {
        title: "PBS Price Statistics",
        description: "CPI, WPI and SPI inflation / price publications.",
        href: "https://www.pbs.gov.pk/price-statistics/",
        category: "Economy",
        official: true,
      },
      {
        title: "PBS External Trade Statistics",
        description: "Official import and export trade statistics.",
        href: "https://www.pbs.gov.pk/external-trade-statistics/",
        category: "Economy",
        official: true,
      },
      {
        title: "Pakistan Economic Survey",
        description: "Finance Division economic survey (latest published year).",
        href: "https://www.finance.gov.pk/survey_2024.html",
        category: "Economy",
        official: true,
      },
      {
        title: "Federal Board of Revenue",
        description: "Tax circulars, SROs and fiscal updates that move markets.",
        href: "https://www.fbr.gov.pk/",
        category: "Economy",
        official: true,
      },
    ],
  },
  {
    title: "Banking & financials",
    description: "Banking association and central-bank financial stability resources.",
    links: [
      {
        title: "Pakistan Banks Association",
        description: "Industry body for commercial banks in Pakistan.",
        href: "https://pba.org.pk/",
        category: "Banking",
        official: true,
      },
      {
        title: "SBP Financial Stability Review",
        description: "Central bank review of banking-system risks and resilience.",
        href: "https://www.sbp.org.pk/fsr/index.htm",
        category: "Banking",
        official: true,
      },
      {
        title: "SBP Publications Hub",
        description: "Scheduled banks statistics and other SBP publications.",
        href: "https://www.sbp.org.pk/our-operations/publications",
        category: "Banking",
        official: true,
      },
    ],
  },
  {
    title: "Oil & gas",
    description: "Fuel pricing and oil marketing industry references.",
    links: [
      {
        title: "OGRA",
        description: "Oil & Gas Regulatory Authority — petroleum product regulation and prices.",
        href: "https://www.ogra.org.pk/",
        category: "Oil & Gas",
        official: true,
      },
      {
        title: "OCAC",
        description: "Oil Companies Advisory Council — oil marketing sector updates.",
        href: "https://www.ocac.org.pk/",
        category: "Oil & Gas",
        official: true,
      },
    ],
  },
  {
    title: "Auto sector",
    description: "Production, sales, prices and public response signals for local auto companies.",
    links: [
      {
        title: "Monthly Production & Sales (PAMA)",
        description: "Month-wise production and sales of automotive assemblers.",
        href: "https://pama.org.pk/monthly-production-sales-of-vehicles/",
        category: "Auto",
        official: true,
      },
      {
        title: "Annual Production & Sales (PAMA)",
        description: "Historic annual production and sales for the auto sector.",
        href: "https://pama.org.pk/annual-sales-production/",
        category: "Auto",
        official: true,
      },
      {
        title: "PakWheels",
        description: "Car reviews, prices and public response to new launches.",
        href: "https://www.pakwheels.com/",
        category: "Auto",
      },
    ],
  },
  {
    title: "Cement sector",
    description: "Cement industry association and coal input-cost tracking.",
    links: [
      {
        title: "APCMA",
        description: "All Pakistan Cement Manufacturers Association.",
        href: "https://www.apcma.com/",
        category: "Cement",
        official: true,
      },
      {
        title: "International Coal Prices",
        description: "Coal price series useful for cement input-cost tracking.",
        href: "https://tradingeconomics.com/commodity/coal",
        category: "Cement",
      },
    ],
  },
  {
    title: "Fertilizer sector",
    description: "Fertilizer and farm-input price publications.",
    links: [
      {
        title: "PBS Price Statistics (SPI / CPI)",
        description: "Official price stats used to track fertilizer bag and farm-input prices.",
        href: "https://www.pbs.gov.pk/price-statistics/",
        category: "Fertilizer",
        official: true,
      },
      {
        title: "PACRA Sector Research",
        description: "Credit-agency sector studies including fertilizer names.",
        href: "https://www.pacra.com/research",
        category: "Fertilizer",
      },
    ],
  },
  {
    title: "Power sector",
    description: "Power regulator tariff and determination material.",
    links: [
      {
        title: "NEPRA",
        description: "National Electric Power Regulatory Authority — tariffs and determinations.",
        href: "https://www.nepra.org.pk/",
        category: "Power",
        official: true,
      },
    ],
  },
  {
    title: "Textile sector",
    description: "Industry association updates for the textile value chain.",
    links: [
      {
        title: "APTMA Press Releases",
        description: "All Pakistan Textile Mills Association updates and press releases.",
        href: "https://aptma.org.pk/press-releases/",
        category: "Textile",
        official: true,
      },
      {
        title: "APTMA",
        description: "Official APTMA homepage for policy and industry context.",
        href: "https://aptma.org.pk/",
        category: "Textile",
        official: true,
      },
    ],
  },
  {
    title: "Tech & telecom",
    description: "Telecom indicators and regulator publications for listed telcos and tech names.",
    links: [
      {
        title: "PTA Telecom Indicators",
        description: "Pakistan Telecommunication Authority subscriber and sector indicators.",
        href: "https://www.pta.gov.pk/category/telecom-indicators",
        category: "Telecom",
        official: true,
      },
      {
        title: "PTA",
        description: "Telecom regulator homepage — licenses, spectrum and industry news.",
        href: "https://www.pta.gov.pk/",
        category: "Telecom",
        official: true,
      },
    ],
  },
  {
    title: "Pharmaceutical sector",
    description: "Regulator lists and research hubs for listed pharma companies.",
    links: [
      {
        title: "Essential Medicines List (DRAP)",
        description: "National essential medicine lists from the drug regulator.",
        href: "https://www.dra.gov.pk/publications/national-essential-medicine-lists/",
        category: "Pharma",
        official: true,
      },
      {
        title: "DRAP",
        description: "Drug Regulatory Authority of Pakistan homepage.",
        href: "https://www.dra.gov.pk/",
        category: "Pharma",
        official: true,
      },
      {
        title: "PACRA Research",
        description: "PACRA sector research hub (includes pharmaceuticals).",
        href: "https://www.pacra.com/research",
        category: "Pharma",
      },
      {
        title: "VIS Sector Reports",
        description: "VIS credit-rating sector reports including pharmaceuticals.",
        href: "https://vis.com.pk/",
        category: "Pharma",
      },
    ],
  },
  {
    title: "Mutual funds",
    description: "Official mutual-fund industry NAVs, stats and directories.",
    links: [
      {
        title: "MUFAP Daily Industry Stats",
        description: "Daily mutual fund industry statistics from MUFAP.",
        href: "https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=1",
        category: "Funds",
        official: true,
      },
      {
        title: "MUFAP Fund Directory",
        description: "Directory of mutual funds and fund profiles.",
        href: "https://www.mufap.com.pk/FundProfile/FundDirectory",
        category: "Funds",
        official: true,
      },
      {
        title: "Stockli Mutual Funds",
        description: "Browse mutual funds inside Stockli.",
        href: "/market/mutual-funds",
        category: "Funds",
      },
      {
        title: "Stockli Funds Breakdown",
        description: "Fund holdings and breakdown tools on Stockli.",
        href: "/market/funds-breakdown",
        category: "Funds",
      },
    ],
  },
  {
    title: "Market analysis tools",
    description: "PSX charts, research screens and announcement portals.",
    links: [
      {
        title: "PSX Data Portal",
        description: "Official DPS announcements and company filings.",
        href: "https://dps.psx.com.pk/",
        category: "Analysis",
        official: true,
      },
      {
        title: "AskAnalyst",
        description: "Pakistan equity research and analysis site.",
        href: "https://askanalyst.com.pk/",
        category: "Analysis",
      },
      {
        title: "SCS Trade",
        description: "Market statistics including board meetings and book closures.",
        href: "https://scstrade.com/",
        category: "Analysis",
      },
      {
        title: "TradingView KSE-100",
        description: "Interactive KSE-100 chart and technical tools.",
        href: "https://www.tradingview.com/symbols/PSX-KSE100/",
        category: "Analysis",
      },
      {
        title: "Investing.com KSE-100",
        description: "KSE-100 quotes, news and historical data.",
        href: "https://www.investing.com/indices/karachi-100",
        category: "Analysis",
      },
      {
        title: "Stockli Pivot Points",
        description: "Classic floor pivots for PSX symbols on Stockli.",
        href: "/analysis/pivot-points",
        category: "Analysis",
      },
    ],
  },
  {
    title: "Corporate actions",
    description: "Board meetings, book closures and dividend schedules for PSX names.",
    links: [
      {
        title: "Board Meetings (Stockli)",
        description: "Upcoming and recent PSX board meeting schedule.",
        href: "/explore/board-meetings",
        category: "Corporate",
      },
      {
        title: "Book Closures (Stockli)",
        description: "Book-closure / entitlement dates for listed companies.",
        href: "/explore/book-closures",
        category: "Corporate",
      },
      {
        title: "Dividend History (Stockli)",
        description: "Recent dividend payout history for PSX symbols.",
        href: "/explore/dividend-history",
        category: "Corporate",
      },
    ],
  },
  {
    title: "Rating agencies",
    description: "Sector research and entity ratings from Pakistan credit rating agencies.",
    links: [
      {
        title: "PACRA Research",
        description: "Sector research across Pakistan's economy.",
        href: "https://www.pacra.com/research",
        category: "Ratings",
      },
      {
        title: "PACRA Ratings",
        description: "Latest rating reports for public and private companies.",
        href: "https://www.pacra.com/rating_resources_new",
        category: "Ratings",
      },
      {
        title: "VIS Credit Rating",
        description: "VIS homepage — recent ratings and sector reports.",
        href: "https://vis.com.pk/",
        category: "Ratings",
      },
      {
        title: "VIS Document Library",
        description: "Published VIS rating and sector report documents.",
        href: "https://docs.vis.com.pk/",
        category: "Ratings",
      },
    ],
  },
];

/**
 * Curated PSX / Pakistan investor links.
 * Kept as a static catalog (not scraped) so the page stays reliable when
 * third-party blogs or association sites change layout.
 */
export async function getUsefulLinksData(): Promise<UsefulLinksData> {
  return {
    updatedAt: new Date().toISOString(),
    sourceUrl: "",
    groups: CURATED_USEFUL_LINK_GROUPS,
  };
}


export async function getBoardMeetingsData(): Promise<BoardMeetingsData> {
  try {
    const cached = await getStaleCached({
      key: "explore:board-meetings:v4",
      ttlSeconds: DAILY_TTL_SECONDS,
      staleSeconds: DAILY_STALE_SECONDS,
      load: loadBoardMeetingsData,
      isUsable: (data) => data.rows.length > 0,
    });
    return cached.value;
  } catch (error) {
    softWarnResource("board meetings unavailable", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionPublicData<BoardMeetingsData>({
        path: "/api/public/board-meetings",
        refererPath: "/explore/board-meetings",
        isUsable: (data) => Boolean(data?.rows?.length),
        label: "board-meetings",
      });
      if (remote?.rows.length) return remote;
    }
    return emptyBoardMeetingsData();
  }
}

export async function getBookClosuresData(): Promise<BookClosuresData> {
  try {
    const cached = await getStaleCached({
      key: "explore:book-closures:v3",
      ttlSeconds: DAILY_TTL_SECONDS,
      staleSeconds: DAILY_STALE_SECONDS,
      load: loadBookClosuresData,
      isUsable: (data) => data.rows.length > 0,
    });
    return cached.value;
  } catch (error) {
    softWarnResource("book closures unavailable", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionPublicData<BookClosuresData>({
        path: "/api/public/book-closures",
        refererPath: "/explore/book-closures",
        isUsable: (data) => Boolean(data?.rows?.length),
        label: "book-closures",
      });
      if (remote?.rows.length) return remote;
    }
    return emptyBookClosuresData();
  }
}

export async function getDividendHistoryData(): Promise<DividendHistoryData> {
  try {
    const cached = await getStaleCached({
      key: "explore:dividend-history:v2",
      ttlSeconds: DAILY_TTL_SECONDS,
      staleSeconds: DAILY_STALE_SECONDS,
      load: loadDividendHistoryData,
      isUsable: (data) => data.rows.length > 0,
    });
    return cached.value;
  } catch (error) {
    softWarnResource("dividend history unavailable", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionPublicData<DividendHistoryData>({
        path: "/api/public/dividend-history",
        refererPath: "/explore/dividend-history",
        isUsable: (data) => Boolean(data?.rows?.length),
        label: "dividend-history",
      });
      if (remote?.rows.length) return remote;
    }
    return emptyDividendHistoryData();
  }
}

export async function getPivotPointsData(): Promise<PivotPointsData> {
  const ttlSeconds = shouldRefreshPsxData() ? 60 : psxLiveCacheTtlSeconds();
  const cached = await getStaleCached({
    key: "analysis:pivot-points:v1",
    ttlSeconds,
    staleSeconds: psxClosedMaxStaleSeconds(),
    load: loadPivotPointsData,
    isUsable: (data) => data.rows.length > 0,
  });
  return cached.value;
}

async function loadBoardMeetingsData(): Promise<BoardMeetingsData> {
  const [primaryRows, fallbackHtml] = await Promise.all([
    tryLoadSscBoardMeetings(),
    tryFetchSource(SOURCES.boardMeetingsFallback),
  ]);

  if (primaryRows.length > 0) {
    return {
      rows: primaryRows,
      updatedAt: new Date().toISOString(),
      sourceUrl: SOURCES.boardMeetingsPrimary,
      sourceLabel: "SCS Trade",
    };
  }

  const rows = fallbackHtml ? parseBoardMeetingsTables(fallbackHtml, "KSE Stocks") : [];
  return {
    rows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.boardMeetingsFallback,
    sourceLabel: "KSE Stocks",
  };
}

async function tryLoadSscBoardMeetings(): Promise<BoardMeetingRow[]> {
  try {
    const payload = await fetchJson<{ d?: SscBoardMeetingRaw[] }>(
      `${SOURCES.boardMeetingsPrimary}/chartact`,
      {
        _search: false,
        nd: Date.now(),
        rows: 500,
        page: 1,
        sidx: "bm_date",
        sord: "asc",
        par: "",
      }
    );
    return (payload.d ?? [])
      .map((row) => {
        const symbol = clean(row.company_code).toUpperCase();
        const company = clean(row.company_name) || symbol;
        const meetingDate = normalizeMicrosoftJsonDate(row.bm_date);
        if (!company || !meetingDate) return null;
        const period = [clean(row.bm_quarter_number), clean(row.bm_year)].filter(Boolean).join(" ");
        const place = clean(row.bm_place);
        return {
          id: makeId("SCS Trade", symbol, meetingDate, row.bm_time, period),
          symbol: symbol || null,
          company,
          meetingDate,
          meetingTime: clean(row.bm_time) || "—",
          subject: period
            ? `Board meeting · ${period}`
            : place
              ? `Board meeting · ${place}`
              : "Board meeting",
          sourceLabel: "SCS Trade",
        } satisfies BoardMeetingRow;
      })
      .filter((row): row is BoardMeetingRow => Boolean(row));
  } catch (error) {
    softWarnResource("SCS board meetings failed", error);
    return [];
  }
}

async function loadBookClosuresData(): Promise<BookClosuresData> {
  const [primaryRows, fallbackHtml] = await Promise.all([
    tryLoadSscBookClosures(),
    tryFetchSource(SOURCES.bookClosuresFallback),
  ]);

  if (primaryRows.length > 0) {
    return {
      rows: primaryRows,
      updatedAt: new Date().toISOString(),
      sourceUrl: SOURCES.bookClosuresPrimary,
      sourceLabel: "SCS Trade",
    };
  }

  const rows = fallbackHtml ? parseKseBookClosures(fallbackHtml) : [];
  return {
    rows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.bookClosuresFallback,
    sourceLabel: "KSE Stocks",
  };
}

async function loadDividendHistoryData(): Promise<DividendHistoryData> {
  // KSE Stocks only — do not scrape dps.psx.com.pk for payout history.
  const html = await tryFetchSource(SOURCES.dividendPrimary);
  const rows = html ? parseDividendTables(html, "KSE Stocks") : [];
  return {
    rows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.dividendPrimary,
    sourceLabel: "KSE Stocks",
  };
}

async function loadPivotPointsData(): Promise<PivotPointsData> {
  const rows = await getMarketRows();
  const pivotRows = rows
    .map((row): PivotPointRow | null => {
      const high = numberOrNull(row.high);
      const low = numberOrNull(row.low);
      const previousClose = numberOrNull(row.ldcp);
      if (high == null || low == null || previousClose == null || high <= 0 || low <= 0) {
        return null;
      }
      const pivot = (high + low + previousClose) / 3;
      const range = high - low;
      const seed = getSeedTicker(row.symbol);
      return {
        symbol: row.symbol,
        companyName: seed?.company ?? row.symbol,
        sector: row.sector ?? seed?.sector ?? "Other",
        current: row.current,
        high,
        low,
        previousClose,
        pivot,
        r1: 2 * pivot - low,
        s1: 2 * pivot - high,
        r2: pivot + range,
        s2: pivot - range,
        r3: high + 2 * (pivot - low),
        s3: low - 2 * (high - pivot),
        range,
        capturedAt: row.capturedAt ?? null,
      };
    })
    .filter((row): row is PivotPointRow => Boolean(row))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    rows: pivotRows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.pivotReference,
    sourceLabel: "MyStockli calculation",
    method: "Classic floor pivots from latest session high, low and previous close.",
  };
}

async function fetchSource(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function tryFetchSource(url: string): Promise<string | null> {
  try {
    return await fetchSource(url);
  } catch (error) {
    softWarnResource(`fetch failed for ${url}`, error);
    return null;
  }
}

function parseBoardMeetingsTables(html: string, sourceLabel: string): BoardMeetingRow[] {
  const tables = parseHtmlTables(html);
  const rows: BoardMeetingRow[] = [];
  for (const table of tables) {
    const header = table[0]?.map(normalizeHeader) ?? [];
    if (!header.includes("company") || !header.includes("date")) continue;
    const dateIndex = findHeaderIndex(header, ["date", "meetingdate"]);
    const timeIndex = findHeaderIndex(header, ["time", "meetingtime"]);
    const companyIndex = findHeaderIndex(header, ["company", "companyname"]);
    const subjectIndex = findHeaderIndex(header, ["subject", "agenda", "purpose"]);
    if (dateIndex < 0 || companyIndex < 0) continue;

    for (const cells of table.slice(1)) {
      const company = clean(cells[companyIndex]);
      const meetingDate = normalizeLooseDate(cells[dateIndex]);
      if (!company || !meetingDate) continue;
      const meetingTime = clean(cells[timeIndex]) || "—";
      const subject = clean(cells[subjectIndex]) || "Board meeting";
      rows.push({
        id: makeId(sourceLabel, company, meetingDate, meetingTime, subject),
        symbol: extractSymbol(company),
        company,
        meetingDate,
        meetingTime,
        subject,
        sourceLabel,
      });
    }
  }
  return rows;
}

async function tryLoadSscBookClosures(): Promise<BookClosureRow[]> {
  try {
    const payload = await fetchJson<{ d?: SscBookClosureRaw[] }>(
      `${SOURCES.bookClosuresPrimary}/chartact`,
      {
        _search: false,
        nd: Date.now(),
        rows: 300,
        page: 1,
        sidx: "bm_bc_exp",
        sord: "asc",
        par: "",
      }
    );
    return (payload.d ?? [])
      .map((row) => {
        const payout = [
          clean(row.bm_dividend) ? `Dividend ${clean(row.bm_dividend)}` : "",
          clean(row.bm_bonus) ? `Bonus ${clean(row.bm_bonus)}` : "",
          clean(row.bm_right_per) ? `Right ${clean(row.bm_right_per)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        if (!hasPayout(payout)) return null;
        const symbol = clean(row.company_code).toUpperCase();
        if (!symbol) return null;
        const xDate = normalizeLooseDate(row.bm_bc_exp);
        return {
          id: makeId("SCS Trade", symbol, xDate, payout),
          symbol,
          company: clean(row.company_name) || symbol,
          faceValue: "—",
          bookClosureFrom: xDate || "—",
          bookClosureTo: xDate || "—",
          payout,
          lastClose: "—",
          sourceLabel: "SCS Trade",
        } satisfies BookClosureRow;
      })
      .filter((row): row is BookClosureRow => Boolean(row));
  } catch (error) {
    softWarnResource("SCS book closures failed", error);
    return [];
  }
}

function parseKseBookClosures(html: string): BookClosureRow[] {
  const match = html.match(/var\s+bcs\s*=\s*(\{[\s\S]*?\});\s*\$\(function/);
  if (!match) return [];
  let payload: KseBookClosuresPayload;
  try {
    payload = JSON.parse(match[1]) as KseBookClosuresPayload;
  } catch {
    return [];
  }
  const rawRows = [...(payload.cur ?? []), ...(payload.old ?? [])];
  return rawRows
    .filter((row) => hasPayout(row.payout))
    .map((row) => ({
      id: makeId("KSE Stocks", row.symbol, row.bcfrom, row.bcto, row.payout),
      symbol: clean(row.symbol).toUpperCase(),
      company: clean(row.cname) || clean(row.symbol).toUpperCase(),
      faceValue: clean(row.faceval) || "—",
      bookClosureFrom: normalizeLooseDate(row.bcfrom),
      bookClosureTo: normalizeLooseDate(row.bcto),
      payout: clean(row.payout),
      lastClose: clean(row.lc) || "—",
      sourceLabel: "KSE Stocks",
    }));
}

function parseDividendTables(html: string, sourceLabel: string): DividendHistoryRow[] {
  const tables = parseHtmlTables(html);
  const rows: DividendHistoryRow[] = [];
  for (const table of tables) {
    const header = table[0]?.map(normalizeHeader) ?? [];
    const symbolIndex = findHeaderIndex(header, ["symbol", "code"]);
    const payoutIndex = findHeaderIndex(header, ["payout", "dividend"]);
    const creditedIndex = findHeaderIndex(header, ["creditedon", "credited", "paymentdate", "date"]);
    if (symbolIndex < 0 || payoutIndex < 0) continue;

    for (const cells of table.slice(1)) {
      const symbol = clean(cells[symbolIndex]).toUpperCase();
      const payout = clean(cells[payoutIndex]);
      if (!symbol || !hasPayout(payout)) continue;
      rows.push({
        id: makeId(sourceLabel, symbol, payout, cells[creditedIndex]),
        symbol,
        payout,
        creditedOn: normalizeLooseDate(cells[creditedIndex]) || "—",
        sourceLabel,
      });
    }
  }
  return rows;
}

function parseHtmlTables(html: string): string[][][] {
  const root = parse(html);
  return root.querySelectorAll("table").map((table) =>
    table.querySelectorAll("tr").map((row) =>
      row.querySelectorAll("th, td").map((cell) => clean(cell.textContent))
    )
  );
}

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) =>
    candidates.some((candidate) => header === candidate || header.includes(candidate))
  );
}

function normalizeLooseDate(value: unknown): string {
  const text = clean(value);
  if (!text || text === "—") return "";
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const compact = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{2,4})$/);
  if (!compact) return text;
  const day = compact[1].padStart(2, "0");
  const month = monthNumber(compact[2]);
  const rawYear = Number(compact[3]);
  const year = rawYear < 100 ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  return month ? `${year}-${month}-${day}` : text;
}

function normalizeMicrosoftJsonDate(value: unknown): string {
  const text = clean(value);
  const match = text.match(/\/Date\((-?\d+)\)\//);
  if (!match) return normalizeLooseDate(text);
  const date = new Date(Number(match[1]));
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PSX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthNumber(value: string): string | null {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return String(numeric).padStart(2, "0");
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index >= 0 ? String(index + 1).padStart(2, "0") : null;
}

function hasPayout(value: unknown): boolean {
  const text = clean(value);
  if (!text || /^nil$/i.test(text) || /^n\/a$/i.test(text) || text === "-") return false;
  return /dividend|bonus|right|cash|interim|final|%|rs\.?/i.test(text);
}

function extractSymbol(company: string): string | null {
  const match = company.match(/\(([A-Z0-9.-]{2,12})\)/);
  return match ? match[1] : null;
}

function makeId(...parts: unknown[]): string {
  return parts.map((part) => clean(part).toLowerCase().replace(/[^a-z0-9]+/g, "-")).join(":");
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function emptyBoardMeetingsData(): BoardMeetingsData {
  return {
    rows: [],
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.boardMeetingsFallback,
    sourceLabel: "KSE Stocks",
  };
}

function emptyBookClosuresData(): BookClosuresData {
  return {
    rows: [],
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.bookClosuresFallback,
    sourceLabel: "KSE Stocks",
  };
}

function emptyDividendHistoryData(): DividendHistoryData {
  return {
    rows: [],
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.dividendFallback,
    sourceLabel: "KSE Stocks",
  };
}

/** Detect DNS / connectivity / timeout failures (including undici `fetch failed` wrappers). */
function isNetworkOrDnsFailure(error: unknown): boolean {
  const text = describeFetchError(error);
  return /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|AbortError|TimeoutError|fetch failed|aborted/i.test(
    text
  );
}

/** One-line message only — never pass the Error object (avoids Next dumping stacks). */
function softWarnResource(context: string, error: unknown): void {
  const detail = describeFetchError(error);
  const suffix = isNetworkOrDnsFailure(error) ? " (network)" : "";
  console.warn(`[resources] ${context}${suffix}: ${detail}`);
}

function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error ?? "unknown error");

  const code =
    typeof (error as NodeJS.ErrnoException).code === "string"
      ? (error as NodeJS.ErrnoException).code
      : undefined;
  const cause = (error as Error & { cause?: unknown }).cause;

  if (cause instanceof Error) {
    const causeCode =
      typeof (cause as NodeJS.ErrnoException).code === "string"
        ? (cause as NodeJS.ErrnoException).code
        : undefined;
    if (causeCode) return `${error.message} (${causeCode}: ${cause.message})`;
    return `${error.message}: ${cause.message}`;
  }

  if (code) return `${error.message} (${code})`;
  if (error.name && error.name !== "Error") return `${error.name}: ${error.message}`;
  return error.message;
}
