"use client";

import { ExternalLink, Target } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { MarketStrategyBoard } from "@/components/market/market-strategy-board";
import { PageHeader } from "@/components/page-header";
import { DataDelayBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatNumber, formatPKR, formatSigned, plColorClass } from "@/lib/format";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";
import type { MarketStrategyData } from "@/lib/services/market-strategy";

export function CachedMarketStrategyPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<MarketStrategyData>({
      cacheKey: "public:market-strategy",
      url: "/api/public/market-strategy",
      refreshInterval: 5 * 60_000,
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Target className="size-7 text-primary" />
            Market Strategy
          </span>
        }
        description={
          data
            ? `Estimated fund returns per ${formatPKR(data.investmentAmount)} from MUFAP daily performance.`
            : "Estimated stock fund returns from MUFAP daily performance."
        }
        actions={
          <>
            <DataDelayBadge />
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            {data?.sourceUrl ? (
              <Button asChild variant="outline">
                <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  MUFAP source
                </a>
              </Button>
            ) : null}
          </>
        }
      />

      {data ? (
        <>
          <div className="flex flex-wrap gap-2">
            {data.indexBadges.map((index) => (
              <span
                key={index.symbol}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
              >
                <span className="text-muted-foreground">{index.symbol}</span>{" "}
                <span className="tabular-nums">{formatNumber(index.current, 0)}</span>{" "}
                <span className={cn("tabular-nums", plColorClass(index.change))}>
                  {formatSigned(index.change, 2)}
                </span>
              </span>
            ))}
            <span className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
              Updated {formatDateTime(data.updatedAt)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Average estimate" value={formatPKR(data.summary.avgEstimatedReturn, { sign: true })} tone={data.summary.avgEstimatedReturn} />
            <Metric label="Positive funds" value={String(data.summary.positiveCount)} tone={1} />
            <Metric label="Negative funds" value={String(data.summary.negativeCount)} tone={-1} />
            <Metric
              label="Best fund"
              value={data.summary.best ? formatPKR(data.summary.best.estimatedReturn, { sign: true }) : "-"}
              tone={data.summary.best?.estimatedReturn}
              caption={data.summary.best?.name}
            />
          </div>

          <MarketStrategyBoard data={data} />
        </>
      ) : isLoading ? (
        <PageLoadingState message="Loading market strategy..." />
      ) : (
        <EmptyState
          icon={<Target className="size-6" />}
          title="Market strategy unavailable"
          description={
            error?.message ??
            "The saved cache is empty and fresh strategy data could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone?: number | null;
  caption?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", plColorClass(tone))}>
          {value}
        </p>
        {caption ? <p className="mt-1 truncate text-xs text-muted-foreground">{caption}</p> : null}
      </CardContent>
    </Card>
  );
}
