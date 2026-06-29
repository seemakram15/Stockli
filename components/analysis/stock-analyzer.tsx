"use client";

import * as React from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  GitCompareArrows,
  LineChart,
  Loader2,
  Scale,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type {
  FinancialTableRow,
  StockFinancialsData,
  StockFinancialTabId,
} from "@/lib/types/stock-fundamentals";
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
type AnalyzerMode = "analyze" | "compare";

type FinancialApiResponse = {
  data: StockFinancialsData;
  cache?: { status: string; storedAt: string };
};

type MetricPoint = {
  period: string;
  value: number;
};

type AnalyzerSummary = {
  symbol: string;
  name: string;
  sector: string;
  quote: IndexConstituent | null;
  marketCap: number | null;
  bookValue: number | null;
  eps: number | null;
  dps: number | null;
  pe: number | null;
  pbv: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  roe: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  priceToBookSignal: "cheap" | "fair" | "expensive";
  healthScore: number;
  riskScore: number;
  verdict: string;
  businessText: string;
  revenue: MetricPoint[];
  profit: MetricPoint[];
  epsSeries: MetricPoint[];
  dpsSeries: MetricPoint[];
};

const POSITIVE = "#059669";
const NEGATIVE = "#e11d48";
const BLUE = "#2563eb";
const GOLD = "#d99a00";

export function StockAnalyzer() {
  const [mode, setMode] = React.useState<AnalyzerMode>("analyze");
  const [universe, setUniverse] = React.useState<Universe>("KSE100");
  const [query, setQuery] = React.useState("");
  const [selectedSymbol, setSelectedSymbol] = React.useState<string>("");
  const [compareA, setCompareA] = React.useState<string>("");
  const [compareB, setCompareB] = React.useState<string>("");
  const [analyzeSymbol, setAnalyzeSymbol] = React.useState<string>("");

  const companiesResource = usePersistentResource<CompaniesPayload>({
    cacheKey: "public:stock-fundamentals:companies:v1",
    url: "/api/public/stock-fundamentals/companies",
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

  const filteredCompanies = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return companies
      .filter((company) => !universeSymbols || universeSymbols.has(company.symbol))
      .filter((company) =>
        term
          ? `${company.symbol} ${company.name} ${company.sector}`.toLowerCase().includes(term)
          : true
      )
      .slice(0, 120);
  }, [companies, query, universeSymbols]);

  React.useEffect(() => {
    if (selectedSymbol && filteredCompanies.some((company) => company.symbol === selectedSymbol)) {
      return;
    }
    setSelectedSymbol(filteredCompanies[0]?.symbol ?? "");
  }, [filteredCompanies, selectedSymbol]);

  const analyzerFinancials = useFinancials(analyzeSymbol);
  const compareAFinancials = useFinancials(compareA);
  const compareBFinancials = useFinancials(compareB);

  const analyzeSummary = analyzerFinancials.data
    ? buildAnalyzerSummary(analyzerFinancials.data, quoteMap.get(analyzerFinancials.data.symbol) ?? null)
    : null;
  const compareSummaryA = compareAFinancials.data
    ? buildAnalyzerSummary(compareAFinancials.data, quoteMap.get(compareAFinancials.data.symbol) ?? null)
    : null;
  const compareSummaryB = compareBFinancials.data
    ? buildAnalyzerSummary(compareBFinancials.data, quoteMap.get(compareBFinancials.data.symbol) ?? null)
    : null;

  function analyzeSelected() {
    if (!selectedSymbol) return;
    setAnalyzeSymbol(selectedSymbol);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_35%),linear-gradient(135deg,rgba(248,244,235,0.9),rgba(255,255,255,0.96))] px-4 py-8 text-center shadow-sm sm:px-8 sm:py-12">
        <Badge className="mx-auto h-9 gap-2 rounded-full bg-primary/10 px-5 text-sm font-semibold text-primary">
          <TrendingUp className="size-4" />
          Free PSX stock analysis for Pakistani investors
        </Badge>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Understand any PSX stock in plain English
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
          Pick a company and Stockli turns cached fundamentals, price movement, dividend history
          and peer-style metrics into a simple investment story.
        </p>
      </section>

      <Card className="overflow-hidden border-primary/20">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
            <div
              role="tablist"
              aria-label="Stock analyzer mode"
              className="grid w-full grid-cols-2 gap-1 rounded-2xl border bg-muted/70 p-1"
            >
              {([
                ["analyze", LineChart, "Analyze a Stock"],
                ["compare", GitCompareArrows, "Compare Two Stocks"],
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
                      "flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition sm:text-base",
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
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
                      ? "bg-primary text-primary-foreground shadow-sm"
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
                companies={filteredCompanies}
                value={selectedSymbol}
                onChange={setSelectedSymbol}
                query={query}
                onQueryChange={setQuery}
                loading={companiesResource.isLoading}
              />
              <Button
                type="button"
                size="lg"
                disabled={!selectedSymbol || analyzerFinancials.isLoading}
                onClick={analyzeSelected}
                className="h-12 px-8 text-base"
              >
                {analyzerFinancials.isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Analyze Stock
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <StockPicker
                companies={filteredCompanies}
                value={compareA}
                onChange={setCompareA}
                query={query}
                onQueryChange={setQuery}
                loading={companiesResource.isLoading}
                placeholder="First stock..."
              />
              <StockPicker
                companies={filteredCompanies}
                value={compareB}
                onChange={setCompareB}
                query={query}
                onQueryChange={setQuery}
                loading={companiesResource.isLoading}
                placeholder="Second stock..."
              />
              <Button
                type="button"
                size="lg"
                disabled={!compareA || !compareB || compareA === compareB}
                className="h-12 px-8 text-base"
              >
                <Scale className="size-4" />
                Compare
              </Button>
            </div>
          )}

          {mode === "analyze" && !analyzeSymbol ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["1", "Pick a Stock", "Search and select any PSX-listed company."],
                ["2", "Click Analyze", "We read Stockli's cached fundamentals and market data."],
                ["3", "Read the Results", "Get simple signals, charts and dividend context."],
              ].map(([step, title, copy]) => (
                <div key={step} className="rounded-2xl border bg-card p-5 text-center shadow-sm">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {mode === "analyze" ? (
        <AnalyzeResult
          loading={analyzerFinancials.isLoading}
          error={analyzerFinancials.error}
          data={analyzerFinancials.data}
          summary={analyzeSummary}
        />
      ) : (
        <CompareResult
          first={compareSummaryA}
          second={compareSummaryB}
          loading={compareAFinancials.isLoading || compareBFinancials.isLoading}
          error={compareAFinancials.error || compareBFinancials.error}
        />
      )}
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
  placeholder = "Pick a stock to analyze...",
}: {
  companies: CompanyOption[];
  value: string;
  onChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  placeholder?: string;
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
      <div className="max-h-56 overflow-y-auto rounded-2xl border bg-card p-1 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading stocks...
          </div>
        ) : companies.length ? (
          companies.slice(0, 60).map((company) => (
            <button
              key={`${company.id}-${company.symbol}`}
              type="button"
              onClick={() => {
                onChange(company.symbol);
                onQueryChange("");
              }}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-muted",
                value === company.symbol && "bg-primary/10 text-primary"
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
    </div>
  );
}

function AnalyzeResult({
  loading,
  error,
  data,
  summary,
}: {
  loading: boolean;
  error: string | null;
  data: StockFinancialsData | null;
  summary: AnalyzerSummary | null;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-56 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          Loading stock analysis...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Company analysis is preparing and will appear here shortly.
        </CardContent>
      </Card>
    );
  }

  if (!summary || !data) return null;

  const price = summary.quote?.current ?? latestValueFromRows(data, [/current price/i, /^close/i]);
  const dayChange = summary.quote?.change ?? null;
  const dayChangePct = summary.quote?.changePct ?? null;
  const priceTone = (dayChangePct ?? 0) >= 0 ? "positive" : "negative";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-background via-background to-primary/5">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{summary.name}</h2>
              <Badge variant="outline">{summary.symbol}</Badge>
              <Badge className="bg-primary/10 text-primary">{summary.sector}</Badge>
            </div>
            <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {summary.businessText}
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Current price
            </p>
            <p className="mt-2 text-3xl font-semibold">
              {price != null ? `Rs ${formatNumber(price)}` : "Preparing"}
            </p>
            {dayChange != null || dayChangePct != null ? (
              <p
                className={cn(
                  "mt-1 text-sm font-medium",
                  priceTone === "positive" ? "text-primary" : "text-destructive"
                )}
              >
                {formatSigned(dayChange)} {dayChangePct != null ? `(${formatSigned(dayChangePct)}%)` : ""}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <MiniMetric label="P/E" value={formatMaybe(summary.pe, "x")} />
              <MiniMetric label="P/B" value={formatMaybe(summary.pbv, "x")} />
              <MiniMetric label="EPS" value={formatMaybe(summary.eps)} />
              <MiniMetric label="ROE" value={formatMaybe(summary.roe, "%")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SignalCard
          title="Book Value / Share"
          value={formatMaybe(summary.bookValue)}
          status={summary.priceToBookSignal}
          note="Useful for checking cheap vs expensive."
        />
        <SignalCard
          title="Dividend Yield"
          value={formatMaybe(summary.dividendYield, "%")}
          status={(summary.dividendYield ?? 0) > 5 ? "healthy" : "neutral"}
          note="How much cash return shareholders may receive."
        />
        <SignalCard
          title="Profitability"
          value={formatMaybe(summary.netMargin, "%")}
          status={(summary.netMargin ?? 0) > 10 ? "healthy" : "neutral"}
          note="Net margin from available records."
        />
        <SignalCard
          title="Risk Level"
          value={`${summary.riskScore}/100`}
          status={summary.riskScore > 60 ? "risky" : "healthy"}
          note="Debt, valuation and earnings stability."
        />
      </div>

      <ChartCard
        title="Price / value history"
        subtitle="Best available cached price-like history from fundamentals."
        series={getPriceLikeSeries(data)}
        type="line"
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <ChartCard title="Total income" subtitle="Revenue trend" series={summary.revenue} />
        <ChartCard title="Profit after tax" subtitle="Profit trend" series={summary.profit} />
        <ChartCard title="EPS" subtitle="Earnings per share" series={summary.epsSeries} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Final verdict
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-primary/5 p-4">
              <p className="text-lg font-semibold text-primary">{summary.verdict}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This verdict is a plain-English read of cached fundamentals. Use it as a starting
                point, then review company notices, sector news and your risk tolerance.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <MiniMetric label="Health score" value={`${summary.healthScore}/100`} />
              <MiniMetric label="Payout ratio" value={formatMaybe(summary.payoutRatio, "%")} />
              <MiniMetric label="Revenue growth" value={formatMaybe(summary.revenueGrowth, "%")} />
              <MiniMetric label="EPS growth" value={formatMaybe(summary.epsGrowth, "%")} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dividend check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-2xl bg-muted p-4 text-center">
              <CheckCircle2 className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-xl font-semibold">
                {(summary.dps ?? 0) > 0 ? "Pays dividends" : "No recent dividend found"}
              </p>
              <p className="text-sm text-muted-foreground">Based on DPS rows in cached records.</p>
            </div>
            <SimpleSeriesTable rows={summary.dpsSeries} empty="Dividend history is preparing." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CompareResult({
  first,
  second,
  loading,
  error,
}: {
  first: AnalyzerSummary | null;
  second: AnalyzerSummary | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex min-h-40 items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          Loading comparison...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Company fundamentals are preparing and will appear here shortly.
        </CardContent>
      </Card>
    );
  }

  if (!first || !second) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Choose two different stocks to compare valuation, profit, dividends and risk.
        </CardContent>
      </Card>
    );
  }

  const rows = [
    makeCompareRow("Current price", first.quote?.current ?? null, second.quote?.current ?? null, "neutral"),
    makeCompareRow("P/E ratio", first.pe, second.pe, "lower"),
    makeCompareRow("P/B ratio", first.pbv, second.pbv, "lower"),
    makeCompareRow("Dividend yield", first.dividendYield, second.dividendYield, "higher", "%"),
    makeCompareRow("ROE", first.roe, second.roe, "higher", "%"),
    makeCompareRow("Net margin", first.netMargin, second.netMargin, "higher", "%"),
    makeCompareRow("Debt to equity", first.debtToEquity, second.debtToEquity, "lower"),
    makeCompareRow("Revenue growth", first.revenueGrowth, second.revenueGrowth, "higher", "%"),
    makeCompareRow("Health score", first.healthScore, second.healthScore, "higher"),
  ];
  const firstWins = rows.filter((row) => row.winner === "first").length;
  const secondWins = rows.filter((row) => row.winner === "second").length;
  const winner = firstWins === secondWins ? "Balanced match" : firstWins > secondWins ? first.symbol : second.symbol;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <CompareStockCard summary={first} wins={firstWins} />
        <CompareStockCard summary={second} wins={secondWins} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Side-by-side scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-3">Metric</th>
                  <th className="px-3 py-3">{first.symbol}</th>
                  <th className="px-3 py-3">{second.symbol}</th>
                  <th className="px-3 py-3">Better read</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b">
                    <td className="px-3 py-3 font-medium">{row.label}</td>
                    <td className={cn("px-3 py-3", row.winner === "first" && "font-semibold text-primary")}>
                      {row.first}
                    </td>
                    <td className={cn("px-3 py-3", row.winner === "second" && "font-semibold text-primary")}>
                      {row.second}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plain-English result
            </p>
            <h3 className="mt-2 text-3xl font-bold">{winner}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {winner === "Balanced match"
                ? "Both stocks have mixed strengths. Compare sector cycle, dividend certainty and your holding period before deciding."
                : `${winner} currently has the stronger score on this cached fundamental snapshot.`}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { name: first.symbol, score: firstWins },
                { name: second.symbol, score: secondWins },
              ]}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="score" radius={[10, 10, 0, 0]}>
                <Cell fill={POSITIVE} />
                <Cell fill={GOLD} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function CompareStockCard({ summary, wins }: { summary: AnalyzerSummary; wins: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold">{summary.symbol}</p>
            <p className="text-sm text-muted-foreground">{summary.name}</p>
          </div>
          <Badge className="bg-primary/10 text-primary">{wins} wins</Badge>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <MiniMetric label="Price" value={summary.quote?.current ? `Rs ${formatNumber(summary.quote.current)}` : "N/A"} />
          <MiniMetric label="Health" value={`${summary.healthScore}/100`} />
          <MiniMetric label="P/E" value={formatMaybe(summary.pe, "x")} />
          <MiniMetric label="Dividend" value={formatMaybe(summary.dividendYield, "%")} />
        </div>
      </CardContent>
    </Card>
  );
}

function SignalCard({
  title,
  value,
  status,
  note,
}: {
  title: string;
  value: string;
  status: "cheap" | "fair" | "expensive" | "healthy" | "neutral" | "risky";
  note: string;
}) {
  const positive = status === "cheap" || status === "healthy";
  const negative = status === "expensive" || status === "risky";
  return (
    <Card className={cn("border", positive && "border-primary/25", negative && "border-destructive/20")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <Badge
            variant={negative ? "destructive" : "outline"}
            className={cn(positive && "bg-primary/10 text-primary")}
          >
            {status}
          </Badge>
        </div>
        <p className={cn("mt-3 text-2xl font-semibold", positive && "text-primary", negative && "text-destructive")}>
          {value}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  series,
  type = "bar",
}: {
  title: string;
  subtitle: string;
  series: MetricPoint[];
  type?: "bar" | "line";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {type === "line" ? <LineChart className="size-5 text-primary" /> : <BarChart3 className="size-5 text-primary" />}
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {series.length ? (
          <ResponsiveContainer width="100%" height={260}>
            {type === "line" ? (
              <ReLineChart data={series} margin={{ left: 6, right: 16, top: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} />
                <YAxis tickFormatter={compactNumber} width={48} />
                <Tooltip formatter={(value) => formatNumber(Number(value))} />
                <Line dataKey="value" stroke={POSITIVE} strokeWidth={3} dot={{ r: 3 }} />
              </ReLineChart>
            ) : (
              <BarChart data={series} margin={{ left: 6, right: 16, top: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="period" tickLine={false} />
                <YAxis tickFormatter={compactNumber} width={48} />
                <Tooltip formatter={(value) => formatNumber(Number(value))} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {series.map((point) => (
                    <Cell key={point.period} fill={point.value >= 0 ? BLUE : NEGATIVE} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
            Chart data is preparing.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SimpleSeriesTable({ rows, empty }: { rows: MetricPoint[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-2xl border">
      {rows.slice(-8).map((row) => (
        <div key={row.period} className="flex items-center justify-between border-b px-4 py-3 last:border-b-0">
          <span className="font-medium">{row.period}</span>
          <span>{formatNumber(row.value)}</span>
        </div>
      ))}
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
      .catch((err: Error) => {
        if (!cancelled) {
          setData(null);
          setError(err.message);
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

function buildAnalyzerSummary(data: StockFinancialsData, quote: IndexConstituent | null): AnalyzerSummary {
  const company = data.company;
  const revenue = findSeries(data, [/^net sales$/i, /^sales$/i, /revenue/i]);
  const profit = findSeries(data, [/^profit after tax$/i, /profit after tax a\/t company owners/i, /net income/i]);
  const epsSeries = findSeries(data, [/^eps - basic$/i, /^eps \(pkr\)$/i, /^eps$/i]);
  const dpsSeries = findSeries(data, [/^dps/i, /dividend per share/i]);
  const bookValue = latestMetric(data, [/^bvps/i, /book value/i]);
  const eps = latestFromSeries(epsSeries);
  const dps = latestFromSeries(dpsSeries);
  const pe = latestMetric(data, [/^per \(x\)$/i, /^pe$/i, /^p\/e/i]);
  const pbv = latestMetric(data, [/^pbv$/i, /^p\/b/i]);
  const dividendYield = latestMetric(data, [/div yield/i, /dividend yield/i]);
  const roe = latestMetric(data, [/^roe/i, /return on equity/i]);
  const netMargin = latestMetric(data, [/net margin/i]);
  const debtToEquity = latestMetric(data, [/debt to equity/i]);
  const marketCap = latestMetric(data, [/market cap/i]);
  const payoutRatio = eps && dps ? (dps / eps) * 100 : null;
  const revenueGrowth = growth(revenue);
  const epsGrowth = growth(epsSeries);
  const price = quote?.current ?? latestValueFromRows(data, [/current price/i, /^close/i]);
  const priceToBookSignal =
    price && bookValue ? (price / bookValue < 1.2 ? "cheap" : price / bookValue > 3 ? "expensive" : "fair") : "fair";
  const healthScore = clamp(
    50 +
      scorePositive(roe, 15, 10) +
      scorePositive(netMargin, 10, 10) +
      scorePositive(revenueGrowth, 5, 10) +
      scorePositive(epsGrowth, 5, 10) +
      scoreNegative(debtToEquity, 100, 10) +
      scorePositive(dividendYield, 4, 5),
    0,
    100
  );
  const riskScore = clamp(
    45 +
      scorePositive(debtToEquity, 100, 20) +
      scorePositive(pe, 25, 10) +
      (priceToBookSignal === "expensive" ? 15 : 0) -
      scorePositive(roe, 15, 10),
    0,
    100
  );
  const verdict =
    healthScore >= 72
      ? "Healthy fundamentals with a constructive risk profile."
      : healthScore >= 55
        ? "Mixed but usable fundamentals. Watch valuation and earnings trend."
        : "Weak or incomplete fundamentals. Treat this as a higher-risk candidate.";

  return {
    symbol: data.symbol,
    name: company?.name ?? data.symbol,
    sector: company?.sector ?? "Unknown",
    quote,
    marketCap,
    bookValue,
    eps,
    dps,
    pe,
    pbv,
    dividendYield,
    payoutRatio,
    roe,
    netMargin,
    debtToEquity,
    revenueGrowth,
    epsGrowth,
    priceToBookSignal,
    healthScore: Math.round(healthScore),
    riskScore: Math.round(riskScore),
    verdict,
    businessText: buildBusinessText(data),
    revenue,
    profit,
    epsSeries,
    dpsSeries,
  };
}

function buildBusinessText(data: StockFinancialsData) {
  const name = data.company?.name ?? data.symbol;
  const sector = data.company?.sector ?? "its sector";
  const latest = data.tabs.latest?.status === "ok" ? "recent reported results" : "cached financial records";
  return `${name} operates in ${sector}. This analysis reads ${latest}, statement history, ratios and market movement to explain profitability, valuation, debt pressure and dividend behavior in simple language.`;
}

function findSeries(data: StockFinancialsData, patterns: RegExp[]): MetricPoint[] {
  const row = findRow(data, patterns);
  if (!row) return [];
  return Object.entries(row.values)
    .map(([period, raw]) => ({ period, value: parseNumber(raw) }))
    .filter((point): point is MetricPoint => point.value != null)
    .slice(-8);
}

function latestMetric(data: StockFinancialsData, patterns: RegExp[]) {
  const series = findSeries(data, patterns);
  return latestFromSeries(series);
}

function latestFromSeries(series: MetricPoint[]) {
  return series.length ? series[series.length - 1].value : null;
}

function latestValueFromRows(data: StockFinancialsData, patterns: RegExp[]) {
  return latestMetric(data, patterns);
}

function findRow(data: StockFinancialsData, patterns: RegExp[]): FinancialTableRow | null {
  const tabs: StockFinancialTabId[] = ["overview", "latest", "income", "balance", "cashflow", "ratios"];
  for (const tab of tabs) {
    for (const table of data.tabs[tab]?.tables ?? []) {
      for (const row of table.rows) {
        if (row.isSection) continue;
        if (patterns.some((pattern) => pattern.test(row.label))) return row;
      }
    }
  }
  return null;
}

function getPriceLikeSeries(data: StockFinancialsData) {
  const priceSeries = findSeries(data, [/^close \(pkr\)$/i, /^close$/i, /adjusted stock prices/i]);
  return priceSeries.length ? priceSeries : findSeries(data, [/^eps/i]);
}

function growth(series: MetricPoint[]) {
  if (series.length < 2) return null;
  const first = series.find((point) => point.value !== 0)?.value;
  const last = latestFromSeries(series);
  if (!first || last == null) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function makeCompareRow(
  label: string,
  firstRaw: number | null,
  secondRaw: number | null,
  direction: "higher" | "lower" | "neutral",
  suffix = ""
) {
  const first = firstRaw == null ? "N/A" : `${formatNumber(firstRaw)}${suffix}`;
  const second = secondRaw == null ? "N/A" : `${formatNumber(secondRaw)}${suffix}`;
  let winner: "first" | "second" | "tie" = "tie";
  if (firstRaw != null && secondRaw != null && direction !== "neutral" && firstRaw !== secondRaw) {
    winner = direction === "higher" ? (firstRaw > secondRaw ? "first" : "second") : firstRaw < secondRaw ? "first" : "second";
  }
  const note =
    direction === "neutral"
      ? "Context metric"
      : winner === "tie"
        ? "Too close or unavailable"
        : direction === "higher"
          ? "Higher is usually better"
          : "Lower is usually better";
  return { label, first, second, winner, note };
}

function parseNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === "-" || text.toLowerCase() === "n/a") return null;
  const negative = /^\(.+\)$/.test(text) || text.startsWith("-");
  const parsed = Number(text.replace(/[(),%xA-Za-z\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0,
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
  if (value == null) return "";
  return `${value >= 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}

function scorePositive(value: number | null, threshold: number, points: number) {
  if (value == null) return 0;
  return value >= threshold ? points : value > 0 ? points / 2 : -points / 2;
}

function scoreNegative(value: number | null, threshold: number, points: number) {
  if (value == null) return 0;
  return value <= threshold ? points : -points;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
