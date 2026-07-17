import "server-only";
import { buildPortfolioView, enrichHoldings, getPortfolioViewRaw } from "@/lib/services/portfolio";
import { getQuotes } from "@/lib/services/prices";
import { getPortfolioCalendar, type StockCalendar } from "@/lib/services/daily-pl";
import { marketStatus } from "@/lib/psx/market-hours";
import { getDividendHistoryData, getBookClosuresData } from "@/lib/services/market-resources";
import { getDividendIncomeForPortfolio } from "@/lib/services/dividend-income";
import { defaultTaxSettings, taxSettingsFromProfile } from "@/lib/services/tax";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioWithMetrics, TaxSettings, DividendIncomeSummary } from "@/lib/types";

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

  const [enriched, calendar, taxSettings, dividendData, bookClosureData] = await Promise.all([
    enrichHoldings(raw.holdings, raw.transactions),
    raw.holdings.length
      ? getPortfolioCalendar(raw.holdings, raw.transactions)
      : Promise.resolve(null),
    fetchTaxSettings(),
    getDividendHistoryData(),
    getBookClosuresData(),
  ]);

  const dividendIncome =
    raw.transactions.length > 0
      ? getDividendIncomeForPortfolio(
          raw.transactions,
          dividendData.rows,
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
