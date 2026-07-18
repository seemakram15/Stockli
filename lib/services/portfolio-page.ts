import "server-only";
import { buildPortfolioView, enrichHoldings, getPortfolioViewRaw } from "@/lib/services/portfolio";
import { getQuotes } from "@/lib/services/prices";
import { getPortfolioCalendar, type StockCalendar } from "@/lib/services/daily-pl";
import { marketStatus } from "@/lib/psx/market-hours";
import { getBookClosuresData } from "@/lib/services/market-resources";
import { getDividendIncomeForPortfolio } from "@/lib/services/dividend-income";
import { defaultTaxSettings, taxSettingsFromProfile } from "@/lib/services/tax";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioWithMetrics, TaxSettings, DividendIncomeSummary, CdcDividend, ReceivedDividend } from "@/lib/types";

export interface PortfolioPageData {
  portfolio: PortfolioWithMetrics;
  calendar: StockCalendar | null;
  quoteBySymbol: Record<string, number | null>;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

const EMPTY_DIVIDEND_SUMMARY: DividendIncomeSummary = {
  received: [],
  upcoming: [],
  totalGross: 0,
  totalWHT: 0,
  totalZakat: 0,
  totalNet: 0,
};

export async function getPortfolioPageData(id: string): Promise<PortfolioPageData | null> {
  const raw = await getPortfolioViewRaw(id);
  if (!raw) return null;

  const [enriched, calendar, taxSettings, bookClosureData, cdcRows] = await Promise.all([
    enrichHoldings(raw.holdings, raw.transactions),
    raw.holdings.length
      ? getPortfolioCalendar(raw.holdings, raw.transactions)
      : Promise.resolve(null),
    fetchTaxSettings(),
    getBookClosuresData(),
    fetchCdcDividends(id),
  ]);

  const dividendIncome: DividendIncomeSummary =
    cdcRows.length > 0
      ? buildCdcSummary(cdcRows, bookClosureData.rows, raw.holdings)
      : raw.transactions.length > 0
        ? getDividendIncomeForPortfolio(
            raw.transactions,
            [],
            bookClosureData.rows,
            raw.holdings,
            taxSettings
          )
        : EMPTY_DIVIDEND_SUMMARY;

  const portfolioBase = buildPortfolioView(raw.portfolio, enriched, raw.transactions);
  const portfolio: PortfolioWithMetrics = {
    ...portfolioBase,
    dividendIncome,
    taxSettings,
  };

  const quoteBySymbol = await buildQuoteBySymbol(portfolio);

  return {
    portfolio,
    calendar,
    quoteBySymbol,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchCdcDividends(portfolioId: string): Promise<CdcDividend[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("cdc_dividends")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .order("payment_date", { ascending: false });
    return (data as CdcDividend[]) ?? [];
  } catch {
    return [];
  }
}

function buildCdcSummary(
  cdcRows: CdcDividend[],
  bookClosures: import("@/lib/services/market-resources").BookClosureRow[],
  currentHoldings: import("@/lib/types").Holding[]
): DividendIncomeSummary {
  const received: ReceivedDividend[] = cdcRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    companyName: r.company_name,
    creditedOn: r.payment_date,
    perShare: Number(r.rate_per_security),
    quantityHeld: Number(r.no_of_securities),
    grossAmount: Number(r.gross_amount),
    whtAmount: Number(r.tax_deducted),
    zakatAmount: Number(r.zakat_deducted),
    netAmount: Number(r.net_amount),
    financialYear: r.financial_year ?? undefined,
    warranNo: r.warrant_no ?? undefined,
  }));

  const heldSymbols = new Set(currentHoldings.map((h) => h.symbol.toUpperCase()));
  const today = new Date().toISOString().split("T")[0];
  const upcoming = bookClosures
    .filter((bc) => {
      if (!heldSymbols.has(bc.symbol.toUpperCase()) || !bc.payout) return false;
      const from = bc.bookClosureFrom;
      return !from || from === "—" || from >= today;
    })
    .map((bc) => {
      const holding = currentHoldings.find(
        (h) => h.symbol.toUpperCase() === bc.symbol.toUpperCase()
      );
      return {
        symbol: bc.symbol.toUpperCase(),
        company: bc.company,
        payout: bc.payout,
        bookClosureFrom: bc.bookClosureFrom,
        bookClosureTo: bc.bookClosureTo,
        currentQty: Number(holding?.quantity ?? 0),
      };
    });

  return {
    received,
    upcoming,
    totalGross: received.reduce((s, r) => s + r.grossAmount, 0),
    totalWHT: received.reduce((s, r) => s + r.whtAmount, 0),
    totalZakat: received.reduce((s, r) => s + r.zakatAmount, 0),
    totalNet: received.reduce((s, r) => s + r.netAmount, 0),
  };
}

async function fetchTaxSettings(): Promise<TaxSettings> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return defaultTaxSettings();

    const { data } = await supabase
      .from("profiles")
      .select("tax_filer, broker_fee_pct, zakat_on_dividends, cgt_rate_override")
      .eq("id", user.id)
      .single();

    if (!data) return defaultTaxSettings();
    return taxSettingsFromProfile(data);
  } catch {
    return defaultTaxSettings();
  }
}

async function buildQuoteBySymbol(portfolio: PortfolioWithMetrics) {
  const symbols = Array.from(
    new Set(portfolio.transactions.map((transaction) => transaction.symbol.toUpperCase()).filter(Boolean))
  );

  if (symbols.length === 0) {
    return {};
  }

  const priceBySymbol = new Map<string, number | null>(
    portfolio.holdings.map((holding) => [
      holding.symbol.toUpperCase(),
      Number.isFinite(holding.livePrice) ? holding.livePrice : null,
    ])
  );
  const missingSymbols = symbols.filter((symbol) => priceBySymbol.get(symbol) == null);

  if (missingSymbols.length > 0) {
    const quotes = await getQuotes(missingSymbols);
    for (const symbol of missingSymbols) {
      priceBySymbol.set(symbol, quotes.get(symbol)?.price ?? null);
    }
  }

  return Object.fromEntries(symbols.map((symbol) => [symbol, priceBySymbol.get(symbol) ?? null]));
}
