"use client";

import * as React from "react";
import {
  Banknote,
  Building2,
  CalendarRange,
  ExternalLink,
  Globe2,
  LineChart,
  MapPin,
  PieChart,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/accent";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { EmptyState } from "@/components/empty-state";
import { LiveQuote } from "@/components/live-quote";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ViewportLazy } from "@/components/loading/viewport-lazy";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { PriceChart } from "@/components/charts/price-chart";
import { SmartBackLink } from "@/components/smart-back-link";
import { StockFinancialsPanel } from "@/components/stock/stock-financials-panel";
import { StockFundHolders } from "@/components/stock/stock-fund-holders";
import { StockLogo } from "@/components/stock/stock-logo";
import { WatchButton } from "@/components/watch-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { isPortfolioCacheFresh, usePortfolioMutationRefresh } from "@/lib/cache/portfolio-mutations";
import type { CachedRecord } from "@/lib/hooks/use-persistent-resource";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { computeStockMarketSnapshot } from "@/lib/market/stock-snapshot";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { formatCompact, formatDate, formatNumber, formatPercent, formatPKR, plColorClass } from "@/lib/format";
import { hasWikiMarkup, wikiToPlainText } from "@/lib/text/plain-text";
import { cn } from "@/lib/utils";
import type { StockOverviewData } from "@/lib/types/stock-overview";
import type { StockPageData, StockPositionSummary } from "@/lib/services/stock-page";
import type { CdcDividend, HoldingWithMetrics } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CachedStockPage({ symbol, userId }: { symbol: string; userId: string }) {
  const normalizedSymbol = symbol.toUpperCase();
  const cacheKey = `private:stock:${userId}:${normalizedSymbol}`;
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptStockCache = React.useCallback(
    (record: CachedRecord<StockPageData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record, userId),
    [cacheClosedOnly, userId]
  );
  const { data, error, isLoading, refreshNow } = usePersistentResource<StockPageData>({
    cacheKey,
    url: `/api/private/stocks/${encodeURIComponent(symbol)}`,
    refreshInterval: 60_000,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: acceptStockCache,
  });

  usePortfolioMutationRefresh(() => {
    void refreshNow();
  }, userId);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        {isLoading ? (
          <PageLoadingState message="Loading Stock..." variant="stock" />
        ) : (
          <EmptyState
            icon={<TrendingUp className="size-6" />}
            title="Stock unavailable"
            description={
              error?.message ??
              "The saved cache is empty and fresh stock data could not be loaded."
            }
          />
        )}
      </div>
    );
  }

  return <StockPageView data={data} error={error} userId={userId} />;
}

function StockPageView({
  data,
  error,
  userId,
}: {
  data: StockPageData;
  error?: Error;
  userId: string;
}) {
  const { detail, portfolios, watchedSymbols, symbol, cdcDividends } = data;
  const { ticker, quote, candles, intraday } = detail;
  const { liveHoldings: positionRows } = useLiveHoldings(data.positionRows);
  const summary = React.useMemo(() => summarizePositionRows(positionRows), [positionRows]);
  const hasPosition = summary.totalQty > 0;
  const snapshot = React.useMemo(
    () => computeStockMarketSnapshot(quote, candles),
    [quote, candles]
  );
  const { data: overview } = usePersistentResource<StockOverviewData>({
    cacheKey: `public:stock-overview:v3:${symbol}`,
    url: `/api/public/stock-overview/${encodeURIComponent(symbol)}`,
    refreshInterval: 60 * 60 * 1000,
  });
  const profile = overview?.profile;
  const payouts = overview?.payouts?.rows ?? [];
  const profileLoading = !overview && !profile;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref="/market" label="Back" />

      <div className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-card p-4 shadow-soft ring-1 ring-foreground/10 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-brand-mesh-faint" aria-hidden />
        <div className="relative">
          <div className="flex items-start gap-3 sm:gap-4">
            <StockLogo symbol={symbol} name={ticker?.company_name} size="lg" className="mt-0.5" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
                {(ticker?.sector || profile?.sector) && (
                  <Badge variant="info">{ticker?.sector ?? profile?.sector}</Badge>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {profile?.companyName ?? ticker?.company_name ?? symbol}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
            <div className="min-w-0">
              <LiveQuote symbol={symbol} initial={quote} />
              {error ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Live refresh is unavailable right now, so the last stock view is still shown.
                </p>
              ) : null}
            </div>
            <div className="relative shrink-0 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <div
                className={cn(
                  "grid gap-2 sm:contents [&_button]:min-w-0 [&_button]:w-full [&_form]:min-w-0 sm:[&_button]:w-auto",
                  portfolios.length > 0 ? "grid-cols-3" : "grid-cols-2"
                )}
              >
                <WatchButton symbol={symbol} initialWatching={watchedSymbols.includes(symbol)} />
                <CreateAlertDialog defaultSymbol={symbol} />
                {portfolios.length > 0 && (
                  <AddTradeDialog portfolioId={portfolios[0].id} defaultSymbol={symbol} userId={userId} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CompanyProfileCard
        symbol={symbol}
        profile={profile}
        loading={profileLoading}
      />
      <EquityProfileCard profile={profile} loading={profileLoading} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <IconChip accent="emerald"><LineChart /></IconChip>
              <CardTitle>Price</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PriceChart candles={candles} intraday={intraday} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <MarketSnapshotCard snapshot={snapshot} />

          {hasPosition && (
            <PositionDetailCard
              summary={summary}
              livePrice={
                summary.totalQty > 0
                  ? summary.marketValue / summary.totalQty
                  : (quote?.price ?? 0)
              }
            />
          )}
        </div>
      </div>

      {payouts.length > 0 && (
        <ViewportLazy minHeight={240} fallback={<SectionSkeleton rows={4} />}>
          <CompanyPayoutsHistory rows={payouts} />
        </ViewportLazy>
      )}

      {cdcDividends.length > 0 && (
        <ViewportLazy
          minHeight={280}
          fallback={<SectionSkeleton rows={5} />}
        >
          <StockDividendHistory dividends={cdcDividends} />
        </ViewportLazy>
      )}

      <ViewportLazy minHeight={360} fallback={<SectionSkeleton rows={6} />}>
        <StockFinancialsPanel symbol={symbol} companyName={ticker?.company_name} />
      </ViewportLazy>

      <StockFundHolders symbol={symbol} />

      <ViewportLazy minHeight={420} fallback={<SectionSkeleton rows={7} />}>
        <Card>
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:justify-between">
            <div className="flex items-start gap-3">
              <IconChip accent="emerald"><CalendarRange /></IconChip>
              <div>
                <CardTitle>Daily gain / loss calendar</CardTitle>
                <CardDescription>
                  {data.calendar.hasPosition
                    ? `Coloured by your position's daily P/L — green for gains, red for losses${data.calendar.firstDate ? `, from your first buy on ${formatDate(data.calendar.firstDate)}` : ""}.`
                    : "Coloured by the stock's daily move. Add a position to track your P/L per day."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PLCalendar
              data={data.calendar.days}
              hasPosition={data.calendar.hasPosition}
              livePositions={
                hasPosition
                  ? [{ symbol, quantity: summary.totalQty, avgBuyPrice: summary.avgCost, initial: quote }]
                  : []
              }
            />
          </CardContent>
        </Card>
      </ViewportLazy>
    </div>
  );
}

function MarketSnapshotCard({
  snapshot,
}: {
  snapshot: ReturnType<typeof computeStockMarketSnapshot>;
}) {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex-row items-center gap-3">
        <IconChip accent="sky" size="sm"><CalendarRange /></IconChip>
        <CardTitle className="font-semibold">Market snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Stat label="Open" value={formatPKR(snapshot.open)} />
          <Stat label="High" value={formatPKR(snapshot.high)} />
          <Stat label="Low" value={formatPKR(snapshot.low)} />
          <Stat label="Volume" value={formatCompact(snapshot.volume)} />
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              52-week range
            </p>
            <p className="text-xs font-semibold tabular-nums text-muted-foreground">
              {snapshot.posIn52w != null ? `${snapshot.posIn52w.toFixed(0)}%` : "—"}
            </p>
          </div>
          <div className="relative mt-2.5 h-2 w-full rounded-full bg-gradient-to-r from-rose-500/35 via-muted to-emerald-500/40">
            {snapshot.posIn52w != null ? (
              <div
                className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
                style={{ left: `calc(${snapshot.posIn52w}% - 6px)` }}
                aria-hidden
              />
            ) : null}
          </div>
          <div className="mt-2 flex justify-between gap-3 text-xs tabular-nums text-muted-foreground">
            <span>{formatPKR(snapshot.week52Low)}</span>
            <span className="font-medium text-foreground">{formatPKR(snapshot.price)}</span>
            <span>{formatPKR(snapshot.week52High)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ReturnPill label="6M" value={snapshot.change6m} />
          <ReturnPill label="1Y" value={snapshot.change1y} />
          <ReturnPill label="YTD" value={snapshot.changeYtd} />
        </div>
      </CardContent>
    </Card>
  );
}

function ReturnPill({ label, value }: { label: string; value: number | null }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-2.5 py-2 text-center",
        value == null
          ? "border-border bg-card"
          : value >= 0
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-rose-500/20 bg-rose-500/5"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums",
          value == null ? "text-muted-foreground" : plColorClass(value)
        )}
      >
        {formatPercent(value)}
      </p>
    </div>
  );
}

function CompanyProfileCard({
  symbol,
  profile,
  loading,
}: {
  symbol: string;
  profile: StockOverviewData["profile"] | undefined;
  loading: boolean;
}) {
  const sourceDescription = profile?.description?.trim() || null;
  const [aiDescription, setAiDescription] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);

  React.useEffect(() => {
    setAiDescription(null);
    if (!sourceDescription || sourceDescription.length < 40) {
      setAiLoading(false);
      return;
    }

    const controller = new AbortController();
    setAiLoading(true);

    void fetch(`/api/public/stock-profile-description/${encodeURIComponent(symbol)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json().catch(() => null)) as {
          data?: { description?: string; usedAi?: boolean };
        } | null;
        const text = payload?.data?.description?.trim();
        if (!text || !payload?.data?.usedAi) return null;
        return text;
      })
      .then((text) => {
        if (controller.signal.aborted) return;
        if (text) setAiDescription(text);
      })
      .catch(() => {
        // Keep cleaned plaintext; never toast on AI failure / demo / missing key.
      })
      .finally(() => {
        if (!controller.signal.aborted) setAiLoading(false);
      });

    return () => controller.abort();
  }, [symbol, sourceDescription]);

  if (loading) {
    return (
      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const displayDescription = aiDescription || sourceDescription;
  const descriptionParagraphs = (displayDescription ?? "")
    .split(/\n\n+/)
    .map((part) => wikiToPlainText(part))
    .filter((part) => part && !hasWikiMarkup(part));
  const hasDescription = descriptionParagraphs.length > 0;
  const showDescriptionLoader = aiLoading && !aiDescription;
  const keyPeople = (profile.keyPeople ?? [])
    .map((person) => ({
      role: wikiToPlainText(person.role) || "Key person",
      name: wikiToPlainText(person.name),
    }))
    .filter(
      (person) =>
        person.name.length >= 3 &&
        !hasWikiMarkup(person.name) &&
        !hasWikiMarkup(person.role) &&
        !/[\[\]{}|]/.test(person.name)
    );
  const hasPeople = keyPeople.length > 0;
  const hasContact = Boolean(profile.address || profile.website);
  if (!hasDescription && !hasPeople && !hasContact) return null;

  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconChip accent="sky" size="sm"><Building2 /></IconChip>
          <CardTitle className="font-semibold">Company profile</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasDescription ? (
          <div className="space-y-3">
            {showDescriptionLoader ? (
              <div className="space-y-2" aria-busy="true" aria-label="Cleaning company description">
                {descriptionParagraphs.length ? (
                  <div className="space-y-3 opacity-60">
                    {descriptionParagraphs.map((paragraph, index) => (
                      <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-[92%]" />
                  <Skeleton className="h-3.5 w-[78%]" />
                </div>
              </div>
            ) : (
              descriptionParagraphs.map((paragraph, index) => (
                <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))
            )}
          </div>
        ) : null}

        {hasPeople ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <UsersRound className="size-3" />
              Key people
            </p>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {keyPeople.map((person) => (
                <div key={`${person.role}-${person.name}`} className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {person.role}
                  </p>
                  <p className="mt-0.5 text-sm font-medium">{person.name}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {hasContact ? (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
            {profile.address ? (
              <p className="inline-flex min-w-0 items-start gap-1.5 text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>{profile.address}</span>
              </p>
            ) : null}
            {profile.website ? (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <Globe2 className="size-3.5" />
                {profile.website.replace(/^https?:\/\//i, "")}
                <ExternalLink className="size-3 opacity-70" />
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EquityProfileCard({
  profile,
  loading,
}: {
  profile: StockOverviewData["profile"] | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const equity = profile.equity;
  const hasEquity =
    equity.marketCapBillions != null ||
    equity.shares != null ||
    equity.freeFloatShares != null ||
    equity.freeFloatPct != null;
  if (!hasEquity) return null;

  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconChip accent="emerald" size="sm"><PieChart /></IconChip>
          <div>
            <CardTitle className="font-semibold">Equity profile</CardTitle>
            <CardDescription>
              Free float is the portion of shares available for public trading —
              not locked by sponsors or strategic holders.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
          <Stat
            label="Market cap"
            value={
              equity.marketCapBillions != null
                ? `Rs ${formatNumber(equity.marketCapBillions, 2)}B`
                : "—"
            }
          />
          <Stat
            label="Shares"
            value={equity.shares != null ? formatCompact(equity.shares) : "—"}
          />
          <Stat
            label="Free float"
            value={
              equity.freeFloatShares != null
                ? formatCompact(equity.freeFloatShares)
                : "—"
            }
          />
          <Stat
            label="% Free float"
            value={formatFreeFloatPercent(equity.freeFloatPct)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Unsigned free-float display — e.g. "55%", never "+60.00%". */
function formatFreeFloatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return `${Math.round(rounded)}%`;
  }
  return `${rounded.toFixed(1)}%`;
}

function formatPerShare(value: number): string {
  const rounded = Math.round(value * 10_000) / 10_000;
  return String(rounded);
}

function CompanyPayoutsHistory({
  rows,
}: {
  rows: StockOverviewData["payouts"]["rows"];
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconChip accent="amber"><Banknote /></IconChip>
          <div>
            <CardTitle>Last 10 payouts</CardTitle>
            <CardDescription>Company cash dividend history</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-2">
        <div className="space-y-2 px-4 sm:hidden">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gain">{row.payoutLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.amountPerShare != null
                      ? `${formatPerShare(row.amountPerShare)} per share`
                      : "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{row.date}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto scrollbar-thin sm:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Credited Date</TableHead>
                <TableHead>Payout %</TableHead>
                <TableHead className="text-right">Per share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium tabular-nums">{row.date}</TableCell>
                  <TableCell className="font-semibold text-gain">{row.payoutLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amountPerShare != null ? formatPerShare(row.amountPerShare) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function summarizePositionRows(rows: HoldingWithMetrics[]): StockPositionSummary {
  const totalQty = rows.reduce((sum, holding) => sum + holding.quantity, 0);
  const costBasis = rows.reduce((sum, holding) => sum + holding.costBasis, 0);
  const marketValue = rows.reduce((sum, holding) => sum + holding.marketValue, 0);
  const dayUnrealizedPL = rows.reduce((sum, holding) => sum + holding.dayChange, 0);
  const prevValue = marketValue - dayUnrealizedPL;
  const unrealizedPL = rows.reduce((sum, holding) => sum + holding.unrealizedPL, 0);

  return {
    totalQty,
    costBasis,
    avgCost: totalQty ? costBasis / totalQty : 0,
    marketValue,
    dayUnrealizedPL,
    dayUnrealizedPLPct: prevValue ? (dayUnrealizedPL / prevValue) * 100 : 0,
    unrealizedPL,
    unrealizedPLPct: costBasis ? (unrealizedPL / costBasis) * 100 : 0,
  };
}

/** Matches portfolio holdings "Detailed" card (`MobileHoldingCard` in holdings-table). */
function PositionDetailCard({
  summary,
  livePrice,
}: {
  summary: StockPositionSummary;
  livePrice: number;
}) {
  const dayClass = plColorClass(summary.dayUnrealizedPL);
  const totalClass = plColorClass(summary.unrealizedPL);

  return (
    <article className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <IconChip accent="teal" size="sm">
            <Wallet />
          </IconChip>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Your position</p>
          </div>
          <div className="min-w-0 border-l border-border/70 pl-3">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Current
            </p>
            <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">
              {formatNumber(livePrice, 2)}
            </p>
          </div>
        </div>
      </div>

      <AmberRule />

      <div className="grid grid-cols-2">
        <div className="px-4 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Avg price
          </p>
          <p className="font-semibold tabular-nums text-foreground">
            {formatNumber(summary.avgCost, 2)}
          </p>
        </div>
        <div className="border-l border-amber-500/20 px-4 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Qty
          </p>
          <p className="font-semibold tabular-nums text-foreground">
            {formatNumber(summary.totalQty, 0)}
          </p>
        </div>
      </div>

      <AmberRule />

      <div className="grid grid-cols-2">
        <div className="px-4 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Day P/L
          </p>
          <p className={cn("font-semibold leading-tight tabular-nums", dayClass)}>
            {formatPKR(summary.dayUnrealizedPL, { sign: true })}
          </p>
          <p className={cn("text-xs font-medium tabular-nums", dayClass)}>
            ({formatPercent(summary.dayUnrealizedPLPct)})
          </p>
        </div>
        <div className="border-l border-amber-500/20 px-4 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Unrealized
          </p>
          <p className={cn("font-semibold leading-tight tabular-nums", totalClass)}>
            {formatPKR(summary.unrealizedPL, { sign: true })}
          </p>
          <p className={cn("text-xs font-medium tabular-nums", totalClass)}>
            ({formatPercent(summary.unrealizedPLPct)})
          </p>
        </div>
      </div>

      <AmberRule />

      <div className="grid grid-cols-2">
        <div className="px-4 py-2.5 pb-4">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Invested
          </p>
          <p className="font-semibold tabular-nums text-foreground">
            {formatPKR(summary.costBasis)}
          </p>
        </div>
        <div className="border-l border-amber-500/20 px-4 py-2.5 pb-4">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Mkt value
          </p>
          <p className="font-semibold tabular-nums text-foreground">
            {formatPKR(summary.marketValue)}
          </p>
        </div>
      </div>
    </article>
  );
}

function AmberRule() {
  return (
    <div
      className="h-px w-full"
      style={{
        background: "linear-gradient(to right, transparent, rgba(245,158,11,0.55), transparent)",
        boxShadow: "0 0 8px rgba(245,158,11,0.18)",
      }}
    />
  );
}

function StockDividendHistory({ dividends }: { dividends: CdcDividend[] }) {
  const totalNet = dividends.reduce((s, d) => s + Number(d.net_amount), 0);
  const totalGross = dividends.reduce((s, d) => s + Number(d.gross_amount), 0);

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconChip accent="amber"><Banknote /></IconChip>
          <div>
            <CardTitle>Received Dividend history</CardTitle>
            <CardDescription>
              Dividends you received for this stock · Official CDC records · {dividends.length} payment
              {dividends.length !== 1 ? "s" : ""} · Total net {formatPKR(totalNet)}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Gross received</p>
            <p className="font-semibold tabular-nums">{formatPKR(totalGross)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Net received</p>
            <p className="font-semibold tabular-nums text-gain">{formatPKR(totalNet)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-2">
        <div className="space-y-3 px-4 sm:hidden">
          {dividends.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {d.financial_year && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">FY{d.financial_year}</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(d.payment_date)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-0 border-t border-border text-sm">
                <div className="border-b border-r border-border px-0 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rate / Share</p>
                  <p className="tabular-nums font-medium">{formatPKR(Number(d.rate_per_security))}</p>
                </div>
                <div className="border-b border-border py-2 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Securities</p>
                  <p className="tabular-nums font-medium">{formatNumber(Number(d.no_of_securities), 0)}</p>
                </div>
                <div className="border-b border-r border-border py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Gross Dividend</p>
                  <p className="tabular-nums font-medium">{formatPKR(Number(d.gross_amount))}</p>
                </div>
                <div className="border-b border-border py-2 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tax (WHT)</p>
                  <p className="tabular-nums font-medium text-loss">{formatPKR(Number(d.tax_deducted))}</p>
                </div>
                <div className="border-r border-border py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Zakat</p>
                  <p className="tabular-nums font-medium text-muted-foreground">
                    {Number(d.zakat_deducted) > 0 ? formatPKR(Number(d.zakat_deducted)) : "—"}
                  </p>
                </div>
                <div className="py-2 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Amount Paid</p>
                  <p className="tabular-nums text-base font-semibold text-gain">{formatPKR(Number(d.net_amount))}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto scrollbar-thin sm:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Payment date</TableHead>
                <TableHead>FY</TableHead>
                <TableHead>Warrant #</TableHead>
                <TableHead className="text-right">Rate / Share</TableHead>
                <TableHead className="text-right">Securities</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">WHT</TableHead>
                <TableHead className="text-right">Zakat</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dividends.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{formatDate(d.payment_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{d.financial_year ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.warrant_no ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPKR(Number(d.rate_per_security))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Number(d.no_of_securities), 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPKR(Number(d.gross_amount))}</TableCell>
                  <TableCell className="text-right tabular-nums text-loss">{formatPKR(Number(d.tax_deducted))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Number(d.zakat_deducted) > 0 ? formatPKR(Number(d.zakat_deducted)) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-gain">
                    {formatPKR(Number(d.net_amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums [overflow-wrap:anywhere] ${className ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
