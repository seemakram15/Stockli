"use client";

import Image from "next/image";
import * as React from "react";
import {
  BarChart3,
  ChartColumn,
  Database,
  FileText,
  LineChart as LineChartIcon,
  Loader2,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";
import type {
  FinancialMetric,
  StockFinancialPeerComparison,
  FinancialTable,
  FinancialTableRow,
  StockFinancialTabId,
  StockFinancialsData,
} from "@/lib/types/stock-fundamentals";

const TAB_ORDER: Array<{ id: StockFinancialTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "latest", label: "Latest results" },
  { id: "income", label: "Income statements" },
  { id: "balance", label: "Balance sheet" },
  { id: "cashflow", label: "Cash flow" },
  { id: "ratios", label: "Ratios" },
];

export function StockFinancialsPanel({
  symbol,
  companyName,
}: {
  symbol: string;
  companyName?: string | null;
}) {
  const normalizedSymbol = symbol.toUpperCase();
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<StockFinancialsData>({
      cacheKey: `public:stock-financials:v4:${normalizedSymbol}`,
      url: `/api/public/stock-financials/${encodeURIComponent(normalizedSymbol)}`,
      refreshInterval: 60 * 60 * 1000,
    });

  return (
    <Card className="bg-background shadow-sm">
      <CardHeader className="gap-3 border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Financial fundamentals</CardTitle>
            </div>
            <CardDescription>
              Historical company overview, results, statements, cash flows and ratios for{" "}
              {data?.company?.name ?? companyName ?? normalizedSymbol}.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              cachedAt={cachedAt ?? data?.updatedAt ?? null}
              isRefreshing={isRefreshing}
              isFromDeviceCache={isFromDeviceCache}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshNow().catch(() => undefined)}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-5 sm:px-5">
        {!data ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title={isLoading ? "Loading fundamentals..." : "Financial data unavailable"}
            description={
              error?.message ??
              "We could not load company financials right now. Cached data will appear here once available."
            }
            className="border-solid"
          />
        ) : (
          <Tabs defaultValue="overview" className="gap-5">
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex h-auto min-w-max rounded-lg bg-muted p-1">
                {TAB_ORDER.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-9 rounded-md px-4 text-sm font-medium"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {TAB_ORDER.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                <FinancialTabView
                  tabId={tab.id}
                  symbol={normalizedSymbol}
                  company={data.company}
                  data={data.tabs[tab.id]}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function FinancialTabView({
  tabId,
  symbol,
  company,
  data,
}: {
  tabId: StockFinancialTabId;
  symbol: string;
  company: StockFinancialsData["company"];
  data: StockFinancialsData["tabs"][StockFinancialTabId];
}) {
  const periods = React.useMemo(() => collectTablePeriods(data.tables), [data.tables]);
  const defaultRange = React.useMemo(() => getDefaultRange(periods), [periods]);
  const defaultStart = defaultRange.start;
  const defaultEnd = defaultRange.end;
  const [draftRange, setDraftRange] = React.useState(defaultRange);
  const [appliedRange, setAppliedRange] = React.useState(defaultRange);
  const shouldFilter = tabId !== "overview" && periods.length > 0;
  const selectedPeriods = React.useMemo(
    () => (shouldFilter ? getPeriodsInRange(periods, appliedRange.start, appliedRange.end) : undefined),
    [appliedRange.end, appliedRange.start, periods, shouldFilter]
  );

  React.useEffect(() => {
    setDraftRange({ start: defaultStart, end: defaultEnd });
    setAppliedRange({ start: defaultStart, end: defaultEnd });
  }, [defaultEnd, defaultStart]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{data.title}</h3>
          {data.status !== "ok" ? (
            <Badge variant={data.status === "error" ? "destructive" : "secondary"}>
              {data.status}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{data.description}</p>
        {data.message ? <p className="text-sm text-muted-foreground">{data.message}</p> : null}
      </div>

      {data.highlights?.length ? <Highlights metrics={data.highlights} /> : null}

      {shouldFilter ? (
        <FinancialPeriodFilter
          periods={periods}
          draftRange={draftRange}
          onDraftRangeChange={setDraftRange}
          onApply={() => setAppliedRange(normalizeRange(periods, draftRange))}
          onClear={() => {
            setDraftRange({ start: defaultStart, end: defaultEnd });
            setAppliedRange({ start: defaultStart, end: defaultEnd });
          }}
        />
      ) : null}

      {data.tables.length ? (
        <div className="space-y-4">
          {data.tables.map((table) => (
            <FinancialTableView
              key={table.title}
              tabId={tabId}
              symbol={symbol}
              company={company}
              table={table}
              selectedPeriods={selectedPeriods}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Database className="size-6" />}
          title="No rows yet"
          description="This section is ready, but the source did not return financial rows for this stock."
          className="py-10"
        />
      )}
    </div>
  );
}

function FinancialPeriodFilter({
  periods,
  draftRange,
  onDraftRangeChange,
  onApply,
  onClear,
}: {
  periods: string[];
  draftRange: { start: string; end: string };
  onDraftRangeChange: (range: { start: string; end: string }) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const mode = periods.some((period) => /qfy|quarter/i.test(period)) ? "Quarterly" : "Annual";

  return (
    <div className="rounded-xl border bg-background p-3 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Period
          </p>
          <div className="inline-flex rounded-lg border bg-background p-1">
            {["Annual", "Quarterly"].map((option) => (
              <button
                key={option}
                type="button"
                disabled={option !== mode}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-semibold transition",
                  option === mode
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground opacity-50"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <PeriodSelect
          label="Start date"
          periods={periods}
          value={draftRange.start}
          onChange={(start) => onDraftRangeChange(normalizeRange(periods, { ...draftRange, start }))}
        />
        <PeriodSelect
          label="End date"
          periods={periods}
          value={draftRange.end}
          onChange={(end) => onDraftRangeChange(normalizeRange(periods, { ...draftRange, end }))}
        />

        <div className="flex gap-2">
          <Button type="button" className="flex-1 lg:flex-none" onClick={onApply}>
            Search
          </Button>
          <Button type="button" variant="outline" className="flex-1 lg:flex-none" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function PeriodSelect({
  label,
  periods,
  value,
  onChange,
}: {
  label: string;
  periods: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-full bg-background">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {periods.map((period) => (
            <SelectItem key={period} value={period}>
              {period}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Highlights({ metrics }: { metrics: FinancialMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="rounded-lg border bg-card p-3 shadow-sm"
        >
          <p className="text-xs text-muted-foreground">{metric.label}</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold tabular-nums [overflow-wrap:anywhere]",
              metric.tone === "positive" && "text-emerald-600",
              metric.tone === "negative" && "text-red-600"
            )}
          >
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function FinancialTableView({
  tabId,
  symbol,
  company,
  table,
  selectedPeriods,
}: {
  tabId: StockFinancialTabId;
  symbol: string;
  company: StockFinancialsData["company"];
  table: FinancialTable;
  selectedPeriods?: string[];
}) {
  const visibleYears = selectedPeriods?.filter((period) => table.years.includes(period)) ?? table.years;
  const showActions = tabId !== "overview";

  return (
    <div className="rounded-xl border bg-background shadow-sm">
      <div className="flex flex-col gap-1 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold">{table.title}</h4>
          {table.subtitle ? <p className="text-sm text-muted-foreground">{table.subtitle}</p> : null}
        </div>
        <Badge variant="outline">{table.rows.filter((row) => !row.isSection).length} rows</Badge>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">
                Metric
              </th>
              {showActions ? (
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                  Actions
                </th>
              ) : null}
              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Trend</th>
              {visibleYears.map((year) => (
                <th key={year} className="px-3 py-2 text-right font-semibold">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) =>
              row.isSection ? (
                <tr key={`${table.title}-section-${row.label}-${index}`} className="border-b bg-muted/40">
                  <td
                    colSpan={visibleYears.length + (showActions ? 3 : 2)}
                    className="px-3 py-2 font-semibold"
                  >
                    {row.label}
                  </td>
                </tr>
              ) : (
                <tr
                  key={`${table.title}-${row.section ?? "row"}-${row.label}-${index}`}
                  className={cn(
                    "border-b last:border-0 hover:bg-muted/30",
                    row.isBold && "font-semibold"
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 max-w-[280px] bg-background px-3 py-2",
                      row.isBold && "font-semibold"
                    )}
                  >
                    <span className={cn("block", row.isBold && "font-semibold")}>{row.label}</span>
                    {row.unit ? (
                      <span className="text-xs text-muted-foreground">{row.unit}</span>
                    ) : null}
                  </td>
                  {showActions ? (
                    <td className="px-3 py-2">
                      <MetricRowActions
                        tabId={tabId}
                        symbol={symbol}
                        company={company}
                        tableTitle={table.title}
                        row={row}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <Sparkline values={row.sparkline} />
                  </td>
                  {visibleYears.map((year) => (
                    <td
                      key={year}
                      className={cn("px-3 py-2 text-right tabular-nums", row.isBold && "font-semibold")}
                    >
                      {formatFinancialValue(row.values[year])}
                    </td>
                  ))}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-3 md:hidden">
        {table.rows.map((row, index) =>
          row.isSection ? (
            <div
              key={`${table.title}-mobile-section-${row.label}-${index}`}
              className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-semibold"
            >
              {row.label}
            </div>
          ) : (
            <MobileFinancialRow
              key={`${table.title}-mobile-${row.section ?? "row"}-${row.label}-${index}`}
              tabId={tabId}
              symbol={symbol}
              company={company}
              row={row}
              years={visibleYears}
              showActions={showActions}
              tableTitle={table.title}
            />
          )
        )}
      </div>
    </div>
  );
}

function MobileFinancialRow({
  tabId,
  symbol,
  company,
  row,
  years,
  showActions,
  tableTitle,
}: {
  tabId: StockFinancialTabId;
  symbol: string;
  company: StockFinancialsData["company"];
  row: FinancialTableRow;
  years: string[];
  showActions: boolean;
  tableTitle: string;
}) {
  return (
    <details className="group rounded-lg border bg-card p-3 shadow-sm" open={row.isBold}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div>
          <p className={cn("font-medium", row.isBold && "font-semibold")}>{row.label}</p>
          {row.unit ? <p className="text-xs text-muted-foreground">{row.unit}</p> : null}
        </div>
      </summary>
      {showActions ? (
        <div className="mt-3">
          <MetricRowActions
            tabId={tabId}
            symbol={symbol}
            company={company}
            tableTitle={tableTitle}
            row={row}
          />
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {years.map((year) => (
          <div key={year} className="rounded-md bg-muted/45 px-2 py-1.5">
            <p className="text-[11px] text-muted-foreground">{year}</p>
            <p
              className={cn(
                "text-sm font-medium tabular-nums [overflow-wrap:anywhere]",
                row.isBold && "font-semibold"
              )}
            >
              {formatFinancialValue(row.values[year])}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function MetricRowActions({
  tabId,
  symbol,
  company,
  tableTitle,
  row,
}: {
  tabId: StockFinancialTabId;
  symbol: string;
  company: StockFinancialsData["company"];
  tableTitle: string;
  row: FinancialTableRow;
}) {
  if (tabId === "overview") return null;

  return (
    <div className="flex items-center gap-1.5">
      <MetricTrendDialog tableTitle={tableTitle} row={row} />
      <PeerComparisonDialog tabId={tabId} symbol={symbol} company={company} row={row} />
    </div>
  );
}

function MetricTrendDialog({
  tableTitle,
  row,
}: {
  tableTitle: string;
  row: FinancialTableRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"bars" | "line">("bars");
  const points = React.useMemo(() => getMetricPoints(row), [row]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-primary hover:text-primary"
        aria-label={`Show ${row.label} trend`}
        onClick={() => setOpen(true)}
      >
        <ChartColumn className="size-4" />
      </Button>
      <DialogContent className="gap-0 p-0 sm:max-w-[min(1100px,calc(100vw-2rem))]">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle className="text-xl text-primary">{row.label}</DialogTitle>
          <DialogDescription>
            {tableTitle}
            {row.unit ? ` · ${row.unit}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-5">
          <div className="flex justify-end">
            <div className="inline-flex rounded-xl bg-muted p-1">
              <Button
                type="button"
                variant={mode === "bars" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode("bars")}
              >
                <ChartColumn className="size-4" />
                Bars
              </Button>
              <Button
                type="button"
                variant={mode === "line" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode("line")}
              >
                <LineChartIcon className="size-4" />
                Trend line
              </Button>
            </div>
          </div>
          <MetricChart points={points} mode={mode} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeerComparisonDialog({
  tabId,
  symbol,
  company,
  row,
}: {
  tabId: Exclude<StockFinancialTabId, "overview">;
  symbol: string;
  company: StockFinancialsData["company"];
  row: FinancialTableRow;
}) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<StockFinancialPeerComparison | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || data || loading) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(
      `/api/public/stock-financials/${encodeURIComponent(symbol)}/peers?tab=${encodeURIComponent(
        tabId
      )}&metric=${encodeURIComponent(row.label)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          data?: StockFinancialPeerComparison;
          error?: string;
        };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "Peer comparison unavailable");
        }
        setData(payload.data);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as Error).name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Peer comparison unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [data, loading, open, row.label, symbol, tabId]);

  const periods = React.useMemo(() => data?.periods.slice(-5) ?? [], [data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-primary hover:text-primary"
        aria-label={`Compare ${row.label} with peers`}
        onClick={() => setOpen(true)}
      >
        <UsersRound className="size-4" />
      </Button>
      <DialogContent className="gap-0 p-0 sm:max-w-[min(1200px,calc(100vw-2rem))]">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle className="text-xl">Peer comparison</DialogTitle>
          <DialogDescription>
            {row.label} across {data?.sector ?? company?.sector ?? "same sector"} companies.
          </DialogDescription>
        </DialogHeader>
        <div className="p-5">
          {loading ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              Loading same-sector comparison...
            </div>
          ) : error ? (
            <EmptyState
              icon={<UsersRound className="size-6" />}
              title="Peer comparison unavailable"
              description={error}
              className="border-solid"
            />
          ) : data?.peers.length ? (
            <PeerComparisonTable rows={data.peers} periods={periods} />
          ) : (
            <EmptyState
              icon={<UsersRound className="size-6" />}
              title="No peer rows yet"
              description="Same-sector companies did not return this metric."
              className="border-solid"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeerComparisonTable({
  rows,
  periods,
}: {
  rows: StockFinancialPeerComparison["peers"];
  periods: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-semibold">Company</th>
              <th className="px-3 py-2 text-left font-semibold">Symbol</th>
              <th className="px-3 py-2 text-left font-semibold">Sector</th>
              <th className="px-3 py-2 text-left font-semibold">Trend</th>
              {periods.map((period) => (
                <th key={period} className="px-3 py-2 text-right font-semibold">
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((peer) => (
              <tr key={peer.symbol} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <CompanyLogo peer={peer} />
                    <span className="font-medium">{peer.companyName}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-semibold">{peer.symbol}</td>
                <td className="px-3 py-2">
                  <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {peer.sector}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Sparkline values={peer.sparkline} />
                </td>
                {periods.map((period) => (
                  <td key={period} className="px-3 py-2 text-right tabular-nums">
                    {formatFinancialValue(peer.values[period])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((peer) => (
          <div key={peer.symbol} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <CompanyLogo peer={peer} />
              <div>
                <p className="font-semibold">{peer.symbol}</p>
                <p className="text-xs text-muted-foreground">{peer.companyName}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {periods.map((period) => (
                <div key={period} className="rounded-md bg-muted/45 px-2 py-1.5">
                  <p className="text-[11px] text-muted-foreground">{period}</p>
                  <p className="text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                    {formatFinancialValue(peer.values[period])}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyLogo({ peer }: { peer: StockFinancialPeerComparison["peers"][number] }) {
  const [failed, setFailed] = React.useState(false);

  if (peer.image && !failed) {
    return (
      <Image
        src={peer.image}
        alt=""
        width={36}
        height={36}
        unoptimized
        className="size-9 rounded-lg border bg-background object-contain p-1"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-xs font-bold text-primary">
      {peer.symbol.slice(0, 2)}
    </span>
  );
}

function MetricChart({
  points,
  mode,
}: {
  points: Array<{ period: string; value: number }>;
  mode: "bars" | "line";
}) {
  if (points.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border bg-muted/20 text-muted-foreground">
        No numeric values to chart.
      </div>
    );
  }

  const width = 980;
  const height = 440;
  const padding = { top: 62, right: 36, bottom: 96, left: 86 };
  const values = points.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const yFor = (value: number) =>
    padding.top + ((maxValue - value) / range) * plotHeight;
  const zeroY = yFor(0);
  const step = plotWidth / Math.max(1, points.length);
  const linePoints = points
    .map((point, index) => {
      const x = padding.left + step * index + step / 2;
      return `${x.toFixed(1)},${yFor(point.value).toFixed(1)}`;
    })
    .join(" ");

  const ticks = Array.from(new Set([maxValue, (maxValue + minValue) / 2, minValue]));
  const labelEvery = points.length > 12 ? Math.ceil(points.length / 12) : 1;

  return (
    <div className="overflow-x-auto rounded-xl border bg-background p-2 sm:p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[420px] min-w-[760px] w-full"
        aria-hidden
      >
        {ticks.map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="hsl(var(--border))"
                strokeDasharray="5 6"
              />
              <text x={padding.left - 12} y={y + 5} textAnchor="end" className="fill-muted-foreground text-xs">
                {formatCompactValue(tick)}
              </text>
            </g>
          );
        })}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={zeroY}
          y2={zeroY}
          stroke="hsl(var(--foreground))"
          strokeOpacity="0.25"
        />
        {mode === "bars" ? (
          points.map((point, index) => {
            const x = padding.left + step * index + step * 0.18;
            const barWidth = Math.max(16, step * 0.64);
            const y = Math.min(yFor(point.value), zeroY);
            const barHeight = Math.max(2, Math.abs(zeroY - yFor(point.value)));
            const valueY =
              point.value >= 0
                ? Math.max(padding.top - 10, y - 10)
                : Math.min(height - padding.bottom + 28, y + barHeight + 18);
            const showPeriod = index % labelEvery === 0 || index === points.length - 1;
            return (
              <g key={point.period}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  fill={point.value >= 0 ? "rgb(14 165 233)" : "rgb(239 68 68)"}
                />
                <text
                  x={x + barWidth / 2}
                  y={valueY}
                  textAnchor="middle"
                  className="fill-foreground text-[11px] font-semibold tabular-nums"
                >
                  {formatCompactValue(point.value)}
                </text>
                {showPeriod ? (
                  <text
                    x={x + barWidth / 2}
                    y={height - 34}
                    textAnchor="end"
                    transform={`rotate(-45 ${x + barWidth / 2} ${height - 34})`}
                    className="fill-foreground text-xs"
                  >
                    {point.period}
                  </text>
                ) : null}
              </g>
            );
          })
        ) : (
          <>
            <polyline
              fill="none"
              stroke="rgb(5 150 105)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              points={linePoints}
            />
            {points.map((point, index) => {
              const x = padding.left + step * index + step / 2;
              const y = yFor(point.value);
              const labelY = y < padding.top + 24 ? y + 24 : y - 12;
              const showPeriod = index % labelEvery === 0 || index === points.length - 1;
              return (
                <g key={point.period}>
                  <circle cx={x} cy={y} r="5" fill="rgb(5 150 105)" />
                  <text
                    x={x}
                    y={labelY}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-semibold tabular-nums"
                  >
                    {formatCompactValue(point.value)}
                  </text>
                  {showPeriod ? (
                    <text
                      x={x}
                      y={height - 34}
                      textAnchor="end"
                      transform={`rotate(-45 ${x} ${height - 34})`}
                      className="fill-foreground text-xs"
                    >
                      {point.period}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return <BarChart3 className="size-4 text-muted-foreground" />;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const points = clean
    .map((value, index) => {
      const x = (index / Math.max(1, clean.length - 1)) * 72;
      const y = 28 - ((value - min) / range) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const last = clean[clean.length - 1];
  const first = clean[0];
  const color = last >= first ? "rgb(5 150 105)" : "rgb(220 38 38)";

  return (
    <svg viewBox="0 0 72 32" className="h-8 w-20" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2.5" points={points} />
    </svg>
  );
}

function StatusPill({
  cachedAt,
  isRefreshing,
  isFromDeviceCache,
}: {
  cachedAt: string | null;
  isRefreshing: boolean;
  isFromDeviceCache: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
      <Database className="size-3" />
      {isRefreshing ? "Refreshing fundamentals..." : cachedAt ? "Fundamentals cached" : "Cache ready"}
      {isFromDeviceCache ? <span className="text-primary">device</span> : null}
    </span>
  );
}

function collectTablePeriods(tables: FinancialTable[]) {
  const periods: string[] = [];
  for (const table of tables) {
    for (const period of table.years) {
      if (!periods.includes(period)) periods.push(period);
    }
  }
  return periods;
}

function getDefaultRange(periods: string[]) {
  if (periods.length === 0) return { start: "", end: "" };
  const latestFive = periods.slice(-5);
  return {
    start: latestFive[0] ?? periods[0],
    end: latestFive[latestFive.length - 1] ?? periods[periods.length - 1],
  };
}

function normalizeRange(periods: string[], range: { start: string; end: string }) {
  if (periods.length === 0) return { start: "", end: "" };
  const fallback = getDefaultRange(periods);
  const start = periods.includes(range.start) ? range.start : fallback.start;
  const end = periods.includes(range.end) ? range.end : fallback.end;
  const startIndex = periods.indexOf(start);
  const endIndex = periods.indexOf(end);
  return startIndex <= endIndex ? { start, end } : { start: end, end: start };
}

function getPeriodsInRange(periods: string[], start: string, end: string) {
  const range = normalizeRange(periods, { start, end });
  const startIndex = periods.indexOf(range.start);
  const endIndex = periods.indexOf(range.end);
  if (startIndex < 0 || endIndex < 0) return periods.slice(-5);
  return periods.slice(startIndex, endIndex + 1);
}

function getMetricPoints(row: FinancialTableRow) {
  return Object.entries(row.values)
    .map(([period, value]) => ({ period, value: toNumber(value) }))
    .filter((point) => Number.isFinite(point.value));
}

function formatCompactValue(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(abs >= 10 ? 0 : 1)}`;
}

function formatFinancialValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return String(value);
  const abs = Math.abs(numeric);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: abs >= 100 ? 0 : 2,
    minimumFractionDigits: abs !== 0 && abs < 10 ? 1 : 0,
  }).format(abs);
  return numeric < 0 ? `(${formatted})` : formatted;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  const normalized = trimmed.replace(/[(),]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return trimmed.includes("(") || trimmed.startsWith("-") ? -Math.abs(parsed) : parsed;
}
