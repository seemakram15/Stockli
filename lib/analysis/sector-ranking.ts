import {
  buildAnalyzerSummary,
  getFiftyTwoWeekRange,
  latestMetric,
  latestValueFromRows,
  type AnalyzerFactor,
  type AnalyzerSummary,
  type StockAnalyzerQuote,
} from "@/lib/analysis/stock-analyzer";
import {
  SECTOR_DOCUMENT_RULES,
  type SectorDocumentDirection,
  type SectorDocumentParameter,
  type SectorDocumentRule,
} from "@/lib/analysis/sector-ranking-document";
import { formatCompact, formatMarketPrice, formatNumber } from "@/lib/format";
import type { MarketWatchRow } from "@/lib/types";
import type { StockFinancialsData } from "@/lib/types/stock-fundamentals";

export type SectorMetricFormat =
  | "percent"
  | "multiple"
  | "days"
  | "currency"
  | "compact"
  | "number"
  | "score";

export type SectorMetricValue = SectorDocumentParameter & {
  format: SectorMetricFormat;
  value: number | null;
  displayValue: string;
  percentileScore: number | null;
  available: boolean;
};

export type SectorCategoryScore = {
  category: string;
  score: number;
};

export type SectorLeaderStock = {
  symbol: string;
  name: string;
  sector: string;
  ruleName: string;
  ruleSource: "exact" | "alias" | "fallback";
  currentPrice: number | null;
  changePct: number | null;
  marketCap: number | null;
  totalScore: number;
  analyzerScore: number;
  qualityScore: number;
  cashScore: number;
  balanceScore: number;
  valuationScore: number;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  priceReturn1Y: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  metricsAvailable: number;
  metrics: SectorMetricValue[];
  strongestMetrics: string[];
  weakestMetrics: string[];
  categoryScores: SectorCategoryScore[];
};

export type SectorLeaderboard = {
  key: string;
  sector: string;
  ruleName: string;
  ruleSource: "exact" | "alias" | "fallback";
  updatedAt: string;
  stockCount: number;
  averageScore: number;
  leaderSymbol: string | null;
  leaderName: string | null;
  parametersReady: number;
  categories: SectorCategoryScore[];
  stocks: SectorLeaderStock[];
};

export type SectorLeadersDataset = {
  updatedAt: string;
  totalStocks: number;
  totalSectors: number;
  sectors: Array<{
    key: string;
    sector: string;
    ruleName: string;
    stockCount: number;
    averageScore: number;
    leaderSymbol: string | null;
    leaderName: string | null;
    parametersReady: number;
  }>;
  leaderboards: SectorLeaderboard[];
};

export type SectorFinancialRecord = {
  symbol: string;
  storedAt: string;
  data: StockFinancialsData;
};

type SectorRuleResolution = {
  key: string;
  sector: string;
  rule: SectorDocumentRule;
  source: "exact" | "alias" | "fallback";
};

type MetricContext = {
  data: StockFinancialsData;
  quote: MarketWatchRow | null;
  summary: AnalyzerSummary;
  factorMap: Map<string, AnalyzerFactor>;
  currentPrice: number | null;
  marketCap: number | null;
  sales: number | null;
  totalIncome: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  netProfit: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  totalAssets: number | null;
  totalEquity: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  tradeDebts: number | null;
  inventory: number | null;
  costOfSales: number | null;
  totalDebt: number | null;
  cash: number | null;
  shortTermInvestments: number | null;
  financialCharges: number | null;
  otherIncome: number | null;
  depreciation: number | null;
  investmentIncome: number | null;
  advances: number | null;
  totalPremium: number | null;
  sharesOutstanding: number | null;
  week52Low: number | null;
  week52High: number | null;
};

const RULE_BY_NAME = new Map(
  SECTOR_DOCUMENT_RULES.map((rule) => [normalizeSectorKey(rule.name), rule] as const)
);

const FALLBACK_RULE = RULE_BY_NAME.get(normalizeSectorKey("Miscellaneous"));

const SECTOR_ALIASES: Record<string, string> = {
  [normalizeSectorKey("Paper & Board")]: "Paper, Board & Packaging",
  [normalizeSectorKey("Textile Weaving")]: "Textile Composite",
  [normalizeSectorKey("Woollen")]: "Textile Composite",
  [normalizeSectorKey("Jute")]: "Textile Composite",
  [normalizeSectorKey("Synthetic & Rayon")]: "Textile Composite",
  [normalizeSectorKey("Vanaspati & Allied Industries")]: "Food & Personal Care Products",
};

export function buildSectorLeadersDataset({
  records,
  marketRows,
}: {
  records: SectorFinancialRecord[];
  marketRows: MarketWatchRow[];
}): SectorLeadersDataset {
  const quoteMap = new Map(marketRows.map((row) => [row.symbol.toUpperCase(), row]));
  const grouped = new Map<string, Array<{ ctx: MetricContext; resolution: SectorRuleResolution }>>();

  records.forEach((record) => {
    const companySector = record.data.company?.sector ?? quoteMap.get(record.symbol)?.sector ?? "Unknown";
    const resolution = resolveSectorRule(companySector);
    if (!resolution) return;

    const ctx = buildMetricContext(record.data, quoteMap.get(record.symbol) ?? null);
    const bucket = grouped.get(resolution.key) ?? [];
    bucket.push({ ctx, resolution });
    grouped.set(resolution.key, bucket);
  });

  const leaderboards: SectorLeaderboard[] = [];
  [...grouped.entries()].forEach(([key, items]) => {
    const board = buildSectorLeaderboard(key, items);
    if (board) leaderboards.push(board);
  });
  leaderboards.sort((left, right) => left.sector.localeCompare(right.sector));

  return {
    updatedAt: new Date().toISOString(),
    totalStocks: leaderboards.reduce((sum, board) => sum + board.stockCount, 0),
    totalSectors: leaderboards.length,
    sectors: leaderboards.map((board) => ({
      key: board.key,
      sector: board.sector,
      ruleName: board.ruleName,
      stockCount: board.stockCount,
      averageScore: board.averageScore,
      leaderSymbol: board.leaderSymbol,
      leaderName: board.leaderName,
      parametersReady: board.parametersReady,
    })),
    leaderboards,
  };
}

export function getMetricScoreByLabel(stock: SectorLeaderStock, label: string) {
  return stock.metrics.find((metric) => metric.label === label)?.percentileScore ?? null;
}

export function getMetricValueByLabel(stock: SectorLeaderStock, label: string) {
  return stock.metrics.find((metric) => metric.label === label)?.value ?? null;
}

export function findSectorLeaderboard(
  dataset: SectorLeadersDataset,
  key: string
) {
  return dataset.leaderboards.find((board) => board.key === key) ?? null;
}

function buildSectorLeaderboard(
  key: string,
  items: Array<{ ctx: MetricContext; resolution: SectorRuleResolution }>
) {
  if (!items.length) return null;

  const resolution = items[0]?.resolution;
  if (!resolution) return null;

  const stockMetrics = items.map(({ ctx }) => ({
    ctx,
    metrics: resolution.rule.parameters.map((parameter) => ({
      ...parameter,
      format: inferMetricFormat(parameter.label),
      value: computeMetricValue(ctx, parameter.label),
      displayValue: "—",
      percentileScore: null,
      available: false,
    })) as SectorMetricValue[],
  }));

  resolution.rule.parameters.forEach((parameter, index) => {
    const scores = buildPercentileScores(
      stockMetrics.map((stock) => ({
        symbol: stock.ctx.summary.symbol,
        value: stock.metrics[index]?.value ?? null,
      })),
      parameter.direction
    );

    stockMetrics.forEach((stock) => {
      const metric = stock.metrics[index];
      if (!metric) return;
      const percentileScore = scores.get(stock.ctx.summary.symbol) ?? null;
      metric.percentileScore = percentileScore;
      metric.displayValue = formatSectorMetric(metric.value, metric.format);
      metric.available = metric.value != null && percentileScore != null;
    });
  });

  const stocks = stockMetrics
    .map(({ ctx, metrics }) => buildSectorStock(ctx, resolution, metrics))
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore;
      if (right.metricsAvailable !== left.metricsAvailable) {
        return right.metricsAvailable - left.metricsAvailable;
      }
      if (right.analyzerScore !== left.analyzerScore) return right.analyzerScore - left.analyzerScore;
      return (right.changePct ?? 0) - (left.changePct ?? 0);
    });

  const categories = summarizeCategories(stocks);
  const averageScore = stocks.length
    ? Math.round(stocks.reduce((sum, stock) => sum + stock.totalScore, 0) / stocks.length)
    : 0;

  return {
    key,
    sector: resolution.sector,
    ruleName: resolution.rule.name,
    ruleSource: resolution.source,
    updatedAt: new Date().toISOString(),
    stockCount: stocks.length,
    averageScore,
    leaderSymbol: stocks[0]?.symbol ?? null,
    leaderName: stocks[0]?.name ?? null,
    parametersReady: resolution.rule.parameters.length,
    categories,
    stocks,
  } satisfies SectorLeaderboard;
}

function buildSectorStock(
  ctx: MetricContext,
  resolution: SectorRuleResolution,
  metrics: SectorMetricValue[]
) {
  const availableMetrics = metrics.filter((metric) => metric.percentileScore != null);
  const totalScore = availableMetrics.length
    ? Math.round(
        availableMetrics.reduce((sum, metric) => sum + (metric.percentileScore ?? 0), 0) /
          availableMetrics.length
      )
    : 0;
  const sortedMetrics = [...availableMetrics].sort(
    (left, right) => (right.percentileScore ?? 0) - (left.percentileScore ?? 0)
  );
  const strongestMetrics = sortedMetrics.slice(0, 3).map((metric) => metric.label);
  const weakestMetrics = [...sortedMetrics]
    .reverse()
    .slice(0, 2)
    .map((metric) => metric.label);

  return {
    symbol: ctx.summary.symbol,
    name: ctx.summary.name,
    sector: resolution.sector,
    ruleName: resolution.rule.name,
    ruleSource: resolution.source,
    currentPrice: ctx.currentPrice,
    changePct: ctx.quote?.changePct ?? null,
    marketCap: ctx.marketCap,
    totalScore,
    analyzerScore: ctx.summary.totalScore,
    qualityScore: pickCategoryScore(ctx.summary, "Business quality"),
    cashScore: pickCategoryScore(ctx.summary, "Cash flow"),
    balanceScore: pickCategoryScore(ctx.summary, "Balance sheet"),
    valuationScore: pickCategoryScore(ctx.summary, "Valuation"),
    revenueGrowth: ctx.summary.revenueGrowth,
    epsGrowth: ctx.summary.epsGrowth,
    priceReturn1Y: ctx.summary.priceReturn1Y,
    dividendYield: ctx.summary.dividendYield,
    payoutRatio: ctx.summary.payoutRatio,
    metricsAvailable: availableMetrics.length,
    metrics,
    strongestMetrics,
    weakestMetrics,
    categoryScores: summarizeStockCategories(metrics),
  } satisfies SectorLeaderStock;
}

function summarizeCategories(stocks: SectorLeaderStock[]) {
  const categoryMap = new Map<string, number[]>();
  stocks.forEach((stock) => {
    stock.categoryScores.forEach((category) => {
      const values = categoryMap.get(category.category) ?? [];
      values.push(category.score);
      categoryMap.set(category.category, values);
    });
  });

  return [...categoryMap.entries()]
    .map(([category, values]) => ({
      category,
      score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => right.score - left.score);
}

function summarizeStockCategories(metrics: SectorMetricValue[]) {
  const map = new Map<string, number[]>();
  metrics.forEach((metric) => {
    if (metric.percentileScore == null) return;
    const values = map.get(metric.category) ?? [];
    values.push(metric.percentileScore);
    map.set(metric.category, values);
  });

  return [...map.entries()]
    .map(([category, values]) => ({
      category,
      score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => right.score - left.score);
}

function buildMetricContext(data: StockFinancialsData, quote: MarketWatchRow | null): MetricContext {
  const summary = buildAnalyzerSummary(data, quote as StockAnalyzerQuote | null);
  const factorMap = new Map(summary.factors.map((factor) => [factor.label, factor]));
  const currentPrice =
    quote?.current ??
    latestValueFromRows(data, [/current price/i, /^close/i, /^market price/i]);
  const marketCap = summary.marketCap;
  const sales = latestMetric(data, [/^net sales$/i, /^sales$/i, /^revenue$/i]);
  const totalIncome = latestMetric(data, [/^total income$/i, /interest revenue/i, /net premium/i]);
  const grossProfit = latestMetric(data, [/^gross profit$/i]);
  const operatingProfit = latestMetric(data, [/^operating profit$/i, /^operating income$/i]);
  const netProfit = firstNonNull(
    latestMetric(data, [/profit after tax a\/t company owners/i]),
    latestMetric(data, [/^profit after tax$/i, /^net income$/i])
  );
  const operatingCashFlow = firstNonNull(
    latestMetric(data, [/^operating cash flow$/i]),
    latestMetric(data, [/cash generated from operations/i])
  );
  const capex = latestMetric(data, [/^capex$/i, /capital expenditure/i]);
  const totalAssets = latestMetric(data, [/^total assets$/i]);
  const totalEquity = firstNonNull(
    latestMetric(data, [/^total equity a\/t to holding company$/i]),
    latestMetric(data, [/^total equity$/i])
  );
  const currentAssets = latestMetric(data, [/^total current assets$/i]);
  const currentLiabilities = latestMetric(data, [/^total current liabilities$/i]);
  const tradeDebts = latestMetric(data, [/^trade debts$/i, /^accounts receivable$/i]);
  const inventory = latestMetric(data, [/^stock in trade$/i, /^inventories$/i, /^inventory$/i]);
  const costOfSales = latestMetric(data, [/^cost of sales$/i, /^cost of goods sold$/i]);
  const cash = firstNonNull(
    latestMetric(data, [/^cash & bank balances$/i]),
    latestMetric(data, [/cash and balances with treasury banks/i]),
    latestMetric(data, [/^cash$/i])
  );
  const shortTermInvestments = firstNonNull(
    latestMetric(data, [/^short term investments$/i]),
    latestMetric(data, [/^investments$/i])
  );
  const financialCharges = firstNonNull(
    latestMetric(data, [/^financial charges$/i]),
    latestMetric(data, [/^interest expense$/i])
  );
  const otherIncome = latestMetric(data, [/^other income$/i, /non-operating income/i]);
  const depreciation = latestMetric(data, [/^depreciation & amortisation$/i, /^depreciation$/i]);
  const investmentIncome = latestMetric(
    data,
    [/^investment income$/i, /^income from investments$/i, /^finance income$/i]
  );
  const advances = latestMetric(data, [/^advances$/i]);
  const totalPremium = latestMetric(data, [/^net premium$/i, /^gross premium$/i]);

  const totalDebt = firstNonNull(
    latestMetric(data, [/^total debt$/i]),
    sumNullable(
      latestMetric(data, [/^short-term debt$/i]),
      latestMetric(data, [/^current portion of long-term debt$/i]),
      latestMetric(data, [/^long-term debt$/i]),
      latestMetric(data, [/^borrowings$/i])
    )
  );

  const week52 = getFiftyTwoWeekRange(data);
  const week52Low = firstNonNull(week52.low, quote?.low ?? null);
  const week52High = firstNonNull(week52.high, quote?.high ?? null);
  const sharesOutstanding =
    currentPrice != null && currentPrice > 0 && marketCap != null && marketCap > 0
      ? marketCap / currentPrice
      : null;

  return {
    data,
    quote,
    summary,
    factorMap,
    currentPrice,
    marketCap,
    sales,
    totalIncome,
    grossProfit,
    operatingProfit,
    netProfit,
    operatingCashFlow,
    capex,
    totalAssets,
    totalEquity,
    currentAssets,
    currentLiabilities,
    tradeDebts,
    inventory,
    costOfSales,
    totalDebt,
    cash,
    shortTermInvestments,
    financialCharges,
    otherIncome,
    depreciation,
    investmentIncome,
    advances,
    totalPremium,
    sharesOutstanding,
    week52Low,
    week52High,
  };
}

function resolveSectorRule(rawSector: string | null | undefined): SectorRuleResolution | null {
  const sector = rawSector?.trim() || "Unknown";
  const normalized = normalizeSectorKey(sector);
  const exactRule = RULE_BY_NAME.get(normalized);
  if (exactRule) {
    return {
      key: normalized,
      sector,
      rule: exactRule,
      source: "exact",
    };
  }

  const aliasName = SECTOR_ALIASES[normalized];
  const aliasRule = aliasName ? RULE_BY_NAME.get(normalizeSectorKey(aliasName)) : null;
  if (aliasRule) {
    return {
      key: normalized,
      sector,
      rule: aliasRule,
      source: "alias",
    };
  }

  if (normalized.includes("textile") && RULE_BY_NAME.get(normalizeSectorKey("Textile Composite"))) {
    return {
      key: normalized,
      sector,
      rule: RULE_BY_NAME.get(normalizeSectorKey("Textile Composite"))!,
      source: "alias",
    };
  }

  if (normalized.includes("food") && RULE_BY_NAME.get(normalizeSectorKey("Food & Personal Care Products"))) {
    return {
      key: normalized,
      sector,
      rule: RULE_BY_NAME.get(normalizeSectorKey("Food & Personal Care Products"))!,
      source: "alias",
    };
  }

  if (!FALLBACK_RULE) return null;
  return {
    key: normalized,
    sector,
    rule: FALLBACK_RULE,
    source: "fallback",
  };
}

function computeMetricValue(ctx: MetricContext, label: string) {
  const direct = directMetricValue(ctx, label);
  if (direct != null) return normalizeDirectMetric(label, direct);

  switch (label) {
    case "Gross Margin":
      return pct(ctx.grossProfit, ctx.sales);
    case "Operating Margin":
      return pct(ctx.operatingProfit, ctx.sales);
    case "Net Margin":
      return pct(ctx.netProfit, ctx.sales);
    case "EBITDA Margin":
      return pct(computeEbitda(ctx), ctx.sales);
    case "ROCE":
      return analyzerMetric(ctx, "ROCE");
    case "ROE":
      return analyzerMetric(ctx, "ROE");
    case "ROA":
      return pct(ctx.netProfit, ctx.totalAssets);
    case "Current Ratio":
      return analyzerMetric(ctx, "Current Ratio");
    case "Debt to Equity":
      return analyzerMetric(ctx, "Debt to Equity");
    case "Net Debt / EBITDA":
      return analyzerMetric(ctx, "Net Debt / EBITDA");
    case "Interest Coverage":
      return analyzerMetric(ctx, "Interest Coverage");
    case "EV / EBITDA":
      return analyzerMetric(ctx, "EV/EBITDA");
    case "P/B":
    case "Price / NAV":
      return firstNonNull(
        analyzerMetric(ctx, "P/B Ratio"),
        ctx.summary.pbv
      );
    case "P / FFO":
      return firstNonNull(
        directMetricValue(ctx, label),
        ctx.summary.pe
      );
    case "EV / Sales":
      return firstNonNull(
        directMetricValue(ctx, label),
        ratio(
          enterpriseValue(ctx),
          ctx.sales
        )
      );
    case "CFO / PAT":
    case "CFO / Net Income":
      return ratio(ctx.operatingCashFlow, ctx.netProfit);
    case "Core Earnings Quality":
      return ratioAsPercent(ctx.operatingProfit, sumNullable(ctx.operatingProfit, positiveOnly(ctx.otherIncome)));
    case "Inventory Days":
      return daysMetric(ctx.inventory, ctx.costOfSales);
    case "Receivable Days":
      return daysMetric(ctx.tradeDebts, ctx.sales);
    case "Earnings Yield":
      return firstNonNull(
        ratioAsPercent(ctx.summary.eps, ctx.currentPrice),
        ctx.summary.pe != null && ctx.summary.pe !== 0 ? 100 / ctx.summary.pe : null
      );
    case "Dividend Score":
      return computeDividendScore(ctx);
    case "FCF Yield":
      return firstNonNull(
        analyzerMetric(ctx, "Free Cash Flow Yield"),
        pct(freeCashFlow(ctx), ctx.marketCap)
      );
    case "Asset Turnover":
      return ratio(ctx.sales, ctx.totalAssets);
    case "Cash Income Ratio":
      return firstNonNull(
        directMetricValue(ctx, label),
        ratioAsPercent(ctx.operatingCashFlow, ctx.totalIncome)
      );
    case "Cash + Investments / Total Assets":
      return pct(sumNullable(ctx.cash, ctx.shortTermInvestments), ctx.totalAssets);
    case "Debt / Assets":
      return pct(ctx.totalDebt, ctx.totalAssets);
    case "Equity / Total Assets":
      return pct(ctx.totalEquity, ctx.totalAssets);
    case "Investment Income / Net Premium":
      return pct(ctx.investmentIncome, ctx.totalPremium);
    case "Investment Income Yield":
    case "Financing / Investment Income Yield":
      return pct(ctx.investmentIncome, ctx.shortTermInvestments);
    case "Cash Drag":
      return pct(sumNullable(ctx.cash, ctx.shortTermInvestments), ctx.totalAssets);
    case "ROE on NAV":
      return firstNonNull(
        directMetricValue(ctx, label),
        analyzerMetric(ctx, "ROE")
      );
    case "Trading Liquidity":
      return ctx.quote?.volume != null && ctx.currentPrice != null
        ? ctx.quote.volume * ctx.currentPrice
        : ctx.quote?.volume ?? null;
    case "Distribution Yield":
    case "Portfolio Dividend Yield":
      return ctx.summary.dividendYield;
    case "Distribution Cover":
    case "AFFO Distribution Cover":
      return computeDistributionCover(ctx);
    case "Discount / Premium to NAV": {
      const priceToNav = firstNonNull(
        directMetricValue(ctx, "Price / NAV"),
        ctx.summary.pbv
      );
      return priceToNav != null ? (priceToNav - 1) * 100 : null;
    }
    case "Net Cash / Share": {
      const netCash = sumNullable(ctx.cash, ctx.shortTermInvestments, negateNullable(ctx.totalDebt));
      return ratio(netCash, ctx.sharesOutstanding);
    }
    default:
      return null;
  }
}

function directMetricValue(ctx: MetricContext, label: string) {
  const patterns = metricPatterns(label);
  if (!patterns.length) return null;
  return latestMetric(ctx.data, patterns);
}

function metricPatterns(label: string): RegExp[] {
  switch (label) {
    case "Gross Margin":
      return [/^gross margin$/i];
    case "Operating Margin":
      return [/^operating margin$/i];
    case "Net Margin":
      return [/^net margin$/i];
    case "EBITDA Margin":
      return [/^ebitda margin$/i];
    case "ROCE":
      return [/^roce$/i];
    case "ROE":
      return [/^roe$/i, /return on equity/i];
    case "ROA":
      return [/^roa$/i, /return on assets/i];
    case "Current Ratio":
      return [/^current ratio$/i];
    case "Debt to Equity":
      return [/^debt to equity$/i];
    case "Net Debt / EBITDA":
      return [/^net debt \/ ebitda$/i];
    case "Interest Coverage":
      return [/^interest coverage$/i, /^ebit \/ interest$/i];
    case "EV / EBITDA":
      return [/^ev\/ebitda$/i];
    case "EV / Sales":
      return [/^ev\/sales$/i];
    case "P/B":
      return [/^pbv$/i, /^p\/b/i];
    case "Price / NAV":
      return [/^price ?\/ ?nav$/i];
    case "P / FFO":
      return [/^p ?\/ ?ffo$/i];
    case "Net Interest Margin":
      return [/^net interest margin$/i, /^nim/i];
    case "Cost-to-Income Ratio":
      return [/^cost to income$/i, /cost-to-income/i];
    case "Asset Quality / NPL Ratio":
      return [/asset quality/i, /^npl ratio$/i, /non-performing loans/i];
    case "NPL / Infection Ratio":
      return [/infection ratio/i, /^npl/i];
    case "Coverage Ratio":
      return [/^coverage ratio$/i];
    case "Capital Adequacy Ratio":
      return [/capital adequacy/i, /\bcar\b/i];
    case "Cash Income Ratio":
      return [/^cash income ratio$/i];
    case "Combined Ratio":
      return [/^combined ratio$/i];
    case "Insurance Expense Ratio":
      return [/insurance expense ratio/i, /^expense ratio$/i];
    case "Loss Ratio":
      return [/^loss ratio$/i];
    case "Investment Income / Net Premium":
      return [/investment income \/ net premium/i];
    case "Investment Income Yield":
      return [/^investment income yield$/i];
    case "Financing / Investment Income Yield":
      return [/financing \/ investment income yield/i, /^finance income yield$/i];
    case "Discount / Premium to NAV":
      return [/discount \/ premium to nav/i, /premium to nav/i];
    case "AUM / Net Assets":
      return [/aum \/ net assets/i, /assets under management/i];
    case "Cash Drag":
      return [/^cash drag$/i];
    case "Trading Liquidity":
      return [/trading liquidity/i];
    case "Distribution Yield":
      return [/distribution yield/i];
    case "Distribution Cover":
      return [/distribution cover/i];
    case "Portfolio Dividend Yield":
      return [/portfolio dividend yield/i];
    case "FFO Yield":
      return [/ffo yield/i];
    case "AFFO Distribution Cover":
      return [/affo distribution cover/i];
    case "Debt / Assets":
      return [/^debt ?\/ ?assets$/i];
    case "Rental Income Margin":
      return [/rental income margin/i];
    case "CFO / Net Income":
      return [/cfo \/ net income/i];
    case "Occupancy Rate":
      return [/occupancy rate/i];
    case "Tracking Difference":
      return [/tracking difference/i];
    case "Expense Ratio":
      return [/^expense ratio$/i];
    case "ROE on NAV":
      return [/roe on nav/i];
    case "Underwriting Margin":
      return [/underwriting margin/i];
    case "Dividend Score":
      return [/dividend score/i];
    case "Net Cash / Share":
      return [/net cash \/ share/i];
    default:
      return [];
  }
}

function normalizeDirectMetric(label: string, value: number) {
  if (label === "Debt to Equity" && value > 5) return value / 100;
  if (label === "Tracking Difference") return Math.abs(value);
  return value;
}

function computeDividendScore(ctx: MetricContext) {
  const dividendYield = ctx.summary.dividendYield;
  const payoutRatio = ctx.summary.payoutRatio;
  const cashCover = ratio(ctx.operatingCashFlow, totalDividendCash(ctx));

  const yieldScore = scaleHigher(dividendYield, [0, 1, 2.5, 4, 6, 8]);
  const payoutScore =
    payoutRatio == null
      ? 35
      : payoutRatio < 0
        ? 10
        : payoutRatio <= 25
          ? 55
          : payoutRatio <= 60
            ? 85
            : payoutRatio <= 90
              ? 60
              : payoutRatio <= 120
                ? 35
                : 15;
  const cashScore = scaleHigher(cashCover, [0, 0.5, 0.8, 1, 1.25, 1.5]);

  return round1(yieldScore * 0.4 + payoutScore * 0.3 + cashScore * 0.3);
}

function computeDistributionCover(ctx: MetricContext) {
  const direct = directMetricValue(ctx, "Distribution Cover");
  if (direct != null) return direct;
  return ratio(ctx.operatingCashFlow, totalDividendCash(ctx));
}

function totalDividendCash(ctx: MetricContext) {
  if (ctx.summary.dps == null || ctx.sharesOutstanding == null) return null;
  return ctx.summary.dps * ctx.sharesOutstanding;
}

function enterpriseValue(ctx: MetricContext) {
  if (ctx.marketCap == null || ctx.totalDebt == null) return null;
  return ctx.marketCap + ctx.totalDebt - (ctx.cash ?? 0) - (ctx.shortTermInvestments ?? 0);
}

function computeEbitda(ctx: MetricContext) {
  if (ctx.operatingProfit == null) return null;
  return ctx.operatingProfit + Math.max(ctx.depreciation ?? 0, 0);
}

function freeCashFlow(ctx: MetricContext) {
  if (ctx.operatingCashFlow == null || ctx.capex == null) return null;
  return ctx.operatingCashFlow - Math.abs(ctx.capex);
}

function analyzerMetric(ctx: MetricContext, label: string) {
  return ctx.factorMap.get(label)?.value ?? null;
}

function buildPercentileScores(
  entries: Array<{ symbol: string; value: number | null }>,
  direction: SectorDocumentDirection
) {
  const valid = entries.filter(
    (entry): entry is { symbol: string; value: number } => entry.value != null && Number.isFinite(entry.value)
  );
  const scores = new Map<string, number>();
  if (valid.length === 1) {
    scores.set(valid[0].symbol, 100);
    return scores;
  }
  if (!valid.length) return scores;

  const ascending = [...valid].sort((left, right) => left.value - right.value);
  let index = 0;
  while (index < ascending.length) {
    let end = index;
    while (end + 1 < ascending.length && ascending[end + 1]?.value === ascending[index]?.value) {
      end += 1;
    }
    const averagePosition = (index + end) / 2;
    const basePercent = (averagePosition / (ascending.length - 1)) * 100;
    const percentile = direction === "higher" ? basePercent : 100 - basePercent;
    for (let cursor = index; cursor <= end; cursor += 1) {
      const symbol = ascending[cursor]?.symbol;
      if (symbol) scores.set(symbol, Math.round(percentile));
    }
    index = end + 1;
  }

  return scores;
}

function pickCategoryScore(summary: AnalyzerSummary, label: string) {
  return summary.categoryScores.find((category) => category.label === label)?.score ?? 0;
}

function inferMetricFormat(label: string): SectorMetricFormat {
  switch (label) {
    case "P/B":
    case "Price / NAV":
    case "P / FFO":
    case "Asset Turnover":
    case "Current Ratio":
    case "Debt to Equity":
    case "Net Debt / EBITDA":
    case "Interest Coverage":
    case "EV / EBITDA":
    case "EV / Sales":
    case "CFO / PAT":
    case "CFO / Net Income":
    case "Distribution Cover":
    case "AFFO Distribution Cover":
    case "AUM / Net Assets":
      return "multiple";
    case "Inventory Days":
    case "Receivable Days":
      return "days";
    case "Trading Liquidity":
      return "compact";
    case "Net Cash / Share":
      return "currency";
    case "Dividend Score":
      return "score";
    case "Cash Drag":
    case "Discount / Premium to NAV":
    case "Distribution Yield":
    case "Portfolio Dividend Yield":
    case "FFO Yield":
    case "FCF Yield":
    case "Earnings Yield":
    case "Gross Margin":
    case "Operating Margin":
    case "Net Margin":
    case "EBITDA Margin":
    case "ROCE":
    case "ROE":
    case "ROA":
    case "Net Interest Margin":
    case "Cost-to-Income Ratio":
    case "Asset Quality / NPL Ratio":
    case "NPL / Infection Ratio":
    case "Coverage Ratio":
    case "Capital Adequacy Ratio":
    case "Cash + Investments / Total Assets":
    case "Cash Income Ratio":
    case "Combined Ratio":
    case "Insurance Expense Ratio":
    case "Investment Income / Net Premium":
    case "Investment Income Yield":
    case "Financing / Investment Income Yield":
    case "Loss Ratio":
    case "Occupancy Rate":
    case "Rental Income Margin":
    case "ROE on NAV":
    case "Tracking Difference":
    case "Debt / Assets":
    case "Equity / Total Assets":
    case "Expense Ratio":
    case "Underwriting Margin":
      return "percent";
    default:
      return "number";
  }
}

function formatSectorMetric(value: number | null, format: SectorMetricFormat) {
  if (value == null) return "—";
  switch (format) {
    case "percent":
      return `${formatNumber(value, 2)}%`;
    case "multiple":
      return `${formatNumber(value, 2)}x`;
    case "days":
      return `${formatNumber(value, 0)} days`;
    case "currency":
      return `Rs ${formatNumber(value, 2)}`;
    case "compact":
      return formatCompact(value);
    case "score":
      return `${formatNumber(value, 0)}/100`;
    default:
      return formatMarketPrice(value);
  }
}

function scaleHigher(value: number | null, points: number[]) {
  if (value == null) return 0;
  if (value <= points[0]) return 0;
  if (value >= points[points.length - 1]) return 100;
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (value <= right) {
      const span = right - left;
      const progress = span === 0 ? 0 : (value - left) / span;
      const base = ((index - 1) / (points.length - 1)) * 100;
      const next = (index / (points.length - 1)) * 100;
      return round1(base + (next - base) * progress);
    }
  }
  return 100;
}

function normalizeSectorKey(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pct(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function ratio(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function ratioAsPercent(numerator: number | null, denominator: number | null) {
  const base = ratio(numerator, denominator);
  return base == null ? null : base * 100;
}

function daysMetric(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return (numerator / Math.abs(denominator)) * 365;
}

function sumNullable(...values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) : null;
}

function firstNonNull<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value != null) return value;
  }
  return null;
}

function positiveOnly(value: number | null) {
  if (value == null) return null;
  return value > 0 ? value : 0;
}

function negateNullable(value: number | null) {
  return value == null ? null : -value;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
