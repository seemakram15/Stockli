"use client";

import * as React from "react";
import {
  ArrowRight,
  BarChart3,
  Brain,
  GitCompareArrows,
  LineChart,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildAnalyzerComparison,
  buildAnalyzerSummary,
  getFiftyTwoWeekRange,
  getPriceLikeSeries,
  latestValueFromRows,
  type AnalyzerComparison,
  type AnalyzerFactor,
  type AnalyzerFactorComparison,
  type AnalyzerSummary,
  type MetricPoint,
} from "@/lib/analysis/stock-analyzer";
import {
  buildDeterministicAnalyzeInsight,
  buildDeterministicCompareInsight,
  type StockAnalyzeAiInsight,
  type StockCompareAiInsight,
} from "@/lib/analysis/stock-analyzer-ai";
import { SectorLeadersPanel } from "@/components/analysis/sector-leaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AccentPill, IconChip, type Accent } from "@/components/ui/accent";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { StockFinancialsData } from "@/lib/types/stock-fundamentals";
import { cn } from "@/lib/utils";

type CompanyOption = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  image: string | null;
};

type CompaniesPayload = {
  companies: CompanyOption[];
};

type MarketPayload = {
  detail?: {
    constituents?: IndexConstituent[];
  } | null;
};

type IndexDetailPayload = {
  constituents?: IndexConstituent[];
};

type IndexConstituent = {
  symbol: string;
  name: string | null;
  current: number;
  change: number;
  changePct: number;
  ldcp: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
};

type Universe = "KSE100" | "KSE30" | "ALL";
type AnalyzerMode = "analyze" | "compare" | "sectors";

type FinancialApiResponse = {
  data: StockFinancialsData;
  cache?: { status: string; storedAt: string };
};

type AiApiResponse<T> = {
  data: T;
  cache?: { status: string; storedAt: string };
};

type AnalyzeAiPayload = {
  mode: "analyze";
  symbol: string;
  companyName: string;
  sourceUpdatedAt: string;
  deterministic: StockAnalyzeAiInsight;
  insight: StockAnalyzeAiInsight;
  generatedAt: string;
};

type CompareAiPayload = {
  mode: "compare";
  firstSymbol: string;
  secondSymbol: string;
  sourceUpdatedAt: [string, string];
  deterministic: StockCompareAiInsight;
  insight: StockCompareAiInsight;
  generatedAt: string;
};

type LoadingStage = {
  percent: number;
  title: string;
  description: string;
};

type RangeBand = {
  min: number;
  max: number;
  current: number;
  position: number;
  positionLabel: string;
};

const POSITIVE = "#10b981";
const NEGATIVE = "#ef4444";
const BLUE = "#0ea5e9";
const GOLD = "#f59e0b";
const VIOLET = "#8b5cf6";

export function StockAnalyzer() {
  const [mode, setMode] = React.useState<AnalyzerMode>("analyze");
  const [universe, setUniverse] = React.useState<Universe>("KSE100");
  const [analyzeQuery, setAnalyzeQuery] = React.useState("");
  const [compareQueryA, setCompareQueryA] = React.useState("");
  const [compareQueryB, setCompareQueryB] = React.useState("");
  const [selectedSymbol, setSelectedSymbol] = React.useState("");
  const [selectedCompareA, setSelectedCompareA] = React.useState("");
  const [selectedCompareB, setSelectedCompareB] = React.useState("");
  const [analyzeSymbol, setAnalyzeSymbol] = React.useState("");
  const [activeCompare, setActiveCompare] = React.useState<{ first: string; second: string }>({
    first: "",
    second: "",
  });

  const companiesResource = usePersistentResource<CompaniesPayload>({
    cacheKey: "public:stock-fundamentals:companies:ready:v1",
    url: "/api/public/stock-fundamentals/companies?ready=1",
    refreshInterval: 24 * 60 * 60 * 1000,
  });
  const marketResource = usePersistentResource<MarketPayload>({
    cacheKey: "public:psx-market",
    url: "/api/public/market",
    refreshInterval: 60_000,
  });
  const kse30 = useIndexConstituents("KSE30");

  const companies = React.useMemo(
    () => companiesResource.data?.companies ?? [],
    [companiesResource.data?.companies]
  );
  const companyMap = React.useMemo(
    () => new Map(companies.map((company) => [company.symbol, company])),
    [companies]
  );
  const quoteMap = React.useMemo(() => {
    const map = new Map<string, IndexConstituent>();
    marketResource.data?.detail?.constituents?.forEach((row) => map.set(row.symbol, row));
    kse30.constituents.forEach((row) => map.set(row.symbol, row));
    return map;
  }, [kse30.constituents, marketResource.data?.detail?.constituents]);

  const universeSymbols = React.useMemo(() => {
    if (universe === "ALL") return null;
    const list =
      universe === "KSE100"
        ? marketResource.data?.detail?.constituents ?? []
        : kse30.constituents;
    return new Set(list.map((item) => item.symbol));
  }, [kse30.constituents, marketResource.data?.detail?.constituents, universe]);

  const analyzeCompanies = React.useMemo(
    () => filterCompanies(companies, universeSymbols, analyzeQuery),
    [companies, universeSymbols, analyzeQuery]
  );
  const compareCompaniesA = React.useMemo(
    () => filterCompanies(companies, universeSymbols, compareQueryA),
    [companies, universeSymbols, compareQueryA]
  );
  const compareCompaniesB = React.useMemo(
    () => filterCompanies(companies, universeSymbols, compareQueryB),
    [companies, universeSymbols, compareQueryB]
  );

  React.useEffect(() => {
    if (selectedSymbol && analyzeCompanies.some((company) => company.symbol === selectedSymbol)) {
      return;
    }
    setSelectedSymbol(analyzeCompanies[0]?.symbol ?? "");
  }, [analyzeCompanies, selectedSymbol]);

  React.useEffect(() => {
    if (!selectedCompareA && compareCompaniesA[0]?.symbol) {
      setSelectedCompareA(compareCompaniesA[0].symbol);
    }
    if (!selectedCompareB) {
      const fallback = compareCompaniesB.find((company) => company.symbol !== selectedCompareA);
      if (fallback?.symbol) setSelectedCompareB(fallback.symbol);
    }
  }, [compareCompaniesA, compareCompaniesB, selectedCompareA, selectedCompareB]);

  React.useEffect(() => {
    if (!selectedCompareA || selectedCompareB !== selectedCompareA) return;
    const fallback = compareCompaniesB.find((company) => company.symbol !== selectedCompareA);
    if (fallback?.symbol) setSelectedCompareB(fallback.symbol);
  }, [compareCompaniesB, selectedCompareA, selectedCompareB]);

  const analyzerFinancials = useFinancials(analyzeSymbol);
  const compareAFinancials = useFinancials(activeCompare.first);
  const compareBFinancials = useFinancials(activeCompare.second);

  const analyzeSummary = React.useMemo(
    () =>
      analyzerFinancials.data
        ? buildAnalyzerSummary(
            analyzerFinancials.data,
            quoteMap.get(analyzerFinancials.data.symbol) ?? null
          )
        : null,
    [analyzerFinancials.data, quoteMap]
  );
  const compareSummaryA = React.useMemo(
    () =>
      compareAFinancials.data
        ? buildAnalyzerSummary(
            compareAFinancials.data,
            quoteMap.get(compareAFinancials.data.symbol) ?? null
          )
        : null,
    [compareAFinancials.data, quoteMap]
  );
  const compareSummaryB = React.useMemo(
    () =>
      compareBFinancials.data
        ? buildAnalyzerSummary(
            compareBFinancials.data,
            quoteMap.get(compareBFinancials.data.symbol) ?? null
          )
        : null,
    [compareBFinancials.data, quoteMap]
  );
  const comparison = React.useMemo(
    () =>
      compareSummaryA && compareSummaryB
        ? buildAnalyzerComparison(compareSummaryA, compareSummaryB)
        : null,
    [compareSummaryA, compareSummaryB]
  );

  const analyzeName =
    companyMap.get(analyzeSymbol)?.name ?? companyMap.get(selectedSymbol)?.name ?? "this stock";
  const compareNameA =
    companyMap.get(activeCompare.first)?.name ??
    companyMap.get(selectedCompareA)?.name ??
    "first stock";
  const compareNameB =
    companyMap.get(activeCompare.second)?.name ??
    companyMap.get(selectedCompareB)?.name ??
    "second stock";

  function analyzeSelected() {
    if (!selectedSymbol) return;
    setAnalyzeSymbol(selectedSymbol);
  }

  function compareSelected() {
    if (!selectedCompareA || !selectedCompareB || selectedCompareA === selectedCompareB) return;
    setActiveCompare({ first: selectedCompareA, second: selectedCompareB });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-card px-4 py-8 text-center shadow-soft ring-1 ring-foreground/10 sm:px-8 sm:py-12">
        <div className="pointer-events-none absolute inset-0 bg-brand-mesh" aria-hidden />
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-violet-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-12 bottom-0 size-64 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <AccentPill accent="violet" className="mx-auto">
            <Brain />
            PSX fundamentals decision engine
          </AccentPill>
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Analyze and compare PSX stocks{" "}
            <span className="text-gradient-violet">with a clearer report</span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
            Stockli turns company financials, ratios, and price context into an investor-friendly
            report with grouped scorecards, clearer charts, and an AI explanation in simple language.
          </p>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
            <div
              role="tablist"
              aria-label="Stock analyzer mode"
              className="grid w-full grid-cols-3 gap-1 rounded-2xl border bg-muted/70 p-1"
            >
              {([
                ["analyze", LineChart, "Analyze a Stock"],
                ["compare", GitCompareArrows, "Compare Two Stocks"],
                ["sectors", Trophy, "Sector Leaders"],
              ] as const).map(([value, Icon, label]) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm",
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid w-full max-w-xl grid-cols-3 gap-1 rounded-2xl border bg-background p-1">
              {(["KSE100", "KSE30", "ALL"] as Universe[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setUniverse(item)}
                  className={cn(
                    "h-11 rounded-xl px-2 text-sm font-semibold transition sm:text-base",
                    universe === item
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/25"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item === "ALL" ? "All Stocks" : item}
                </button>
              ))}
            </div>

          </div>

          {mode === "analyze" ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <StockPicker
                companies={analyzeCompanies}
                value={selectedSymbol}
                onChange={setSelectedSymbol}
                query={analyzeQuery}
                onQueryChange={setAnalyzeQuery}
                loading={companiesResource.isLoading}
                placeholder="Pick a stock to score..."
              />
              <Button
                type="button"
                size="lg"
                disabled={!selectedSymbol || analyzerFinancials.isLoading}
                onClick={analyzeSelected}
                className="h-12 gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 text-base text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-400 hover:text-white"
              >
                {analyzerFinancials.isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Analyze Stock
              </Button>
            </div>
          ) : mode === "compare" ? (
            <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
              <StockPicker
                companies={compareCompaniesA}
                value={selectedCompareA}
                onChange={setSelectedCompareA}
                query={compareQueryA}
                onQueryChange={setCompareQueryA}
                loading={companiesResource.isLoading}
                placeholder="First stock..."
              />
              <StockPicker
                companies={compareCompaniesB}
                value={selectedCompareB}
                onChange={setSelectedCompareB}
                query={compareQueryB}
                onQueryChange={setCompareQueryB}
                loading={companiesResource.isLoading}
                placeholder="Second stock..."
              />
              <Button
                type="button"
                size="lg"
                disabled={
                  !selectedCompareA ||
                  !selectedCompareB ||
                  selectedCompareA === selectedCompareB ||
                  compareAFinancials.isLoading ||
                  compareBFinancials.isLoading
                }
                onClick={compareSelected}
                className="h-12 gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 text-base text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-400 hover:text-white"
              >
                {compareAFinancials.isLoading || compareBFinancials.isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Scale className="size-4" />
                )}
                Compare Stocks
              </Button>
            </div>
          ) : (
            <div className="rounded-[1.75rem] border bg-card/70 p-5 text-center shadow-soft">
              <p className="text-lg font-semibold">Sector leaders are ready below</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pick a sector, review the document-based rankings, and let the AI summarize the
                strongest names in that industry.
              </p>
            </div>
          )}

          {!analyzeSymbol && mode === "analyze" ? (
            <EmptyWorkflow
              items={[
                ["1", "Pick a stock", "Choose any company with financial data ready for analysis."],
                [
                  "2",
                  "Run the score",
                  "We calculate profitability, dividend, cash flow, debt and valuation factors.",
                ],
                [
                  "3",
                  "Read the story",
                  "You get grouped charts, a total score and an AI explanation in simple language.",
                ],
              ]}
            />
          ) : null}

          {!activeCompare.first && mode === "compare" ? (
            <EmptyWorkflow
              items={[
                [
                  "1",
                  "Pick two stocks",
                  "Choose the two companies you want to test head-to-head.",
                ],
                ["2", "Run the comparison", "We score both names on the same factor set."],
                [
                  "3",
                  "Read the winner",
                  "Grouped charts show who is cheaper, stronger, safer and better on cash flow.",
                ],
              ]}
            />
          ) : null}
        </CardContent>
      </Card>

      {mode === "analyze" ? (
        <AnalyzeResult
          loading={analyzerFinancials.isLoading}
          error={analyzerFinancials.error}
          data={analyzerFinancials.data}
          summary={analyzeSummary}
          stockName={analyzeName}
        />
      ) : mode === "compare" ? (
        <CompareResult
          first={compareSummaryA}
          second={compareSummaryB}
          comparison={comparison}
          loading={compareAFinancials.isLoading || compareBFinancials.isLoading}
          error={compareAFinancials.error || compareBFinancials.error}
          firstName={compareNameA}
          secondName={compareNameB}
        />
      ) : (
        <SectorLeadersPanel allowedSymbols={universeSymbols} />
      )}
    </div>
  );
}

function AnalyzeResult({
  loading,
  error,
  data,
  summary,
  stockName,
}: {
  loading: boolean;
  error: string | null;
  data: StockFinancialsData | null;
  summary: AnalyzerSummary | null;
  stockName: string;
}) {
  const fallbackInsight = React.useMemo(
    () => (summary ? buildDeterministicAnalyzeInsight(summary) : null),
    [summary]
  );
  const requestBody = React.useMemo(
    () =>
      summary
        ? ({
            mode: "analyze",
            symbol: summary.symbol,
          } satisfies {
            mode: "analyze";
            symbol: string;
          })
        : null,
    [summary]
  );
  const { data: aiData, loading: aiLoading, error: aiError, cache, refresh } =
    useStockAnalyzerAi<AnalyzeAiPayload>(requestBody);
  const effectiveInsight = aiData?.insight ?? fallbackInsight;
  const factorNotes = React.useMemo(
    () =>
      mergeAnalyzeFactorNotes(
        fallbackInsight?.factorNotes ?? [],
        aiData?.deterministic?.factorNotes ?? [],
        aiData?.insight?.factorNotes ?? []
      ),
    [aiData?.deterministic?.factorNotes, aiData?.insight?.factorNotes, fallbackInsight?.factorNotes]
  );

  if (loading) {
    return (
      <LoadingProgressCard
        icon={<Loader2 className="animate-spin" />}
        heading={`Loading ${stockName} financial snapshot`}
        steps={[
          {
            percent: 18,
            title: "Opening company financials",
            description: `We are reading the financial statements and key ratios for ${stockName}.`,
          },
          {
            percent: 44,
            title: "Calculating the factor set",
            description: "Profitability, cash flow, dividend, debt and valuation checks are being scored.",
          },
          {
            percent: 72,
            title: "Preparing grouped report sections",
            description: "The analyzer is building the charts and scorecards for this stock.",
          },
          {
            percent: 92,
            title: "Almost ready",
            description: "The factor notes and visuals are being polished.",
          },
        ]}
      />
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Company analysis is still preparing. Please try again in a moment.
        </CardContent>
      </Card>
    );
  }

  if (!summary || !data || !effectiveInsight) return null;

  const price =
    summary.quote?.current ?? latestValueFromRows(data, [/current price/i, /^close/i]);
  const dayChange = summary.quote?.change ?? null;
  const dayChangePct = summary.quote?.changePct ?? null;
  const priceTone = (dayChangePct ?? 0) >= 0 ? "positive" : "negative";
  const priceSeries = getPriceLikeSeries(data);
  const week52Range = getFiftyTwoWeekRange(data);
  const priceBand =
    week52Range.low != null && week52Range.high != null
      ? buildExplicitRange(week52Range.low, week52Range.high, price)
      : buildSeriesRange(priceSeries, price);
  const qualityFactors = pickFactors(summary, [
    "roce",
    "roe",
    "operating-margin",
    "gross-margin",
    "net-margin",
  ]);
  const cashFlowFactors = pickFactors(summary, [
    "cfo-to-net-income",
    "fcf-yield",
    "receivable-days",
  ]);
  const safetyFactors = pickFactors(summary, [
    "net-debt-to-ebitda",
    "interest-coverage",
    "debt-to-equity",
    "current-ratio",
  ]);
  const valuationFactors = pickFactors(summary, [
    "pe-ratio",
    "ev-to-ebitda",
    "pb-ratio",
    "dividend-yield",
  ]);

  return (
    <div className="space-y-5">
      <Card variant="feature" className="overflow-hidden">
        <CardContent className="space-y-6 p-5">
          <div className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{summary.symbol}</Badge>
                <Badge variant="success">{summary.sector}</Badge>
                <Badge variant="outline">
                  {summary.factorsAvailable}/{summary.factors.length} factors ready
                </Badge>
              </div>
              <div className="min-w-0">
                <h2 className="text-3xl font-bold tracking-tight">{summary.name}</h2>
                <p className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-foreground/90">
                  {summary.businessText}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
                <PriceSpotlightCard
                  price={price}
                  dayChange={dayChange}
                  dayChangePct={dayChangePct}
                  tone={priceTone}
                  className="h-full"
                />
                <SnapshotMetricBoard
                  title="Snapshot"
                  subtitle="Key price, payout and balance-sheet markers at a glance."
                  metrics={[
                    ["Market cap", formatMaybe(summary.marketCap), "sky"],
                    ["Book value/share", formatMaybe(summary.bookValue), "amber"],
                    ["P/E ratio", formatMaybe(summary.pe, "x"), "violet"],
                    ["P/B ratio", formatMaybe(summary.pbv, "x"), "amber"],
                    ["Dividend yield", formatMaybe(summary.dividendYield, "%"), "emerald"],
                    ["ROCE", factorDisplay(summary, "roce"), "emerald"],
                    ["Current ratio", factorDisplay(summary, "current-ratio"), "sky"],
                    ["Debt to equity", factorDisplay(summary, "debt-to-equity"), "indigo"],
                  ]}
                />
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Total factor score
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{summary.totalScore}/100</p>
                </div>
                <ScoreRing score={summary.totalScore} />
              </div>
              <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-300">
                  <ShieldCheck className="size-4" />
                  {summary.verdict}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {summary.categoryScores.map((category) => (
                  <CategoryGaugeCard
                    key={category.id}
                    label={category.label}
                    score={category.score}
                    summary={category.summary}
                  />
                ))}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <PositionGaugePanel
          priceBand={priceBand}
          tone={priceTone}
        />
        <ScoreRadarCard
          title="Decision Map"
          subtitle="This graph shows whether quality, cash flow, balance-sheet safety and valuation are working together."
          data={summary.categoryScores.map((item) => ({
            metric: item.label,
            score: item.score,
          }))}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <SeriesPanelCard
          title="Price Trend"
          subtitle="End-of-day closing price series from cached financial data."
          series={priceSeries}
          color={POSITIVE}
        />
        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <IconChip accent="amber">
              <Trophy />
            </IconChip>
            <div>
              <CardTitle>Final Verdict</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                One clean read of what is working and what still needs improvement.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-lg font-semibold text-gain">{summary.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This is a fundamentals snapshot, so it works best when you combine it with sector news and recent filings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <VerdictList
                title="What supports the case"
                tone="positive"
                items={summary.strongestFactors.map(
                  (factor) => `${factor.label}: ${factor.displayValue}.`
                )}
              />
              <VerdictList
                title="What should improve"
                tone="warning"
                items={summary.weakestFactors.map(
                  (factor) => `${factor.label}: ${factor.displayValue}.`
                )}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start gap-3">
          <IconChip accent="amber">
            <Scale />
          </IconChip>
          <div>
            <CardTitle>Investor Parameters</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              The full factor checklist, grouped the same way an investor usually thinks about the business.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <FactorCategoryPanel
            title="Profitability & quality"
            subtitle="Can the company turn sales and capital into strong returns?"
            factors={qualityFactors}
            notes={factorNotes}
          />
          <FactorCategoryPanel
            title="Cash flow strength"
            subtitle="Do the reported profits turn into usable cash?"
            factors={cashFlowFactors}
            notes={factorNotes}
          />
          <FactorCategoryPanel
            title="Balance sheet safety"
            subtitle="Is the debt level manageable and is short-term liquidity comfortable?"
            factors={safetyFactors}
            notes={factorNotes}
          />
          <FactorCategoryPanel
            title="Valuation check"
            subtitle="Is the market price fair compared with earnings, cash flow and book value?"
            factors={valuationFactors}
            notes={factorNotes}
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendBoardCard
          title="Money Talk"
          subtitle="These charts show how the business has been growing and monetising over time."
          charts={[
            {
              title: "Sales revenue",
              subtitle: "Annual net sales",
              series: summary.revenue,
              color: BLUE,
            },
            {
              title: "Profit after tax",
              subtitle: "Bottom-line earnings",
              series: summary.profit,
              color: POSITIVE,
            },
          ]}
        />
        <TrendBoardCard
          title="Cash & shareholder output"
          subtitle="Cash generation and per-share delivery tell us whether growth is translating into real value."
          charts={[
            {
              title: "Operating cash flow",
              subtitle: "Annual operating cash generation",
              series: summary.cashflowSeries,
              color: VIOLET,
            },
            {
              title: "Free cash flow",
              subtitle: "Cash after capex",
              series: summary.freeCashFlowSeries,
              color: GOLD,
            },
          ]}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start gap-3">
          <IconChip accent="indigo">
            <Scale />
          </IconChip>
          <div>
            <CardTitle>Value Check</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Is this stock cheap or expensive compared to its real worth?
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ValuationCheckCard summary={summary} currentPrice={price} factors={valuationFactors} />
        </CardContent>
      </Card>

      <AiStoryCard
        title="AI stock explanation"
        subtitle={`Built from the same financial factors and scorecards for ${summary.symbol}.`}
        loading={aiLoading}
        error={aiError}
        cacheStatus={cache?.status ?? null}
        onRefresh={refresh}
        fallbackMode={!aiData || Boolean(aiError)}
      >
        {aiLoading && !aiData ? (
          <LoadingProgressCard
            compact
            icon={<Brain />}
            heading={`Explaining ${summary.symbol}`}
            steps={[
              {
                percent: 20,
                title: "Sending the factor snapshot",
                description: "The AI model is reading the scorecard and trend data.",
              },
              {
                percent: 48,
                title: "Writing a plain-English summary",
                description: "It is translating raw fundamentals into simpler language.",
              },
              {
                percent: 78,
                title: "Checking factor notes",
                description: "We are validating the response before showing it.",
              },
            ]}
          />
        ) : (
          <div className="space-y-5">
            {aiError ? (
              <FallbackNotice
                message={`${aiError} Stockli is showing the deterministic explanation instead.`}
              />
            ) : null}
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="violet">{effectiveInsight.confidence} confidence</Badge>
                <Badge variant="outline">{cache?.status ?? "fresh"}</Badge>
                {!aiData ? <Badge variant="outline">Deterministic fallback</Badge> : null}
              </div>
              <h3 className="mt-3 text-xl font-semibold">{effectiveInsight.headline}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{effectiveInsight.summary}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AiBulletCard
                title="What looks strong"
                tone="positive"
                items={effectiveInsight.strengths}
              />
              <AiBulletCard
                title="What to watch"
                tone="warning"
                items={effectiveInsight.risks}
              />
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6 text-foreground/90">
              <p className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-300">
                <Sparkles className="size-4" />
                AI suggestion
              </p>
              <p className="mt-2">{effectiveInsight.suggestion}</p>
            </div>
          </div>
        )}
      </AiStoryCard>
    </div>
  );
}

function CompareResult({
  first,
  second,
  comparison,
  loading,
  error,
  firstName,
  secondName,
}: {
  first: AnalyzerSummary | null;
  second: AnalyzerSummary | null;
  comparison: AnalyzerComparison | null;
  loading: boolean;
  error: string | null;
  firstName: string;
  secondName: string;
}) {
  const fallbackInsight = React.useMemo(
    () =>
      first && second && comparison
        ? buildDeterministicCompareInsight(first, second, comparison)
        : null,
    [comparison, first, second]
  );
  const requestBody = React.useMemo(
    () =>
      first && second
        ? ({
            mode: "compare",
            firstSymbol: first.symbol,
            secondSymbol: second.symbol,
          } satisfies {
            mode: "compare";
            firstSymbol: string;
            secondSymbol: string;
          })
        : null,
    [first, second]
  );
  const { data: aiData, loading: aiLoading, error: aiError, cache, refresh } =
    useStockAnalyzerAi<CompareAiPayload>(requestBody);
  const effectiveInsight = aiData?.insight ?? fallbackInsight;

  if (loading) {
    return (
      <LoadingProgressCard
        icon={<Loader2 className="animate-spin" />}
        heading={`Comparing ${firstName} and ${secondName}`}
        steps={[
          {
            percent: 16,
            title: "Opening both snapshots",
            description: "We are reading the archived fundamentals for both selected stocks.",
          },
          {
            percent: 42,
            title: "Scoring the factor set",
            description: "Both businesses are being checked on the same profitability, dividend, cash and valuation rules.",
          },
          {
            percent: 70,
            title: "Ranking the winner on each factor",
            description: "The comparison engine is deciding which stock leads each check.",
          },
          {
            percent: 92,
            title: "Preparing charts and decision notes",
            description: "The head-to-head visuals are almost ready.",
          },
        ]}
      />
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Comparison data is still preparing. Please try again in a moment.
        </CardContent>
      </Card>
    );
  }

  if (!first || !second || !comparison || !effectiveInsight) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Choose two different stocks and click compare to see the graphical head-to-head result.
        </CardContent>
      </Card>
    );
  }

  const cheapFactors = pickComparisonFactors(comparison, ["pe-ratio", "ev-to-ebitda", "pb-ratio"]);
  const profitFactors = pickComparisonFactors(comparison, [
    "roce",
    "roe",
    "gross-margin",
    "operating-margin",
    "net-margin",
  ]);
  const cashFactors = pickComparisonFactors(comparison, [
    "cfo-to-net-income",
    "fcf-yield",
    "receivable-days",
  ]);
  const payoutFactors = pickComparisonFactors(comparison, ["dividend-yield"]);
  const safetyFactors = pickComparisonFactors(comparison, [
    "net-debt-to-ebitda",
    "interest-coverage",
    "debt-to-equity",
    "current-ratio",
  ]);

  return (
    <div className="space-y-5">
      <Card variant="feature" className="overflow-hidden">
        <CardContent className="space-y-6 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <CompareHeroStockCard summary={first} />
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border bg-background text-sm font-bold shadow-soft">
              VS
            </div>
            <CompareHeroStockCard summary={second} />
          </div>

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold text-gain">
                  <Trophy className="size-5" />
                  {comparison.winnerLabel}
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {comparison.summary}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {comparison.decisiveFactors.slice(0, 3).map((factor) => (
                <div key={factor.id} className="rounded-2xl border bg-background/85 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Decisive round
                  </p>
                  <p className="mt-1 font-semibold">{factor.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{factor.note}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <ComparisonScoreboardCard first={first} second={second} comparison={comparison} />

      <CompareFactorChartSection
        title="Who is cheaper?"
        subtitle="Lower valuation is better, but only when the business quality is reasonable."
        firstSymbol={first.symbol}
        secondSymbol={second.symbol}
        factors={cheapFactors}
      />

      <CompareFactorChartSection
        title="Who makes better returns?"
        subtitle="These factors focus on margins, capital efficiency and shareholder returns."
        firstSymbol={first.symbol}
        secondSymbol={second.symbol}
        factors={profitFactors}
      />

      <CompareFactorChartSection
        title="Who turns profit into cash?"
        subtitle="Cash-backed earnings usually age better than accounting profits alone."
        firstSymbol={first.symbol}
        secondSymbol={second.symbol}
        factors={cashFactors}
      />

      <CompareFactorChartSection
        title="Who pays investors better?"
        subtitle="Dividend yield shows how much cash income the stock is offering at today's market price."
        firstSymbol={first.symbol}
        secondSymbol={second.symbol}
        factors={payoutFactors}
      />

      <CompareFactorChartSection
        title="Who looks safer?"
        subtitle="Debt, liquidity and interest coverage help us judge how durable the balance sheet is."
        firstSymbol={first.symbol}
        secondSymbol={second.symbol}
        factors={safetyFactors}
      />

      <TrendCompareBoard first={first} second={second} />

      <AiStoryCard
        title="AI comparison"
        subtitle={`Built from the same factor scorecards for ${first.symbol} and ${second.symbol}.`}
        loading={aiLoading}
        error={aiError}
        cacheStatus={cache?.status ?? null}
        onRefresh={refresh}
        fallbackMode={!aiData || Boolean(aiError)}
      >
        {aiLoading && !aiData ? (
          <LoadingProgressCard
            compact
            icon={<Brain />}
            heading={`Comparing ${first.symbol} and ${second.symbol}`}
            steps={[
              {
                percent: 20,
                title: "Sending both scorecards",
                description: "The AI model is reading the factor winners and business profiles.",
              },
              {
                percent: 52,
                title: "Writing the head-to-head decision",
                description: "It is explaining why one stock leads or why the setup stays balanced.",
              },
              {
                percent: 82,
                title: "Checking factor calls",
                description: "We are validating the response before showing it.",
              },
            ]}
          />
        ) : (
          <div className="space-y-5">
            {aiError ? (
              <FallbackNotice
                message={`${aiError} Stockli is showing the deterministic comparison instead.`}
              />
            ) : null}
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="violet">{effectiveInsight.confidence} confidence</Badge>
                <Badge variant="outline">{cache?.status ?? "fresh"}</Badge>
                <Badge variant="success">Winner: {effectiveInsight.winner}</Badge>
                {!aiData ? <Badge variant="outline">Deterministic fallback</Badge> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{effectiveInsight.summary}</p>
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <AiBulletCard
                title="Why the leader wins"
                tone="positive"
                items={effectiveInsight.whyWinner}
              />
              <AiBulletCard
                title={`${first.symbol} strengths`}
                tone="neutral"
                items={effectiveInsight.firstStrengths}
              />
              <AiBulletCard
                title={`${second.symbol} strengths`}
                tone="neutral"
                items={effectiveInsight.secondStrengths}
              />
            </div>
            <AiBulletCard
              title="Shared watchouts"
              tone="warning"
              items={effectiveInsight.watchouts}
            />
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6 text-foreground/90">
              <p className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-300">
                <Sparkles className="size-4" />
                AI suggestion
              </p>
              <p className="mt-2">{effectiveInsight.suggestion}</p>
            </div>
          </div>
        )}
      </AiStoryCard>
    </div>
  );
}

function StockPicker({
  companies,
  value,
  onChange,
  query,
  onQueryChange,
  loading,
  placeholder,
}: {
  companies: CompanyOption[];
  value: string;
  onChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  placeholder: string;
}) {
  const selected = companies.find((company) => company.symbol === value);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={selected ? `${selected.symbol} · ${selected.name}` : placeholder}
          className="h-12 pl-10 text-base"
        />
      </div>
      {query.trim() ? (
        <div className="max-h-64 overflow-y-auto rounded-2xl border bg-card p-1 shadow-soft">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-violet-500" />
              Loading ready stocks...
            </div>
          ) : companies.length ? (
            companies.slice(0, 70).map((company) => (
              <button
                key={`${company.id}-${company.symbol}`}
                type="button"
                onClick={() => {
                  onChange(company.symbol);
                  onQueryChange("");
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted",
                  value === company.symbol && "bg-violet-500/10 text-violet-600 dark:text-violet-300"
                )}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{company.symbol}</span>
                  <span className="block truncate text-sm text-muted-foreground">{company.name}</span>
                </span>
                <span className="hidden max-w-40 truncate rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                  {company.sector}
                </span>
              </button>
            ))
          ) : (
            <p className="p-4 text-center text-sm text-muted-foreground">No matching stocks.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EmptyWorkflow({
  items,
}: {
  items: Array<[string, string, string]>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map(([step, title, copy]) => (
        <div
          key={step}
          className="rounded-2xl border bg-card p-5 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-sm shadow-violet-500/30">
            {step}
          </span>
          <h3 className="mt-4 text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
        </div>
      ))}
    </div>
  );
}

function CompareHeroStockCard({ summary }: { summary: AnalyzerSummary }) {
  return (
    <div className="rounded-3xl border bg-background/90 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {summary.symbol}
          </p>
          <p className="mt-2 text-xl font-bold">{summary.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{summary.sector}</p>
        </div>
        <Badge variant="outline">{summary.totalScore}/100</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniMetric
          label="Current price"
          value={
            summary.quote?.current != null ? `Rs ${formatNumber(summary.quote.current)}` : "N/A"
          }
          accent="sky"
        />
        <MiniMetric label="Total score" value={`${summary.totalScore}/100`} accent="emerald" />
      </div>
    </div>
  );
}

function ScoreSummaryBox({
  label,
  value,
  winner,
  tone,
}: {
  label: string;
  value: number;
  winner: boolean;
  tone: "emerald" | "amber";
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center rounded-[1.6rem] border p-3 text-center shadow-soft sm:rounded-[2rem] sm:p-6",
        winner && tone === "emerald" && "border-emerald-500/40 bg-emerald-500/10",
        winner && tone === "amber" && "border-amber-500/40 bg-amber-500/10",
        !winner && "bg-background/80"
      )}
    >
      <p className="text-lg font-semibold tracking-tight text-foreground/80 sm:text-2xl">{label}</p>
      <p className="mt-2 text-4xl font-bold tabular-nums sm:mt-4 sm:text-6xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-base">Factors won</p>
      {winner ? (
        <span className="mt-2 inline-flex rounded-full bg-gain px-3 py-1 text-xs font-semibold text-white sm:mt-4 sm:px-4 sm:py-1.5 sm:text-sm">
          Winner
        </span>
      ) : null}
    </div>
  );
}

function ComparisonScoreboardCard({
  first,
  second,
  comparison,
}: {
  first: AnalyzerSummary;
  second: AnalyzerSummary;
  comparison: AnalyzerComparison;
}) {
  const firstFactors = comparison.factors.filter((factor) => factor.winner === "first");
  const secondFactors = comparison.factors.filter((factor) => factor.winner === "second");
  const tiedFactors = comparison.factors.filter((factor) => factor.winner === "tie");

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="flex items-center gap-3">
          <Trophy className="size-8 text-foreground/70" />
          <CardTitle className="text-4xl font-bold tracking-tight">Scoreboard</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-[1fr_84px_1fr] items-stretch gap-3 sm:grid-cols-[1fr_104px_1fr] sm:gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <ScoreSummaryBox
            label={first.symbol}
            value={comparison.firstWins}
            winner={comparison.firstWins > comparison.secondWins}
            tone="emerald"
          />
          <div className="mx-auto flex h-full w-full flex-col items-center justify-center rounded-[1.4rem] bg-background px-2 py-3 text-center shadow-soft sm:rounded-full sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-sm">
              Tied
            </p>
            <p className="mt-1 text-3xl font-bold text-amber-500 tabular-nums sm:text-4xl">{comparison.ties}</p>
          </div>
          <ScoreSummaryBox
            label={second.symbol}
            value={comparison.secondWins}
            winner={comparison.secondWins > comparison.firstWins}
            tone="amber"
          />
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-5">
          <CompareOutcomeList
            title={`${first.symbol} won`}
            tone="emerald"
            items={firstFactors.map((factor) => factor.label)}
          />
          <CompareOutcomeList
            title={`${comparison.ties} tied`}
            tone="amber"
            items={tiedFactors.map((factor) => factor.label)}
          />
          <CompareOutcomeList
            title={`${second.symbol} won`}
            tone="sky"
            items={secondFactors.map((factor) => factor.label)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CompareOutcomeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "amber" | "sky";
}) {
  const dotClass =
    tone === "emerald" ? "bg-emerald-600" : tone === "amber" ? "bg-amber-500" : "bg-sky-600";
  const textClass =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : "text-sky-700 dark:text-sky-300";

  return (
    <div className="min-w-0 rounded-[1.5rem] border bg-background/85 p-3 shadow-soft sm:rounded-[2rem] sm:p-5">
      <p className={cn("text-base font-semibold tracking-tight sm:text-2xl", textClass)}>{title}</p>
      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={`${title}-${item}`}
              className="flex items-start gap-2 text-[11px] leading-4 text-muted-foreground sm:gap-3 sm:text-base sm:leading-6"
            >
              <span className={cn("mt-1 size-2 rounded-full sm:mt-1.5 sm:size-2.5", dotClass)} />
              <span>{item}</span>
            </div>
          ))
        ) : (
          <p className="text-[11px] leading-4 text-muted-foreground sm:text-sm sm:leading-6">
            No factors here on this snapshot.
          </p>
        )}
      </div>
    </div>
  );
}

function FactorCategoryPanel({
  title,
  subtitle,
  factors,
  notes,
}: {
  title: string;
  subtitle: string;
  factors: AnalyzerFactor[];
  notes: Map<string, string>;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {factors.map((factor) => (
          <FactorParameterTile
            key={factor.id}
            factor={factor}
            note={notes.get(factor.id) ?? factor.explanation}
          />
        ))}
      </div>
    </div>
  );
}

function FactorParameterTile({
  factor,
  note,
}: {
  factor: AnalyzerFactor;
  note: string;
}) {
  return (
    <div className="rounded-[1.75rem] border bg-background/85 p-4 shadow-soft">
      <div className="grid gap-4 lg:grid-cols-[1fr_132px] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {factor.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{factor.displayValue}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
          <p className="mt-3 text-sm text-foreground/80">
            {factorFriendlyGuidance(factor.id)}
          </p>
        </div>
        <div className="space-y-3">
          <SpeedGauge
            value={factor.score}
            size="sm"
            valueLabel={`${factor.score}/100`}
            leftLabel="Weak"
            rightLabel="Strong"
          />
          <Badge className="w-full justify-center" variant={badgeVariantForFactor(factor.status)}>
            {statusLabelFromFactorStatus(factor.status)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function VerdictList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "warning";
  items: string[];
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "positive"
          ? "border-emerald-500/25 bg-emerald-500/5"
          : "border-amber-500/25 bg-amber-500/5"
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          tone === "positive" ? "text-gain" : "text-amber-600 dark:text-amber-300"
        )}
      >
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                "mt-1 size-2 rounded-full",
                tone === "positive" ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendBoardCard({
  title,
  subtitle,
  charts,
}: {
  title: string;
  subtitle: string;
  charts: Array<{ title: string; subtitle: string; series: MetricPoint[]; color: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <IconChip accent="sky">
          <BarChart3 />
        </IconChip>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        {charts.map((chart) => (
          <SeriesPanelCard
            key={chart.title}
            title={chart.title}
            subtitle={chart.subtitle}
            series={chart.series}
            color={chart.color}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ValuationCheckCard({
  summary,
  currentPrice,
  factors,
}: {
  summary: AnalyzerSummary;
  currentPrice: number | null;
  factors: AnalyzerFactor[];
}) {
  const check = buildValueCheck(summary, currentPrice);

  if (!check.available) {
    return (
      <div className="rounded-[2rem] border bg-background/85 p-5">
        <p className="text-lg font-semibold">Value Check is preparing</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          We need a usable EPS, book value per share and current price before this real-worth view can be calculated.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">Graham Number</Badge>
        <p className="text-sm text-muted-foreground">
          Is this stock cheap or expensive compared to its real worth?
        </p>
      </div>

      <div
        className={cn(
          "rounded-[2rem] border p-6",
          check.verdict === "Undervalued" && "border-emerald-500/30 bg-emerald-500/5",
          check.verdict === "Fairly priced" && "border-amber-500/30 bg-amber-500/5",
          check.verdict === "Overvalued" && "border-rose-500/30 bg-rose-500/5"
        )}
      >
        <div className="flex items-start gap-4">
          <IconChip
            accent={
              check.verdict === "Undervalued"
                ? "emerald"
                : check.verdict === "Fairly priced"
                  ? "amber"
                  : "indigo"
            }
            size="lg"
          >
            {check.verdict === "Overvalued" ? <TrendingDown /> : <TrendingUp />}
          </IconChip>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Verdict
            </p>
            <p
              className={cn(
                "mt-2 text-4xl font-bold tracking-tight",
                check.verdict === "Undervalued" && "text-gain",
                check.verdict === "Fairly priced" && "text-amber-600 dark:text-amber-300",
                check.verdict === "Overvalued" && "text-loss"
              )}
            >
              {check.verdict}
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">{check.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniMetric
            label="Intrinsic value"
            value={`Rs ${formatNumber(check.grahamNumber ?? 0)}`}
            accent="emerald"
          />
          <MiniMetric
            label="Current price"
            value={`Rs ${formatNumber(check.currentPrice ?? 0)}`}
            accent="sky"
          />
          <MiniMetric
            label="Margin of safety"
            value={`${formatSigned(check.marginOfSafety)}%`}
            accent={check.marginOfSafety >= 0 ? "emerald" : "amber"}
          />
        </div>
        <div className="rounded-[2rem] border bg-background/85 p-4 shadow-soft">
          <p className="text-sm font-semibold text-muted-foreground">Where the stock lies</p>
          <div className="mt-3">
            <SpeedGauge
              value={check.scaleScore}
              valueLabel={`${Math.round(check.scaleScore)} / 100`}
              leftLabel="Expensive"
              centerLabel="Fair"
              rightLabel="Cheap"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {factors.map((factor) => (
          <div key={factor.id} className="rounded-[1.5rem] border bg-background/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {factor.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{factor.displayValue}</p>
            <p className="mt-2 text-sm text-muted-foreground">{factorFriendlyGuidance(factor.id)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[2rem] border bg-background/85 p-5 shadow-soft">
        <p className="text-lg font-semibold">Numbers used in this calculation</p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniMetric label="EPS" value={formatMaybe(summary.eps)} accent="violet" />
          <MiniMetric label="Book value/share" value={formatMaybe(summary.bookValue)} accent="amber" />
          <MiniMetric label="P/E" value={formatMaybe(summary.pe, "x")} accent="sky" />
          <MiniMetric label="P/B" value={formatMaybe(summary.pbv, "x")} accent="emerald" />
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Graham Number = sqrt(22.5 × EPS × Book Value per Share). This is an educational fair-value check, not a buy or sell instruction.
        </p>
      </div>
    </div>
  );
}

function CompareFactorChartSection({
  title,
  subtitle,
  firstSymbol,
  secondSymbol,
  factors,
}: {
  title: string;
  subtitle: string;
  firstSymbol: string;
  secondSymbol: string;
  factors: AnalyzerFactorComparison[];
}) {
  const wins = countSectionWins(factors);
  const winnerLabel =
    wins.first === wins.second
      ? "Balanced section"
      : wins.first > wins.second
        ? `${firstSymbol} leads this section`
        : `${secondSymbol} leads this section`;

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <IconChip accent="sky">
            <BarChart3 />
          </IconChip>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Badge
          variant={
            wins.first === wins.second
              ? "outline"
              : wins.first > wins.second
                ? "gain"
                : "warning"
          }
        >
          {winnerLabel}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {factors.map((factor) => (
          <HeadToHeadFactorCard
            key={factor.id}
            factor={factor}
            firstSymbol={firstSymbol}
            secondSymbol={secondSymbol}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function HeadToHeadFactorCard({
  factor,
  firstSymbol,
  secondSymbol,
}: {
  factor: AnalyzerFactorComparison;
  firstSymbol: string;
  secondSymbol: string;
}) {
  const visualVariant = comparisonVisualVariant(factor.id);

  return (
    <div className="rounded-[2rem] border bg-background/85 p-5 shadow-soft">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xl font-semibold tracking-tight sm:text-2xl">{factor.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {factorFriendlyGuidance(factor.id)}
            </p>
          </div>
          <Badge
            variant={
              factor.winner === "first"
                ? "gain"
                : factor.winner === "second"
                  ? "warning"
                  : "outline"
            }
          >
            {factor.winner === "first"
              ? `${firstSymbol} leads`
              : factor.winner === "second"
                ? `${secondSymbol} leads`
                : "Too close to call"}
          </Badge>
        </div>

        <div className="grid gap-3 lg:hidden">
          <div className="grid grid-cols-2 gap-3">
            <CompareValueCard
              symbol={firstSymbol}
              value={factor.firstDisplay}
              healthScore={factor.firstHealthScore}
              sharedScore={factor.firstScore}
              winner={factor.winner === "first"}
            />
            <CompareValueCard
              symbol={secondSymbol}
              value={factor.secondDisplay}
              healthScore={factor.secondHealthScore}
              sharedScore={factor.secondScore}
              winner={factor.winner === "second"}
            />
          </div>
          <ComparisonVisualPanel
            factor={factor}
            firstSymbol={firstSymbol}
            secondSymbol={secondSymbol}
            variant={visualVariant}
            firstSharedScore={factor.firstScore}
            secondSharedScore={factor.secondScore}
          />
        </div>

        <div className="hidden lg:grid lg:grid-cols-[190px_minmax(0,1fr)_190px] lg:items-center lg:gap-5 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
          <CompareValueCard
            symbol={firstSymbol}
            value={factor.firstDisplay}
            healthScore={factor.firstHealthScore}
            sharedScore={factor.firstScore}
            winner={factor.winner === "first"}
          />
          <ComparisonVisualPanel
            factor={factor}
            firstSymbol={firstSymbol}
            secondSymbol={secondSymbol}
            variant={visualVariant}
            firstSharedScore={factor.firstScore}
            secondSharedScore={factor.secondScore}
          />
          <CompareValueCard
            symbol={secondSymbol}
            value={factor.secondDisplay}
            healthScore={factor.secondHealthScore}
            sharedScore={factor.secondScore}
            winner={factor.winner === "second"}
          />
        </div>

        <div className="rounded-[1.5rem] border bg-card/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {factor.note}
        </div>
      </div>
    </div>
  );
}

function CompareValueCard({
  symbol,
  value,
  healthScore,
  sharedScore,
  winner,
}: {
  symbol: string;
  value: string;
  healthScore: number;
  sharedScore: number;
  winner: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col justify-between rounded-[1.25rem] border p-2.5 shadow-soft sm:rounded-[1.5rem] sm:p-3 lg:min-h-[188px] lg:rounded-[1.75rem] lg:p-4",
        winner ? "border-emerald-500/35 bg-emerald-500/5" : "bg-background"
      )}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs sm:tracking-[0.2em]">
          {symbol}
        </p>
        <p className="mt-3 break-words text-[1.55rem] font-bold leading-none tabular-nums sm:text-[1.75rem] lg:text-[2rem]">
          {value}
        </p>
      </div>
      <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-1 text-[10px] font-medium sm:px-3 sm:text-sm",
            healthScore >= 75 && "bg-emerald-500/10 text-gain",
            healthScore >= 50 &&
              healthScore < 75 &&
              "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            healthScore < 50 && "bg-rose-500/10 text-loss"
          )}
        >
          {scoreLabelFromScore(healthScore)}
        </span>
        <p className="text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-sm">
          {sharedScore}/100 in this matchup
        </p>
      </div>
    </div>
  );
}

function ComparisonVisualPanel({
  factor,
  firstSymbol,
  secondSymbol,
  variant,
  firstSharedScore,
  secondSharedScore,
}: {
  factor: AnalyzerFactorComparison;
  firstSymbol: string;
  secondSymbol: string;
  variant: "track" | "bars" | "arc";
  firstSharedScore: number;
  secondSharedScore: number;
}) {
  if (variant === "bars") {
    return (
      <ColumnComparisonGraph
        factorId={factor.id}
        firstSymbol={firstSymbol}
        secondSymbol={secondSymbol}
        firstDisplay={factor.firstDisplay}
        secondDisplay={factor.secondDisplay}
        firstSharedScore={firstSharedScore}
        secondSharedScore={secondSharedScore}
      />
    );
  }

  if (variant === "arc") {
    return (
      <ArcDotComparison
        factor={factor}
        firstSymbol={firstSymbol}
        secondSymbol={secondSymbol}
        firstSharedScore={firstSharedScore}
        secondSharedScore={secondSharedScore}
      />
    );
  }

  return (
    <DotTrackComparison
      factor={factor}
      firstSymbol={firstSymbol}
      secondSymbol={secondSymbol}
      firstSharedScore={firstSharedScore}
      secondSharedScore={secondSharedScore}
    />
  );
}

function DotTrackComparison({
  factor,
  firstSymbol,
  secondSymbol,
  firstSharedScore,
  secondSharedScore,
}: {
  factor: AnalyzerFactorComparison;
  firstSymbol: string;
  secondSymbol: string;
  firstSharedScore: number;
  secondSharedScore: number;
}) {
  const [hovered, setHovered] = React.useState<{
    symbol: string;
    value: string;
    score: number;
  } | null>(null);
  const labels = factorAxisLabels(factor.id);
  const firstSafeScore = clamp(firstSharedScore, 0, 100);
  const secondSafeScore = clamp(secondSharedScore, 0, 100);
  const markersAreClose = Math.abs(firstSafeScore - secondSafeScore) < 8;

  return (
    <div className="relative min-h-[154px] rounded-[1.35rem] border bg-card/80 p-3 shadow-soft sm:min-h-[220px] sm:rounded-[1.9rem] sm:p-5">
      {hovered ? (
        <GraphHoverCard
          symbol={hovered.symbol}
          value={hovered.value}
          score={hovered.score}
        />
      ) : null}
      <div className="mb-3 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mb-4 sm:gap-3 sm:text-[11px] sm:tracking-[0.18em]">
        <span>{labels.low}</span>
        <span className="text-foreground/70">Shared scale</span>
        <span>{labels.high}</span>
      </div>
      <div className="relative h-24 sm:h-36">
        <div className="absolute inset-x-2 top-9 h-7 sm:inset-x-4 sm:top-[4rem] sm:h-6">
          <div className="absolute inset-0 rounded-full bg-slate-200/80 dark:bg-slate-800/70" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500" />
          <ComparisonDot
            symbol={firstSymbol}
            value={factor.firstDisplay}
            score={firstSafeScore}
            tone="emerald"
            topOffset="top-1/2"
            labelPosition="none"
            xNudge={markersAreClose ? -8 : 0}
            onHover={setHovered}
            onLeave={() => setHovered(null)}
          />
          <ComparisonDot
            symbol={secondSymbol}
            value={factor.secondDisplay}
            score={secondSafeScore}
            tone="sky"
            topOffset="top-1/2"
            labelPosition="none"
            xNudge={markersAreClose ? 8 : 0}
            onHover={setHovered}
            onLeave={() => setHovered(null)}
          />
        </div>
        <div className="absolute inset-x-1 top-[4.95rem] flex items-center justify-between text-[10px] font-medium text-muted-foreground sm:hidden">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            {firstSymbol}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-sky-500" />
            {secondSymbol}
          </span>
        </div>
      </div>
      <div className="hidden gap-2 text-xs text-muted-foreground md:grid md:grid-cols-2">
        <p>{firstSymbol} and {secondSymbol} sit on the same scale, so the marker farther right is stronger here.</p>
        <p className="sm:text-right">Hover the markers to see the exact value behind the score.</p>
      </div>
    </div>
  );
}

function ArcDotComparison({
  factor,
  firstSymbol,
  secondSymbol,
  firstSharedScore,
  secondSharedScore,
}: {
  factor: AnalyzerFactorComparison;
  firstSymbol: string;
  secondSymbol: string;
  firstSharedScore: number;
  secondSharedScore: number;
}) {
  const id = React.useId();
  const [hovered, setHovered] = React.useState<{
    symbol: string;
    value: string;
    score: number;
  } | null>(null);
  const labels = factorAxisLabels(factor.id);

  return (
    <div className="relative min-h-[154px] rounded-[1.35rem] border bg-card/80 p-3 shadow-soft sm:min-h-[220px] sm:rounded-[1.9rem] sm:p-5">
      {hovered ? (
        <GraphHoverCard
          symbol={hovered.symbol}
          value={hovered.value}
          score={hovered.score}
        />
      ) : null}
      <div className="mb-3 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mb-4 sm:gap-3 sm:text-[11px] sm:tracking-[0.18em]">
        <span>{labels.low}</span>
        <span className="text-foreground/70">Shared speed read</span>
        <span>{labels.high}</span>
      </div>
      <svg viewBox="0 0 260 170" className="h-[110px] w-full sm:h-[170px]" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d="M 35 138 A 95 95 0 0 1 225 138"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={16}
          strokeLinecap="round"
        />
        <ArcMarker
          score={firstSharedScore}
          color={POSITIVE}
          label={firstSymbol}
          value={factor.firstDisplay}
          onHover={setHovered}
          onLeave={() => setHovered(null)}
        />
        <ArcMarker
          score={secondSharedScore}
          color={BLUE}
          label={secondSymbol}
          value={factor.secondDisplay}
          onHover={setHovered}
          onLeave={() => setHovered(null)}
        />
      </svg>
      <div className="hidden gap-2 text-xs text-muted-foreground md:grid md:grid-cols-2">
        <p>The dots move on one speed gauge, so a small financial gap shows as a small visual gap and a wider lead shows farther apart.</p>
        <p className="sm:text-right">Hover the dots to read the exact value and matchup score.</p>
      </div>
    </div>
  );
}

function ColumnComparisonGraph({
  factorId,
  firstSymbol,
  secondSymbol,
  firstDisplay,
  secondDisplay,
  firstSharedScore,
  secondSharedScore,
}: {
  factorId: AnalyzerFactor["id"];
  firstSymbol: string;
  secondSymbol: string;
  firstDisplay: string;
  secondDisplay: string;
  firstSharedScore: number;
  secondSharedScore: number;
}) {
  const [hovered, setHovered] = React.useState<{
    symbol: string;
    value: string;
    score: number;
  } | null>(null);
  const labels = factorAxisLabels(factorId);
  return (
    <div className="relative min-h-[154px] rounded-[1.35rem] border bg-card/80 p-3 shadow-soft sm:min-h-[220px] sm:rounded-[1.9rem] sm:p-5">
      {hovered ? (
        <GraphHoverCard
          symbol={hovered.symbol}
          value={hovered.value}
          score={hovered.score}
        />
      ) : null}
      <div className="mb-3 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:mb-4 sm:gap-3 sm:text-[11px] sm:tracking-[0.18em]">
        <span>{labels.low}</span>
        <span className="text-foreground/70">Strength read</span>
        <span>{labels.high}</span>
      </div>
      <div className="flex h-32 items-end justify-center gap-4 rounded-[1rem] border border-dashed border-slate-300/70 bg-background/65 px-3 py-3 dark:border-slate-700/70 sm:h-44 sm:gap-10 sm:rounded-[1.5rem] sm:px-5 sm:py-4">
        <ComparisonBarColumn
          symbol={firstSymbol}
          value={firstDisplay}
          score={firstSharedScore}
          color={POSITIVE}
          onHover={setHovered}
          onLeave={() => setHovered(null)}
        />
        <ComparisonBarColumn
          symbol={secondSymbol}
          value={secondDisplay}
          score={secondSharedScore}
          color={BLUE}
          onHover={setHovered}
          onLeave={() => setHovered(null)}
        />
      </div>
      <div className="hidden gap-2 text-xs text-muted-foreground md:grid md:grid-cols-2">
        <p>Taller bars mean the stock is scoring better on this check.</p>
        <p className="sm:text-right">Hover either bar to view the exact number being compared.</p>
      </div>
    </div>
  );
}

function ComparisonBarColumn({
  symbol,
  value,
  score,
  color,
  onHover,
  onLeave,
}: {
  symbol: string;
  value: string;
  score: number;
  color: string;
  onHover: (state: { symbol: string; value: string; score: number }) => void;
  onLeave: () => void;
}) {
  const mobileHeight = Math.min(62, 18 + score * 0.44);
  const desktopHeight = 30 + score * 0.7;
  return (
    <div className="flex flex-col items-center justify-end gap-1 sm:gap-2">
      <span className="order-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:order-1 sm:text-xs sm:tracking-[0.18em]">
        {symbol}
      </span>
      <div
        className="order-1 h-[var(--bar-height-mobile)] w-10 cursor-pointer rounded-t-xl shadow-sm transition-all hover:-translate-y-1 hover:opacity-90 sm:order-2 sm:h-[var(--bar-height-desktop)] sm:w-20 sm:rounded-t-[1.25rem]"
        style={
          {
            backgroundColor: color,
            "--bar-height-mobile": `${mobileHeight}px`,
            "--bar-height-desktop": `${desktopHeight}px`,
          } as React.CSSProperties
        }
        onMouseEnter={() => onHover({ symbol, value, score })}
        onMouseLeave={onLeave}
      />
      <span className="order-2 text-[10px] font-semibold tabular-nums sm:order-3 sm:text-sm">{score}/100</span>
    </div>
  );
}

function ComparisonDot({
  symbol,
  value,
  score,
  tone,
  topOffset,
  labelPosition,
  xNudge = 0,
  onHover,
  onLeave,
}: {
  symbol: string;
  value: string;
  score: number;
  tone: "emerald" | "sky";
  topOffset: string;
  labelPosition: "top" | "bottom" | "none";
  xNudge?: number;
  onHover: (state: { symbol: string; value: string; score: number }) => void;
  onLeave: () => void;
}) {
  return (
    <div
      className={cn("absolute -translate-x-1/2 -translate-y-1/2", topOffset)}
      style={{
        left: `clamp(10px, ${clamp(score, 0, 100)}%, calc(100% - 10px))`,
        marginLeft: `${xNudge}px`,
      }}
    >
      <div className="flex flex-col items-center gap-1">
        {labelPosition === "top" ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {symbol}
          </span>
        ) : null}
        <span
          className={cn(
            "size-3.5 cursor-pointer rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110 sm:size-[18px] sm:border-[3px]",
            tone === "emerald" ? "bg-emerald-500" : "bg-sky-500"
          )}
          onMouseEnter={() => onHover({ symbol, value, score })}
          onMouseLeave={onLeave}
        />
        {labelPosition === "bottom" ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {symbol}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ArcMarker({
  score,
  color,
  label,
  value,
  onHover,
  onLeave,
}: {
  score: number;
  color: string;
  label: string;
  value: string;
  onHover: (state: { symbol: string; value: string; score: number }) => void;
  onLeave: () => void;
}) {
  const angle = 180 - clamp(score, 0, 100) * 1.8;
  const radians = (Math.PI * angle) / 180;
  const radius = 95;
  const centerX = 130;
  const centerY = 138;
  const x = centerX + Math.cos(radians) * radius;
  const y = centerY - Math.sin(radians) * radius;
  const isLeftSide = x < centerX;
  const labelX = isLeftSide ? x - 12 : x + 12;
  const labelY = y - 2;
  const textAnchor = isLeftSide ? "end" : "start";

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={8}
        fill={color}
        stroke="white"
        strokeWidth={3}
        className="cursor-pointer"
        onMouseEnter={() => onHover({ symbol: label, value, score })}
        onMouseLeave={onLeave}
      />
      <text
        x={labelX}
        y={labelY}
        textAnchor={textAnchor}
        fontSize="10"
        fill="currentColor"
      >
        {label}
      </text>
    </g>
  );
}

function GraphHoverCard({
  symbol,
  value,
  score,
}: {
  symbol: string;
  value: string;
  score: number;
}) {
  return (
    <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border bg-background/95 px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold">{symbol}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">{value}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">Matchup score: {score}/100</p>
    </div>
  );
}

function TrendCompareBoard({
  first,
  second,
}: {
  first: AnalyzerSummary;
  second: AnalyzerSummary;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <IconChip accent="emerald">
          <LineChart />
        </IconChip>
        <div>
          <CardTitle>4-Year Financial Trends</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            These graphs show whether the current winner is also stronger over time.
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-2">
        <DualTrendChartCard
          title="Total income"
          first={first}
          second={second}
          firstSeries={first.revenue}
          secondSeries={second.revenue}
        />
        <DualTrendChartCard
          title="Profit after tax"
          first={first}
          second={second}
          firstSeries={first.profit}
          secondSeries={second.profit}
        />
        <DualTrendChartCard
          title="Earnings per share"
          first={first}
          second={second}
          firstSeries={first.epsSeries}
          secondSeries={second.epsSeries}
        />
        <DualTrendChartCard
          title="Operating cash flow"
          first={first}
          second={second}
          firstSeries={first.cashflowSeries}
          secondSeries={second.cashflowSeries}
        />
      </CardContent>
    </Card>
  );
}

function DualTrendChartCard({
  title,
  first,
  second,
  firstSeries,
  secondSeries,
}: {
  title: string;
  first: AnalyzerSummary;
  second: AnalyzerSummary;
  firstSeries: MetricPoint[];
  secondSeries: MetricPoint[];
}) {
  const data = alignSeries(firstSeries, secondSeries, first.symbol, second.symbol);

  return (
    <div className="rounded-[1.75rem] border bg-background/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-semibold">{title}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            {first.symbol}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" />
            {second.symbol}
          </span>
        </div>
      </div>
      {data.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ left: 0, right: 12, top: 10 }}>
            <defs>
              <linearGradient id={`${title}-${first.symbol}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={POSITIVE} stopOpacity={0.28} />
                <stop offset="95%" stopColor={POSITIVE} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`${title}-${second.symbol}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={GOLD} stopOpacity={0.24} />
                <stop offset="95%" stopColor={GOLD} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="period" tickLine={false} />
            <YAxis tickFormatter={compactNumber} width={56} />
            <Tooltip formatter={(value) => formatNumber(Number(value))} />
            <Area
              type="monotone"
              dataKey={first.symbol}
              stroke={POSITIVE}
              fill={`url(#${title}-${first.symbol}-fill)`}
              strokeWidth={3}
            />
            <Area
              type="monotone"
              dataKey={second.symbol}
              stroke={GOLD}
              fill={`url(#${title}-${second.symbol}-fill)`}
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          Trend data is preparing.
        </div>
      )}
    </div>
  );
}

function PositionGaugePanel({
  priceBand,
  tone,
}: {
  priceBand: RangeBand | null;
  tone: "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <IconChip accent={tone === "positive" ? "emerald" : "amber"}>
          {tone === "positive" ? <TrendingUp /> : <TrendingDown />}
        </IconChip>
        <div>
          <CardTitle>Where The Stock Lies</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            This speed gauge shows where the current market price sits inside the 52-week range.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {priceBand ? (
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="rounded-[2rem] border bg-background/85 p-4 shadow-soft">
              <SpeedGauge
                value={priceBand.position}
                valueLabel={priceBand.positionLabel}
                leftLabel="Low"
                centerLabel="Middle"
                rightLabel="High"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniMetric
                label="52W Low"
                value={`Rs ${formatNumber(priceBand.min)}`}
                accent="amber"
              />
              <MiniMetric
                label="Current"
                value={`Rs ${formatNumber(priceBand.current)}`}
                accent={tone === "positive" ? "emerald" : "sky"}
              />
              <MiniMetric
                label="52W High"
                value={`Rs ${formatNumber(priceBand.max)}`}
                accent="sky"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center rounded-[2rem] border border-dashed text-sm text-muted-foreground">
            Price range is preparing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriceSpotlightCard({
  price,
  dayChange,
  dayChangePct,
  tone,
  className,
}: {
  price: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  tone: "positive" | "negative";
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col justify-between rounded-[2rem] border bg-background/90 p-5 shadow-soft", className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Current price
      </p>
      <p className="mt-4 text-5xl font-bold tabular-nums">
        {price != null ? `Rs ${formatNumber(price)}` : "N/A"}
      </p>
      {dayChange != null || dayChangePct != null ? (
        <p
          className={cn(
            "mt-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium tabular-nums",
            tone === "positive" ? "bg-emerald-500/10 text-gain" : "bg-rose-500/10 text-loss"
          )}
        >
          {tone === "positive" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          {formatSigned(dayChange)} {dayChangePct != null ? `(${formatSigned(dayChangePct)}%)` : ""}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Latest daily move is preparing.</p>
      )}
    </div>
  );
}

function CategoryGaugeCard({
  label,
  score,
  summary,
}: {
  label: string;
  score: number;
  summary: string;
}) {
  return (
    <div className="rounded-[1.5rem] border bg-background/85 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{score}/100</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {compactCategoryInsight(score, summary)}
          </p>
        </div>
        <div className="w-28 shrink-0">
          <SpeedGauge
            value={score}
            size="sm"
            valueLabel={`${score}/100`}
            leftLabel="Low"
            rightLabel="High"
          />
        </div>
      </div>
    </div>
  );
}

function AiStoryCard({
  title,
  subtitle,
  loading,
  error,
  cacheStatus,
  onRefresh,
  fallbackMode,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  error: string | null;
  cacheStatus: string | null;
  onRefresh: () => void;
  fallbackMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card variant="feature" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-500/15 blur-3xl"
        aria-hidden
      />
      <CardHeader className="relative flex flex-col gap-3 border-b bg-gradient-to-r from-violet-500/10 via-fuchsia-500/5 to-transparent sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip accent="violet" variant="gradient" size="lg" className="mt-0.5">
            <Brain />
          </IconChip>
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {title}
              {fallbackMode ? <Badge variant="outline">Fallback ready</Badge> : null}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh AI
        </Button>
      </CardHeader>
      <CardContent className="relative space-y-5 p-5">
        {!loading && error && cacheStatus ? (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last cache: {cacheStatus}
          </p>
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}

function AiBulletCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "positive" && "border-emerald-500/25 bg-emerald-500/5",
        tone === "warning" && "border-amber-500/25 bg-amber-500/5",
        tone === "neutral" && "bg-background"
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          tone === "positive" && "text-gain",
          tone === "warning" && "text-amber-600 dark:text-amber-300"
        )}
      >
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <p key={`${title}-${index}`} className="text-sm leading-6 text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function LoadingProgressCard({
  icon,
  heading,
  steps,
  compact = false,
}: {
  icon: React.ReactNode;
  heading: string;
  steps: LoadingStage[];
  compact?: boolean;
}) {
  const stage = useLoadingStage(steps);

  return (
    <Card className={cn(compact && "border-dashed")}>
      <CardContent className={cn("space-y-5", compact ? "p-4" : "p-5 sm:p-6")}>
        <div className="flex items-start gap-3">
          <IconChip accent="violet" variant="gradient" size={compact ? "default" : "lg"}>
            {icon}
          </IconChip>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-foreground">{heading}</p>
            <p className="mt-1 text-sm text-muted-foreground">{stage.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{stage.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {steps.map((step) => {
            const isActive = stage.title === step.title;
            const isDone = stage.percent > step.percent;
            return (
              <div
                key={step.title}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  isActive && "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
                  isDone && "border-emerald-500/30 bg-emerald-500/10 text-gain",
                  !isActive && !isDone && "bg-background text-muted-foreground"
                )}
              >
                {step.title}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function FallbackNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-6 text-foreground/90">
      <p className="font-semibold text-amber-600 dark:text-amber-300">AI response unavailable</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

function ScoreRadarCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: Array<Record<string, string | number>>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <IconChip accent="sky">
          <BarChart3 />
        </IconChip>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" />
            <PolarRadiusAxis domain={[0, 100]} tickCount={6} />
            <Radar
              name="Score"
              dataKey="score"
              stroke={POSITIVE}
              fill={POSITIVE}
              fillOpacity={0.2}
            />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function SeriesPanelCard({
  title,
  subtitle,
  series,
  color,
}: {
  title: string;
  subtitle: string;
  series: MetricPoint[];
  color: string;
}) {
  const gradientId = `grad-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;

  return (
    <div className="rounded-[1.75rem] border bg-background/80 p-4">
      <div className="mb-3 flex items-start gap-3">
        <IconChip accent="sky">
          <LineChart />
        </IconChip>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {series.length ? (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={series} margin={{ left: 0, right: 12, top: 10 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="period" tickLine={false} />
            <YAxis tickFormatter={compactNumber} width={56} />
            <Tooltip formatter={(value) => formatNumber(Number(value))} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#${gradientId})`}
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
          Chart data is preparing.
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="grid size-28 place-items-center rounded-full"
      style={{
        background: `conic-gradient(${score >= 70 ? POSITIVE : score >= 50 ? GOLD : NEGATIVE} ${score}%, rgba(148,163,184,0.18) 0)`,
      }}
    >
      <div className="grid size-[5.5rem] place-items-center rounded-full bg-card">
        <div className="text-center">
          <p className="text-2xl font-bold tabular-nums">{score}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            out of 100
          </p>
        </div>
      </div>
    </div>
  );
}

function SpeedGauge({
  value,
  valueLabel,
  leftLabel,
  centerLabel,
  rightLabel,
  size = "md",
}: {
  value: number;
  valueLabel: string;
  leftLabel: string;
  centerLabel?: string;
  rightLabel: string;
  size?: "sm" | "md";
}) {
  const id = React.useId();
  const safeValue = clamp(value, 0, 100);
  const angle = 180 - safeValue * 1.8;
  const radians = (Math.PI * angle) / 180;
  const radius = size === "sm" ? 44 : 58;
  const centerX = 100;
  const centerY = 110;
  const needleX = centerX + Math.cos(radians) * radius;
  const needleY = centerY - Math.sin(radians) * radius;
  const wrapperClass = size === "sm" ? "h-[112px]" : "h-[148px]";
  const svgClass = size === "sm" ? "h-[88px] w-full" : "h-[110px] w-full";

  return (
    <div className={cn("w-full", wrapperClass)}>
      <svg viewBox="0 0 200 120" className={svgClass} aria-hidden>
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="48%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={14}
          strokeLinecap="round"
        />
        <line
          x1={centerX}
          y1={centerY}
          x2={needleX}
          y2={needleY}
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={centerX} cy={centerY} r={8} fill="currentColor" />
      </svg>
      <div className="-mt-2 text-center">
        <p className={cn("font-semibold text-foreground", size === "sm" ? "text-sm" : "text-base")}>
          {valueLabel}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{leftLabel}</span>
        <span className="text-center">{centerLabel ?? ""}</span>
        <span className="text-right">{rightLabel}</span>
      </div>
    </div>
  );
}

function statusLabelFromFactorStatus(status: AnalyzerFactor["status"]) {
  if (status === "strong") return "Strong";
  if (status === "good") return "Healthy";
  if (status === "mixed") return "Mixed";
  if (status === "weak") return "Weak";
  return "N/A";
}

function scoreLabelFromScore(score: number) {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Average";
  return "Weak";
}

function buildValueCheck(summary: AnalyzerSummary, currentPrice: number | null) {
  const eps = summary.eps;
  const bookValue = summary.bookValue;

  if (
    currentPrice == null ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    eps == null ||
    !Number.isFinite(eps) ||
    eps <= 0 ||
    bookValue == null ||
    !Number.isFinite(bookValue) ||
    bookValue <= 0
  ) {
    return {
      available: false as const,
      grahamNumber: null,
      currentPrice,
      marginOfSafety: 0,
      scaleScore: 50,
      verdict: "Fairly priced" as const,
      summary: "We need a usable EPS, book value per share and market price before this fair-value check can be calculated.",
    };
  }

  const grahamNumber = Math.sqrt(22.5 * eps * bookValue);
  const marginOfSafety = ((grahamNumber - currentPrice) / grahamNumber) * 100;
  const scaleScore = clamp(50 + marginOfSafety, 0, 100);
  const verdict =
    marginOfSafety >= 20
      ? "Undervalued"
      : marginOfSafety <= -15
        ? "Overvalued"
        : "Fairly priced";
  const verdictSummary =
    verdict === "Undervalued"
      ? `The stock looks cheaper than its Graham Number. Fair worth is around Rs ${formatNumber(grahamNumber)}, while the market price is Rs ${formatNumber(currentPrice)}.`
      : verdict === "Overvalued"
        ? `The stock is trading above its Graham Number. Fair worth is around Rs ${formatNumber(grahamNumber)}, while the market price is Rs ${formatNumber(currentPrice)}.`
        : `The market price is sitting close to the Graham Number, so the stock looks broadly fair on this check.`;

  return {
    available: true as const,
    grahamNumber,
    currentPrice,
    marginOfSafety,
    scaleScore,
    verdict,
    summary: verdictSummary,
  };
}

function factorFriendlyGuidance(factorId: AnalyzerFactor["id"]) {
  switch (factorId) {
    case "roce":
      return "Higher ROCE means management is using business capital more efficiently.";
    case "roe":
      return "Higher ROE means shareholders are getting a stronger return on their equity.";
    case "operating-margin":
      return "Higher operating margin means the core business keeps more from every sales rupee.";
    case "net-margin":
      return "Higher net margin means more revenue is turning into final profit.";
    case "gross-margin":
      return "Higher gross margin means the business keeps more after direct production costs.";
    case "cfo-to-net-income":
      return "Above 1.0x usually means reported profit is backed by real operating cash.";
    case "fcf-yield":
      return "Higher free cash flow yield means the stock is generating more cash against its market value.";
    case "net-debt-to-ebitda":
      return "Lower net debt to EBITDA means debt pressure is lighter and easier to manage.";
    case "interest-coverage":
      return "Higher interest coverage means finance costs are more comfortably covered.";
    case "pe-ratio":
      return "Lower P/E means you are paying less for each rupee of earnings, if the business quality holds up.";
    case "ev-to-ebitda":
      return "Lower EV/EBITDA can signal a cheaper business even after including debt.";
    case "debt-to-equity":
      return "Lower debt to equity means the balance sheet relies less on borrowing.";
    case "current-ratio":
      return "Above 1.0x means short-term obligations are being covered more comfortably.";
    case "receivable-days":
      return "Lower receivable days means the company is collecting cash from customers faster.";
    case "pb-ratio":
      return "Lower P/B means the stock is trading closer to its net asset value.";
    case "dividend-yield":
      return "Higher dividend yield means the stock is offering more cash income at the current price.";
  }
}

function comparisonVisualVariant(factorId: AnalyzerFactor["id"]) {
  if (["cfo-to-net-income", "current-ratio", "interest-coverage"].includes(factorId)) {
    return "arc" as const;
  }

  if (
    [
      "pe-ratio",
      "ev-to-ebitda",
      "pb-ratio",
      "dividend-yield",
      "net-debt-to-ebitda",
      "debt-to-equity",
      "receivable-days",
    ].includes(factorId)
  ) {
    return "arc" as const;
  }

  return "bars" as const;
}

function factorAxisLabels(factorId: AnalyzerFactor["id"]) {
  switch (factorId) {
    case "pe-ratio":
    case "ev-to-ebitda":
    case "pb-ratio":
      return { low: "Pricey", high: "Better value" };
    case "dividend-yield":
      return { low: "Low payout", high: "Higher income" };
    case "net-debt-to-ebitda":
    case "debt-to-equity":
      return { low: "Heavy debt", high: "Safer balance sheet" };
    case "current-ratio":
      return { low: "Tight liquidity", high: "Comfortable liquidity" };
    case "interest-coverage":
      return { low: "Interest pressure", high: "Comfortably covered" };
    case "cfo-to-net-income":
      return { low: "Weak conversion", high: "Cash-backed profit" };
    case "receivable-days":
      return { low: "Slow collection", high: "Faster collection" };
    default:
      return { low: "Weaker", high: "Stronger" };
  }
}

function compactCategoryInsight(score: number, summary: string) {
  if (score >= 80) return "Clear strength right now.";
  if (score >= 65) return "Healthy on this snapshot.";
  if (score >= 50) return "Usable, but not a clear edge yet.";
  if (score > 0) return "This area still needs work.";
  return summary;
}

const MINI_METRIC_VALUE: Partial<Record<Accent, string>> = {
  sky: "text-sky-600 dark:text-sky-300",
  indigo: "text-indigo-600 dark:text-indigo-300",
  emerald: "text-emerald-600 dark:text-emerald-300",
  amber: "text-amber-600 dark:text-amber-300",
  violet: "text-violet-600 dark:text-violet-300",
};

function MiniMetric({ label, value, accent }: { label: string; value: string; accent?: Accent }) {
  return (
    <div className="rounded-[1.35rem] border bg-background p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-semibold tabular-nums", accent && MINI_METRIC_VALUE[accent])}>
        {value}
      </p>
    </div>
  );
}

function SnapshotMetricBoard({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle: string;
  metrics: Array<[string, string, Accent?]>;
}) {
  return (
    <div className="rounded-[2rem] border bg-card/80 p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant="outline">{metrics.length} markers</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {metrics.map(([label, value, accent]) => (
          <MiniMetric key={label} label={label} value={value} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function useFinancials(symbol: string) {
  const [data, setData] = React.useState<StockFinancialsData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!symbol) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setData(null);
    setLoading(true);
    setError(null);

    fetch(`/api/public/stock-financials/${encodeURIComponent(symbol)}`, {
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return (await response.json()) as FinancialApiResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json.data);
      })
      .catch((fetchError: Error) => {
        if (!cancelled) {
          setData(null);
          setError(fetchError.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { data, isLoading: loading, error };
}

function useIndexConstituents(symbol: string) {
  const [constituents, setConstituents] = React.useState<IndexConstituent[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/index/${symbol}`, { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Index unavailable");
        return (await response.json()) as IndexDetailPayload;
      })
      .then((json) => {
        if (!cancelled) setConstituents(json.constituents ?? []);
      })
      .catch(() => {
        if (!cancelled) setConstituents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { constituents };
}

function useStockAnalyzerAi<T>(body: Record<string, unknown> | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [cache, setCache] = React.useState<AiApiResponse<T>["cache"] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const serializedBody = body ? JSON.stringify(body) : null;

  React.useEffect(() => {
    if (!serializedBody) {
      setData(null);
      setCache(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setData(null);
    setCache(null);
    setLoading(true);
    setError(null);

    fetch("/api/public/stock-analyzer/ai", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: serializedBody,
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as AiApiResponse<T> & { error?: string };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "AI insight is unavailable right now.");
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setData(payload.data);
        setCache(payload.cache ?? null);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        if ((fetchError as Error).name === "AbortError") return;
        setError(
          fetchError instanceof Error ? fetchError.message : "AI insight is unavailable right now."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshNonce, serializedBody]);

  return {
    data,
    cache,
    loading,
    error,
    refresh: () => setRefreshNonce((current) => current + 1),
  };
}

function useLoadingStage(steps: LoadingStage[]) {
  const serializedSteps = JSON.stringify(steps);
  const stableSteps = React.useMemo<LoadingStage[]>(
    () => JSON.parse(serializedSteps) as LoadingStage[],
    [serializedSteps]
  );
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex(0);
    const timers = stableSteps.slice(1).map((_, stepIndex) =>
      window.setTimeout(() => setIndex(stepIndex + 1), 600 + stepIndex * 900)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [stableSteps]);

  return stableSteps[index] ?? stableSteps[stableSteps.length - 1];
}

function mergeAnalyzeFactorNotes(
  ...groups: Array<Array<{ factorId: string; note: string }>>
) {
  const notes = new Map<string, string>();
  groups.forEach((group) => {
    group.forEach((item) => {
      if (item.factorId && item.note) notes.set(item.factorId, item.note);
    });
  });
  return notes;
}

function filterCompanies(
  companies: CompanyOption[],
  universeSymbols: Set<string> | null,
  query: string
) {
  const term = query.trim().toLowerCase();
  return companies
    .filter((company) => !universeSymbols || universeSymbols.has(company.symbol))
    .filter((company) =>
      term
        ? `${company.symbol} ${company.name} ${company.sector}`.toLowerCase().includes(term)
        : true
    )
    .slice(0, 120);
}

function factorDisplay(summary: AnalyzerSummary, factorId: AnalyzerFactor["id"]) {
  return summary.factors.find((factor) => factor.id === factorId)?.displayValue ?? "N/A";
}

function badgeVariantForFactor(status: AnalyzerFactor["status"]) {
  if (status === "strong" || status === "good") return "gain";
  if (status === "weak") return "loss";
  return "outline";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
    minimumFractionDigits: Math.abs(value) < 10 ? 2 : 0,
  }).format(value);
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMaybe(value: number | null, suffix = "") {
  return value == null ? "N/A" : `${formatNumber(value)}${suffix}`;
}

function formatSigned(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}

function pickFactors(summary: AnalyzerSummary, ids: Array<AnalyzerFactor["id"]>) {
  return ids
    .map((id) => summary.factors.find((factor) => factor.id === id))
    .filter((factor): factor is AnalyzerFactor => Boolean(factor));
}

function pickComparisonFactors(
  comparison: AnalyzerComparison,
  ids: Array<AnalyzerFactorComparison["id"]>
) {
  return ids
    .map((id) => comparison.factors.find((factor) => factor.id === id))
    .filter((factor): factor is AnalyzerFactorComparison => Boolean(factor));
}

function buildSeriesRange(series: MetricPoint[], current: number | null): RangeBand | null {
  const values = series.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (current != null) values.push(current);
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const safeCurrent = current ?? values[values.length - 1];
  const position =
    max === min ? 50 : clamp(((safeCurrent - min) / (max - min)) * 100, 0, 100);
  return {
    min,
    max,
    current: safeCurrent,
    position,
    positionLabel:
      position <= 33
        ? "Near lower range"
        : position >= 67
          ? "Near upper range"
          : "Sitting near the middle",
  };
}

function buildExplicitRange(min: number, max: number, current: number | null): RangeBand | null {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const safeCurrent = current ?? safeMin;
  const position =
    safeMax === safeMin ? 50 : clamp(((safeCurrent - safeMin) / (safeMax - safeMin)) * 100, 0, 100);

  return {
    min: safeMin,
    max: safeMax,
    current: safeCurrent,
    position,
    positionLabel:
      position <= 33
        ? "Near 52-week low"
        : position >= 67
          ? "Near 52-week high"
          : "Sitting near the middle",
  };
}

function countSectionWins(factors: AnalyzerFactorComparison[]) {
  return {
    first: factors.filter((factor) => factor.winner === "first").length,
    second: factors.filter((factor) => factor.winner === "second").length,
    ties: factors.filter((factor) => factor.winner === "tie").length,
  };
}

function alignSeries(
  firstSeries: MetricPoint[],
  secondSeries: MetricPoint[],
  firstLabel: string,
  secondLabel: string
) {
  const periods = Array.from(
    new Set([...firstSeries.map((point) => point.period), ...secondSeries.map((point) => point.period)])
  ).slice(-5);
  const firstMap = new Map(firstSeries.map((point) => [point.period, point.value]));
  const secondMap = new Map(secondSeries.map((point) => [point.period, point.value]));
  return periods.map((period) => ({
    period,
    [firstLabel]: firstMap.get(period) ?? 0,
    [secondLabel]: secondMap.get(period) ?? 0,
  }));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
