"use client";

import * as React from "react";
import { Maximize2, PieChart, Wallet, TrendingUp, CalendarClock, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { HoldingsTable } from "@/components/holdings-table";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { allocationBySector, computeSummary } from "@/lib/services/metrics";
import { formatPKR, formatPercent, plColorClass } from "@/lib/format";
import type { HoldingWithMetrics, Portfolio } from "@/lib/types";

type PortfolioOption = Pick<Portfolio, "id" | "name">;
type AllocationMode = "sector" | "holding";
const ALLOCATION_DIALOG_CLASS =
  "h-[82dvh] max-h-[82dvh] w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:p-6";

export function AllocationExplorer({
  holdings,
  portfolios,
  defaultPortfolioId = "all",
  defaultMode = "holding",
  title = "Allocation",
  description = "Explore exposure, invested amount and live P/L by portfolio.",
  className,
}: {
  holdings: HoldingWithMetrics[];
  portfolios: PortfolioOption[];
  defaultPortfolioId?: string;
  defaultMode?: AllocationMode;
  title?: string;
  description?: string;
  className?: string;
}) {
  const [portfolioId, setPortfolioId] = React.useState(defaultPortfolioId);
  const [mode, setMode] = React.useState<AllocationMode>(defaultMode);
  const { liveHoldings } = useLiveHoldings(holdings);
  const portfolioNames = React.useMemo(
    () => Object.fromEntries(portfolios.map((p) => [p.id, p.name])),
    [portfolios]
  );

  const filtered = React.useMemo(
    () =>
      portfolioId === "all"
        ? liveHoldings
        : liveHoldings.filter((h) => h.portfolio_id === portfolioId),
    [liveHoldings, portfolioId]
  );
  const summary = React.useMemo(() => computeSummary(filtered), [filtered]);
  const sectorData = React.useMemo(() => allocationBySector(filtered), [filtered]);
  const holdingData = React.useMemo(() => allocationByHoldingName(filtered), [filtered]);
  const chartData = mode === "sector" ? sectorData : holdingData;
  const centerContent = React.useMemo(
    () => getAllocationCenterContent(mode, sectorData.length, filtered),
    [mode, sectorData.length, filtered]
  );
  const selectedName =
    portfolioId === "all" ? "All portfolios" : portfolioNames[portfolioId] ?? "Portfolio";

  return (
    <Card className={className}>
      <CardHeader className="relative pr-16">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 truncate text-sm text-muted-foreground">{selectedName}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Expand allocation"
              className="absolute right-4 top-0 z-10 size-9 border-primary/30 bg-primary/5 text-primary shadow-sm hover:bg-primary/10"
            >
              <Maximize2 className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className={ALLOCATION_DIALOG_CLASS}>
            <AllocationDialogBody
              description={description}
              portfolioId={portfolioId}
              setPortfolioId={setPortfolioId}
              portfolios={portfolios}
              mode={mode}
              setMode={setMode}
              summary={summary}
              chartData={chartData}
              centerContent={centerContent}
              filtered={filtered}
              portfolioNames={portfolioNames}
              selectedName={selectedName}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as AllocationMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="holding">Holdings</TabsTrigger>
            <TabsTrigger value="sector">Sectors</TabsTrigger>
          </TabsList>
          <TabsContent value="holding" className="mt-4">
            <AllocationChart
              data={holdingData}
              maxSlices={Math.max(12, holdingData.length)}
              showSliceLabels
              legendVariant="holdingPairs"
              centerContent={centerContent}
            />
          </TabsContent>
          <TabsContent value="sector" className="mt-4">
            <AllocationChart
              data={sectorData}
              maxSlices={8}
              centerContent={centerContent}
            />
          </TabsContent>
        </Tabs>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MiniStat label="Invested" value={formatPKR(summary.totalInvested)} />
          <MiniStat
            label="Total P/L"
            value={formatPKR(summary.totalPL, { sign: true })}
            className={plColorClass(summary.totalPL)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function AllocationExpandDialog({
  holdings,
  portfolios,
  defaultPortfolioId = "all",
  defaultMode = "holding",
  description = "Explore exposure, invested amount and live P/L by portfolio.",
  ariaLabel = "Expand allocation",
  triggerClassName,
}: {
  holdings: HoldingWithMetrics[];
  portfolios: PortfolioOption[];
  defaultPortfolioId?: string;
  defaultMode?: AllocationMode;
  description?: string;
  ariaLabel?: string;
  triggerClassName?: string;
}) {
  const [portfolioId, setPortfolioId] = React.useState(defaultPortfolioId);
  const [mode, setMode] = React.useState<AllocationMode>(defaultMode);
  const { liveHoldings } = useLiveHoldings(holdings);
  const portfolioNames = React.useMemo(
    () => Object.fromEntries(portfolios.map((p) => [p.id, p.name])),
    [portfolios]
  );
  const filtered = React.useMemo(
    () =>
      portfolioId === "all"
        ? liveHoldings
        : liveHoldings.filter((h) => h.portfolio_id === portfolioId),
    [liveHoldings, portfolioId]
  );
  const summary = React.useMemo(() => computeSummary(filtered), [filtered]);
  const sectorData = React.useMemo(() => allocationBySector(filtered), [filtered]);
  const holdingData = React.useMemo(() => allocationByHoldingName(filtered), [filtered]);
  const chartData = mode === "sector" ? sectorData : holdingData;
  const centerContent = React.useMemo(
    () => getAllocationCenterContent(mode, sectorData.length, filtered),
    [mode, sectorData.length, filtered]
  );
  const selectedName =
    portfolioId === "all" ? "All portfolios" : portfolioNames[portfolioId] ?? "Portfolio";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={ariaLabel}
          className={triggerClassName}
        >
          <Maximize2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className={ALLOCATION_DIALOG_CLASS}>
        <AllocationDialogBody
          description={description}
          portfolioId={portfolioId}
          setPortfolioId={setPortfolioId}
          portfolios={portfolios}
          mode={mode}
          setMode={setMode}
          summary={summary}
          chartData={chartData}
          centerContent={centerContent}
          filtered={filtered}
          portfolioNames={portfolioNames}
          selectedName={selectedName}
        />
      </DialogContent>
    </Dialog>
  );
}

function AllocationDialogBody({
  description,
  portfolioId,
  setPortfolioId,
  portfolios,
  mode,
  setMode,
  summary,
  chartData,
  centerContent,
  filtered,
  portfolioNames,
  selectedName,
}: {
  description: string;
  portfolioId: string;
  setPortfolioId: (id: string) => void;
  portfolios: PortfolioOption[];
  mode: AllocationMode;
  setMode: (mode: AllocationMode) => void;
  summary: ReturnType<typeof computeSummary>;
  chartData: ReturnType<typeof allocationBySector>;
  centerContent: React.ReactNode;
  filtered: HoldingWithMetrics[];
  portfolioNames: Record<string, string>;
  selectedName: string;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Portfolio allocation</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5">
        <AllocationControls
          portfolioId={portfolioId}
          setPortfolioId={setPortfolioId}
          portfolios={portfolios}
          mode={mode}
          setMode={setMode}
        />

        <SummaryGrid summary={summary} />

        <div className="rounded-xl border border-border p-4">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="size-4 text-primary" />
              <p className="font-semibold">
                {mode === "sector" ? "Sector allocation" : "Holding allocation"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{selectedName}</p>
          </div>
          <div className="mx-auto max-w-5xl">
            <AllocationChart
              data={chartData}
              maxSlices={mode === "holding" ? Math.max(12, chartData.length) : 8}
              showSliceLabels={mode === "holding"}
              variant="expanded"
              legendVariant={mode === "holding" ? "holdingPairs" : "default"}
              centerContent={centerContent}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold">Holdings</p>
              <p className="text-xs text-muted-foreground">
                {filtered.length} position{filtered.length === 1 ? "" : "s"} in {selectedName}
              </p>
            </div>
          </div>
          <HoldingsTable
            holdings={filtered}
            showPortfolio={portfolioId === "all"}
            portfolioNames={portfolioNames}
          />
        </div>
      </div>
    </>
  );
}

function getAllocationCenterContent(
  mode: AllocationMode,
  sectorCount: number,
  holdings: HoldingWithMetrics[]
) {
  if (mode === "sector") {
    return (
      <div>
        <p className="text-xl font-semibold tabular-nums">{sectorCount}</p>
        <p className="text-xs text-muted-foreground">sectors</p>
      </div>
    );
  }

  const stockCount = new Set(holdings.map((h) => h.symbol.toUpperCase())).size;
  const shareCount = holdings.reduce((sum, h) => sum + h.quantity, 0);

  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{stockCount}</p>
      <p className="text-xs text-muted-foreground">stocks</p>
      <p className="mt-1 text-xs font-medium tabular-nums">{formatNumberCompact(shareCount)}</p>
      <p className="text-[11px] text-muted-foreground">shares</p>
    </div>
  );
}

function formatNumberCompact(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function AllocationControls({
  portfolioId,
  setPortfolioId,
  portfolios,
  mode,
  setMode,
}: {
  portfolioId: string;
  setPortfolioId: (id: string) => void;
  portfolios: PortfolioOption[];
  mode: AllocationMode;
  setMode: (mode: AllocationMode) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Select value={portfolioId} onValueChange={setPortfolioId}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Select portfolio" />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          <SelectItem value="all">All portfolios</SelectItem>
          {portfolios.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tabs value={mode} onValueChange={(v) => setMode(v as AllocationMode)} className="w-full sm:w-auto">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="holding">By holding</TabsTrigger>
          <TabsTrigger value="sector">By sector</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function allocationByHoldingName(holdings: HoldingWithMetrics[]) {
  const total = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const bySymbol = new Map<string, number>();
  for (const holding of holdings) {
    const symbol = holding.symbol.toUpperCase();
    bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + holding.marketValue);
  }

  return Array.from(bySymbol.entries())
    .map(([label, value]) => ({
      label,
      value,
      pct: total ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function SummaryGrid({ summary }: { summary: ReturnType<typeof computeSummary> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard icon={<Wallet className="size-4" />} label="Market value" value={formatPKR(summary.totalValue)} />
      <SummaryCard icon={<Coins className="size-4" />} label="Invested" value={formatPKR(summary.totalInvested)} />
      <SummaryCard
        icon={<TrendingUp className="size-4" />}
        label="Total P/L"
        value={formatPKR(summary.totalPL, { sign: true })}
        sub={formatPercent(summary.totalPLPct)}
        tone={summary.totalPL}
      />
      <SummaryCard
        icon={<CalendarClock className="size-4" />}
        label="Day P/L"
        value={formatPKR(summary.dayPL, { sign: true })}
        sub={formatPercent(summary.dayPLPct)}
        tone={summary.dayPL}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: number;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-2 text-lg font-semibold tabular-nums [overflow-wrap:anywhere] ${tone == null ? "" : plColorClass(tone)}`}>
        {value}
      </p>
      {sub && <p className={`text-xs tabular-nums ${plColorClass(tone)}`}>{sub}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-semibold tabular-nums [overflow-wrap:anywhere] ${className ?? ""}`}>{value}</p>
    </div>
  );
}
