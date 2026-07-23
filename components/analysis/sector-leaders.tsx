"use client";

import * as React from "react";
import {
  BarChart3,
  Brain,
  Crown,
  Loader2,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildDeterministicSectorLeadersInsight,
  type SectorLeadersAiInsight,
} from "@/lib/analysis/sector-portfolio-ai";
import {
  type SectorLeaderboard,
  type SectorLeaderStock,
  type SectorLeadersDataset,
} from "@/lib/analysis/sector-ranking";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StockIdentity } from "@/components/stock/stock-identity";
import { StockLogo } from "@/components/stock/stock-logo";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";

type SectorLeadersApiResponse = {
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

type SectorLeadersAiPayload = {
  sectorKey: string;
  deterministic: SectorLeadersAiInsight;
  insight: SectorLeadersAiInsight;
  generatedAt: string;
};

const TOP_COLORS = ["#7c3aed", "#10b981", "#0ea5e9", "#f59e0b", "#ef4444", "#14b8a6"];
const AI_SUMMARY_ERROR_MESSAGE =
  "We could not refresh the live summary right now. Please try again in a few minutes.";
const SECTOR_SUMMARY_STATUSES = [
  "Checking sector earnings and profit trends",
  "Reviewing cash flow, debt and dividend strength",
  "Writing the sector summary in simple language",
] as const;

export function SectorLeadersPanel({
  allowedSymbols,
}: {
  allowedSymbols: Set<string> | null;
}) {
  const [query, setQuery] = React.useState("");
  const [selectedKey, setSelectedKey] = React.useState("");

  const resource = usePersistentResource<SectorLeadersApiResponse>({
    cacheKey: "public:sector-leaders:v2",
    url: "/api/public/sector-leaders",
    refreshInterval: 30 * 60 * 1000,
  });

  const dataset = React.useMemo(
    () => filterDatasetToUniverse(resource.data ?? null, allowedSymbols),
    [allowedSymbols, resource.data]
  );
  const leaderboards = React.useMemo(
    () => (dataset?.leaderboards ?? []).filter((board): board is SectorLeaderboard => Boolean(board)),
    [dataset?.leaderboards]
  );
  const sectorOptions = React.useMemo(() => {
    const sectors = dataset?.sectors ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return sectors;
    return sectors.filter((sector) => sector.sector.toLowerCase().includes(needle));
  }, [dataset?.sectors, query]);

  React.useEffect(() => {
    if (!dataset?.sectors.length) return;
    if (!selectedKey || !dataset.sectors.some((sector) => sector.key === selectedKey)) {
      setSelectedKey(dataset.sectors[0]?.key ?? "");
    }
  }, [dataset?.sectors, selectedKey]);

  const leaderboard = React.useMemo(
    () => leaderboards.find((board) => board.key === selectedKey) ?? null,
    [leaderboards, selectedKey]
  );
  const aiFallback = React.useMemo(
    () => (leaderboard ? buildDeterministicSectorLeadersInsight(leaderboard) : null),
    [leaderboard]
  );
  const aiBody = React.useMemo(
    () =>
      leaderboard
        ? ({
            sectorKey: leaderboard.key,
          })
        : null,
    [leaderboard]
  );
  const { data: aiData, loading: aiLoading, error: aiError, refresh } =
    usePostJson<SectorLeadersAiPayload>("/api/public/sector-leaders/ai", aiBody);
  const isAiCurrentSector = aiData?.sectorKey === leaderboard?.key;
  const isSummaryPending = Boolean(leaderboard && aiLoading && !isAiCurrentSector);
  const aiInsight = isAiCurrentSector ? (aiData?.insight ?? aiFallback) : aiFallback;
  const [summaryStatusIndex, setSummaryStatusIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isSummaryPending) {
      setSummaryStatusIndex(0);
      return;
    }
    setSummaryStatusIndex(0);
    const intervalId = window.setInterval(() => {
      setSummaryStatusIndex((index) => (index + 1) % SECTOR_SUMMARY_STATUSES.length);
    }, 1600);
    return () => window.clearInterval(intervalId);
  }, [isSummaryPending]);

  if (resource.isLoading) {
    return <SectorLeadersLoading />;
  }

  if (!dataset || !leaderboards.length || !leaderboard) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Sector leaders will appear here once more cached fundamentals are ready.
        </CardContent>
      </Card>
    );
  }

  const leader = leaderboard.stocks[0] ?? null;
  const parameterCards = buildParameterCards(leaderboard);
  const topChartData = leaderboard.stocks.slice(0, 8).map((stock) => ({
    symbol: stock.symbol,
    score: stock.totalScore,
  }));
  const radarData = leaderboard.categories.map((category) => ({
    category: category.category,
    score: category.score,
  }));

  return (
    <div className="space-y-5">
      <Card variant="feature" className="overflow-hidden">
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <Badge variant="violet" className="h-6 px-3 text-[11px] uppercase tracking-[0.2em]">
                Sector Leaders
              </Badge>
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Pick a sector and open its strongest names
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  These rankings compare companies inside their own sector using earnings, profit
                  margins, cash flow strength, debt position, dividends and valuation signals. If a
                  few sector metrics are missing, MyStockli rebalances the score using the financial
                  data already available for that company.
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-3 xl:max-w-xl">
              <MiniStat label="Sectors ready" value={String(dataset.totalSectors)} />
              <MiniStat label="Stocks scored" value={String(dataset.totalStocks)} />
              <MiniStat label="Factors used" value={String(leaderboard.parametersReady)} />
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
            <div className="rounded-[2rem] border bg-background/90 p-4 shadow-soft">
              <div className="rounded-[1.7rem] border border-violet-500/15 bg-violet-500/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-200">
                  Search here
                </p>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search here..."
                    className="h-12 border-violet-200/70 bg-background/95 pl-10 shadow-soft focus-visible:ring-violet-400"
                  />
                </div>
              </div>

              <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                {sectorOptions.length ? (
                  sectorOptions.map((sector) => {
                    const active = sector.key === selectedKey;
                    return (
                      <button
                        key={sector.key}
                        type="button"
                        onClick={() => setSelectedKey(sector.key)}
                        className={cn(
                          "w-full rounded-[1.6rem] border p-4 text-left transition",
                          active
                            ? "border-violet-500/35 bg-violet-500/10 shadow-soft"
                            : "bg-card/80 hover:border-foreground/20 hover:bg-card"
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "text-lg font-semibold",
                                active ? "text-violet-700 dark:text-violet-200" : "text-foreground"
                              )}
                            >
                              {sector.sector}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {sector.stockCount} stocks ready in this sector
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <Badge variant={active ? "violet" : "outline"} className="h-8 px-3 text-xs">
                              {sector.stockCount} stocks
                            </Badge>
                            <Badge variant="outline" className="h-8 px-3 text-xs">
                              Winner {sector.leaderSymbol ?? "—"}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[1.6rem] border border-dashed bg-background/60 p-5 text-sm text-muted-foreground">
                    No sector matched that search yet. Try a shorter sector name.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border bg-background/90 p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{leaderboard.sector}</Badge>
                <Badge variant="outline">{leaderboard.ruleName}</Badge>
                {leaderboard.ruleSource !== "exact" ? (
                  <Badge variant="amber">Template match: {leaderboard.ruleSource}</Badge>
                ) : null}
              </div>
              {leader ? (
                <div className="mt-4 space-y-4">
                  <div
                    className={cn(
                      "rounded-[1.8rem] border border-emerald-500/20 bg-emerald-500/5 p-5 sm:p-6 transition-all duration-300",
                      isSummaryPending && "border-violet-400/35 bg-violet-500/[0.06] shadow-soft"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 rounded-[1.6rem] bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-200">
                        <Crown className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200 sm:text-sm sm:tracking-[0.24em]">
                          Current sector winner
                        </p>
                        <div className="mt-2 min-h-8">
                          {isSummaryPending ? (
                            <Badge variant="violet" className="animate-pulse">
                              Refreshing sector read...
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-4 flex items-center gap-4">
                          <StockLogo symbol={leader.symbol} name={leader.name} size="lg" className="size-16 rounded-2xl text-xl" />
                          <div className="min-w-0">
                            <h3 className="text-[clamp(2.5rem,7vw,4.5rem)] font-bold tracking-tight leading-none">
                              {leader.symbol}
                            </h3>
                            <p className="mt-2 max-w-3xl text-[clamp(1rem,1.8vw,1.6rem)] leading-tight text-muted-foreground">
                              {leader.name}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4 xl:gap-5">
                      <MiniStat label="Total score" value={`${leader.totalScore}/100`} emphasized />
                      <MiniStat label="Current price" value={formatPrice(leader.currentPrice)} emphasized />
                      <MiniStat
                        label="Market cap"
                        value={formatMarketCapUnits(leader.marketCap)}
                        emphasized
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {leader.strongestMetrics.map((metric) => (
                        <Badge key={metric} variant="success" className="h-9 rounded-full px-4 text-sm">
                          {metric}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {leader.strongestMetrics.slice(0, 3).map((metric) => (
                      <div
                        key={metric}
                        className="rounded-[1.5rem] border bg-card/90 p-4 shadow-soft transition-transform duration-300 hover:-translate-y-0.5"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Why it is leading
                        </p>
                        <p className="mt-2 text-lg font-semibold">{metric}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {buildLeaderMetricMessage(leader.symbol, metric)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-600 dark:text-violet-300">
              <Trophy className="size-5" />
            </div>
            <div>
              <CardTitle>Top ranked stocks</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                The highest total sector scores are shown first.
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topChartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="symbol" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} />
                <Tooltip content={<RankTooltip />} cursor={{ fill: "rgba(124,58,237,0.08)" }} />
                <Bar dataKey="score" radius={[10, 10, 0, 0]}>
                  {topChartData.map((entry, index) => (
                    <Cell key={entry.symbol} fill={TOP_COLORS[index % TOP_COLORS.length] ?? "#7c3aed"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start gap-3">
            <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-600 dark:text-sky-300">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <CardTitle>Sector category map</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                This shows which parameter categories are strongest across the current sector
                ranking.
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(148,163,184,0.24)" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 12, fill: "currentColor" }} />
                <Radar
                  dataKey="score"
                  stroke="#14b8a6"
                  fill="#14b8a6"
                  fillOpacity={0.28}
                  strokeWidth={2}
                />
                <Tooltip content={<CategoryTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
          <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-600 dark:text-amber-300">
            <Trophy className="size-5" />
          </div>
          <div>
            <CardTitle>Full sector leaderboard</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Names are sorted by the average percentile score from the sector template.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {leaderboard.stocks.map((stock, index) => (
            <SectorStockCard key={stock.symbol} stock={stock} rank={index + 1} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-300">
            <Sparkles className="size-5" />
          </div>
          <div>
            <CardTitle>Factor boards</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Each sector parameter shows who is leading that exact check right now.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {parameterCards.map((card) => (
            <ParameterBoardCard key={card.label} card={card} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
          <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-600 dark:text-violet-300">
            <Brain className="size-5" />
          </div>
          <div className="flex-1">
            <CardTitle>AI sector summary</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Built from the same earnings, profitability, cash flow, debt and valuation data shown
              above.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Refresh summary
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSummaryPending ? (
            <SectorSummaryLoading
              sector={leaderboard.sector}
              activeStatus={SECTOR_SUMMARY_STATUSES[summaryStatusIndex] ?? SECTOR_SUMMARY_STATUSES[0]}
            />
          ) : aiInsight ? (
            <div className="space-y-4">
              {aiError ? (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-200">
                  {AI_SUMMARY_ERROR_MESSAGE}
                </div>
              ) : null}
              <div className="rounded-[1.8rem] border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="violet">{aiInsight.confidence} confidence</Badge>
                  <Badge variant="outline">{leaderboard.sector}</Badge>
                </div>
                <h3 className="mt-3 text-2xl font-semibold">{aiInsight.headline}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{aiInsight.summary}</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <InsightCard title="Top calls" items={aiInsight.winnerCalls} tone="success" />
                <InsightCard title="What the sector is showing" items={aiInsight.trends} tone="info" />
                <InsightCard title="What to watch" items={aiInsight.watchouts} tone="warning" />
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-7 text-foreground/90">
                <p className="font-semibold text-emerald-700 dark:text-emerald-200">AI suggestion</p>
                <p className="mt-2">{aiInsight.suggestion}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SectorLeadersLoading() {
  const steps = [
    "Reading company earnings, profits, cash flow and balance-sheet data",
    "Matching each company with the right sector ranking rules",
    "Scoring every factor inside the selected industry",
    "Preparing leaderboards and charts",
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-8">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-violet-500" />
          <div>
            <p className="text-lg font-semibold">Loading sector leaders</p>
            <p className="text-sm text-muted-foreground">
              We are reviewing company earnings, profits, cash flow, debt and valuation signals for
              this sector.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <div key={step} className="rounded-2xl border bg-background/80 p-4">
              <p className="text-sm font-semibold text-foreground">Step {index + 1}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectorStockCard({ stock, rank }: { stock: SectorLeaderStock; rank: number }) {
  return (
    <div className="rounded-[1.8rem] border bg-background/90 p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Rank #{rank}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <StockLogo symbol={stock.symbol} name={stock.name} size="lg" />
            <div className="min-w-0">
              <h3 className="text-2xl font-bold tracking-tight">{stock.symbol}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{stock.name}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[1.4rem] border bg-card px-4 py-3 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Score
          </p>
          <p className="mt-2 text-3xl font-bold">{stock.totalScore}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Analyzer score" value={`${stock.analyzerScore}/100`} />
        <MiniStat label="Current price" value={formatPrice(stock.currentPrice)} />
        <MiniStat label="Market cap" value={formatMarketCapUnits(stock.marketCap)} />
        <MiniStat label="Dividend yield" value={formatPlainPct(stock.dividendYield)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stock.strongestMetrics.map((metric) => (
          <Badge key={metric} variant="success">
            {metric}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {stock.metrics.slice(0, 4).map((metric) => (
          <div key={`${stock.symbol}-${metric.label}`} className="rounded-2xl border bg-card/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-2 text-lg font-semibold">{metric.displayValue}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {metric.percentileScore == null ? "No usable score yet" : `${metric.percentileScore}/100 inside this sector`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParameterBoardCard({
  card,
}: {
  card: {
    label: string;
    guidance: string;
    category: string;
    leaders: Array<{ symbol: string; score: number; value: string }>;
  };
}) {
  return (
    <div className="rounded-[1.8rem] border bg-background/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{card.category}</Badge>
        <Badge variant="amber">{card.guidance}</Badge>
      </div>
      <h3 className="mt-3 text-xl font-semibold">{card.label}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        The top score means the stock is ahead of more sector peers on this exact parameter.
      </p>
      <div className="mt-4 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={card.leaders}
            layout="vertical"
            margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.16)" />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              type="category"
              dataKey="symbol"
              tickLine={false}
              axisLine={false}
              width={56}
              fontSize={12}
            />
            <Tooltip content={<MetricTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
            <Bar dataKey="score" radius={[0, 10, 10, 0]} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  emphasized,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.45rem] border bg-card/85 shadow-soft",
        emphasized
          ? "min-h-[8.5rem] px-3 py-3 sm:min-h-[10rem] sm:px-5 sm:py-5"
          : "min-h-[7.75rem] px-4 py-4"
      )}
    >
      <div className="flex h-full flex-col">
        <p
          className={cn(
            "min-h-[2.7rem] text-[11px] font-semibold uppercase leading-5 tracking-[0.18em] text-muted-foreground sm:text-xs",
            emphasized && "min-h-[2.6rem] text-[10px] sm:min-h-[3rem] sm:text-xs"
          )}
        >
          {label}
        </p>
        <div className="mt-auto pt-3">
          <p
            className={cn(
              "break-words font-bold leading-tight tracking-tight tabular-nums",
              emphasized
                ? "text-[clamp(0.95rem,2.3vw,1.9rem)] sm:text-[clamp(1.2rem,1.45vw,2rem)]"
                : "text-[clamp(1.65rem,5.2vw,2.15rem)] sm:text-[clamp(1.05rem,1.15vw,1.75rem)]",
              tone === "gain" && "text-gain",
              tone === "loss" && "text-loss"
            )}
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InsightCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "info" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.6rem] border p-4",
        tone === "success" && "border-emerald-500/20 bg-emerald-500/5",
        tone === "info" && "border-sky-500/20 bg-sky-500/5",
        tone === "warning" && "border-amber-500/20 bg-amber-500/5"
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex gap-2 text-sm leading-6 text-muted-foreground">
            <span
              className={cn(
                "mt-2 size-2 shrink-0 rounded-full",
                tone === "success" && "bg-emerald-500",
                tone === "info" && "bg-sky-500",
                tone === "warning" && "bg-amber-500"
              )}
            />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorSummaryLoading({
  sector,
  activeStatus,
}: {
  sector: string;
  activeStatus: string;
}) {
  return (
    <div className="rounded-[1.8rem] border border-violet-500/20 bg-violet-500/[0.04] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-violet-500" />
        <div>
          <p className="font-semibold">Preparing {sector}</p>
          <p className="text-sm text-muted-foreground">
            We are building the fresh sector read before showing the final AI summary.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {SECTOR_SUMMARY_STATUSES.map((status) => {
          const active = status === activeStatus;
          return (
            <div
              key={status}
              className={cn(
                "rounded-[1.4rem] border px-4 py-4 transition-all duration-300",
                active
                  ? "border-violet-400/40 bg-violet-500/10 shadow-soft"
                  : "border-border/60 bg-background/80 opacity-75"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    active ? "bg-violet-500 animate-pulse" : "bg-muted-foreground/30"
                  )}
                />
                <p className="text-sm font-medium">{status}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-[1.4rem] border border-violet-500/15 bg-background/75 px-4 py-3 text-sm text-muted-foreground">
        Current step: <span className="font-medium text-foreground">{activeStatus}</span>
      </div>
    </div>
  );
}

function filterDatasetToUniverse(
  dataset: SectorLeadersDataset | null,
  allowedSymbols: Set<string> | null
) {
  if (!dataset || !allowedSymbols) return dataset;

  const leaderboards: SectorLeaderboard[] = [];
  dataset.leaderboards.forEach((board) => {
    const stocks = board.stocks.filter((stock) => allowedSymbols.has(stock.symbol));
    if (!stocks.length) return;
    leaderboards.push({
      ...board,
      stockCount: stocks.length,
      averageScore: Math.round(
        stocks.reduce((sum, stock) => sum + stock.totalScore, 0) / stocks.length
      ),
      leaderSymbol: stocks[0]?.symbol ?? null,
      leaderName: stocks[0]?.name ?? null,
      stocks,
      categories: summarizeBoardCategories(stocks),
    });
  });

  return {
    ...dataset,
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

function summarizeBoardCategories(stocks: SectorLeaderStock[]) {
  const map = new Map<string, number[]>();
  stocks.forEach((stock) => {
    stock.categoryScores.forEach((category) => {
      const values = map.get(category.category) ?? [];
      values.push(category.score);
      map.set(category.category, values);
    });
  });
  return [...map.entries()]
    .map(([category, values]) => ({
      category,
      score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => right.score - left.score);
}

function buildParameterCards(leaderboard: SectorLeaderboard) {
  const template = leaderboard.stocks[0]?.metrics ?? [];
  return template.map((metric) => ({
    label: metric.label,
    category: metric.category,
    guidance: metric.guidance,
    leaders: leaderboard.stocks
      .map((stock) => {
        const stockMetric = stock.metrics.find((item) => item.label === metric.label);
        return {
          symbol: stock.symbol,
          score: stockMetric?.percentileScore ?? 0,
          value: stockMetric?.displayValue ?? "—",
        };
      })
      .filter((entry) => entry.score > 0)
      .slice(0, 5),
  }));
}

function buildLeaderMetricMessage(symbol: string, metric: string) {
  const metricKey = metric.toLowerCase();
  if (metricKey.includes("margin")) {
    return `${symbol} is keeping a stronger share of revenue on ${metric.toLowerCase()}, which is helping it stay ahead of sector peers.`;
  }
  if (metricKey.includes("roce") || metricKey.includes("roe") || metricKey.includes("return")) {
    return `${symbol} is converting capital into returns more efficiently on this check, which is one reason it is sitting on top of the sector board.`;
  }
  if (metricKey.includes("cash")) {
    return `${symbol} is producing cleaner cash support on this factor, so the operating story looks more dependable here.`;
  }
  if (metricKey.includes("debt") || metricKey.includes("coverage") || metricKey.includes("ratio")) {
    return `${symbol} is showing a steadier balance-sheet read on ${metric.toLowerCase()}, which gives it an edge in this sector snapshot.`;
  }
  return `${symbol} is ahead on ${metric.toLowerCase()}, which is adding useful support to its overall sector score right now.`;
}

function RankTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { symbol: string; score: number } }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-lg">
      <StockIdentity symbol={item.symbol} size="xs" showName={false} />
      <p className="mt-1 text-muted-foreground">{item.score}/100 sector score</p>
    </div>
  );
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { category: string; score: number } }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{item.category}</p>
      <p className="text-muted-foreground">{item.score}/100 average category score</p>
    </div>
  );
}

function MetricTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { symbol: string; score: number; value: string } }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-lg">
      <StockIdentity symbol={item.symbol} size="xs" showName={false} />
      <p className="mt-1 text-muted-foreground">{item.value}</p>
      <p className="text-muted-foreground">{item.score}/100 inside this sector</p>
    </div>
  );
}

function usePostJson<T>(url: string, body: Record<string, unknown> | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cache, setCache] = React.useState<{ status: string; storedAt: string } | null>(null);

  const run = React.useCallback(async () => {
    if (!body) {
      setData(null);
      setCache(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: T; cache?: { status: string; storedAt: string }; error?: string }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? AI_SUMMARY_ERROR_MESSAGE);
      }
      setData(payload.data);
      setCache(payload.cache ?? null);
    } catch {
      setError(AI_SUMMARY_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [body, url]);

  React.useEffect(() => {
    void run();
  }, [run]);

  return { data, loading, error, cache, refresh: run };
}

function formatPrice(value: number | null) {
  return value == null ? "—" : `Rs ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatMarketCapUnits(value: number | null) {
  if (value == null) return "—";
  if (value >= 1000) {
    return `${formatUnitNumber(value / 10)} Cr`;
  }
  return `${formatUnitNumber(value)} MM`;
}

function formatPlainPct(value: number | null) {
  return value == null ? "—" : `${value.toFixed(2)}%`;
}

function formatUnitNumber(value: number) {
  const maximumFractionDigits = value >= 1000 ? 0 : value >= 100 ? 1 : 2;
  return value.toLocaleString("en-US", { maximumFractionDigits });
}
