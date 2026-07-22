"use client";

import * as React from "react";
import { ArrowLeftRight, CalendarRange, Globe2, Users } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { FipiLipiBoard, type FlowCurrency } from "@/components/market/fipi-lipi-board";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatFlow } from "@/lib/format";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { FipiLipiData } from "@/lib/types/fipi-lipi";

export function CachedFipiLipiPage() {
  const [currency, setCurrency] = React.useState<FlowCurrency>("USD");
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<FipiLipiData>({
      cacheKey: "public:fipi-lipi-v9",
      url: "/api/public/fipi-lipi",
      refreshInterval: 30 * 60_000,
    });

  const rate = data?.usdPkrRate ?? 1;
  const show = (usd: number | null | undefined) =>
    usd == null ? "—" : formatFlow(currency === "PKR" ? usd * rate : usd, currency);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<ArrowLeftRight />}
        eyebrow="Smart money tracker"
        accent="sky"
        title="FIPI / LIPI Data"
        description="Who is buying and selling PSX each day — foreign vs local investors, Regular market."
        actions={
          <>
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="sky"
              label="Refresh flows"
              onRefresh={async () => {
                await refreshNow();
                return "Investor flow data refreshed";
              }}
              stages={[
                "Connecting to NCCPL",
                "Loading investor flow data",
                "Updating flow board",
              ]}
            />
          </>
        }
      />

      {data ? (
        <>
          {data.source === "sample" && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Showing representative sample figures — the live NCCPL feed is not connected yet.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Foreign net (latest)"
              value={show(data.latest?.fipiNet.net)}
              tone={toneOf(data.latest?.fipiNet.net)}
              accent="sky"
              icon={<Globe2 className="size-4" />}
              sub={
                data.latest ? (
                  <span className="text-muted-foreground">{data.latest.date}</span>
                ) : undefined
              }
            />
            <StatCard
              label="Local net (latest)"
              value={show(data.latest?.lipiNet.net)}
              tone={toneOf(data.latest?.lipiNet.net)}
              accent="violet"
              icon={<Users className="size-4" />}
            />
            <StatCard
              label={`Foreign ${data.fyLabel}`}
              value={show(data.latest?.fipiNet.fytd)}
              tone={toneOf(data.latest?.fipiNet.fytd)}
              accent="emerald"
              icon={<CalendarRange className="size-4" />}
              sub={<span className="text-muted-foreground">Since 1 Jul</span>}
            />
            <StatCard
              label={`Foreign ${data.cyLabel}`}
              value={show(data.latest?.fipiNet.cytd)}
              tone={toneOf(data.latest?.fipiNet.cytd)}
              accent="amber"
              icon={<CalendarRange className="size-4" />}
              sub={<span className="text-muted-foreground">Since 1 Jan</span>}
            />
          </div>

          <FipiLipiBoard data={data} currency={currency} onCurrencyChange={setCurrency} />

          <p className="text-xs text-muted-foreground/60">
            Source: NCCPL · Regular market · published each trading day after close.
            {currency === "PKR" && ` Converted at ${rate.toFixed(2)} PKR/USD.`}
          </p>
        </>
      ) : isLoading ? (
        <PageLoadingState message="Loading investor flows…" variant="list" />
      ) : (
        <EmptyState
          icon={<ArrowLeftRight className="size-6" />}
          title="Investor flows unavailable"
          description={
            error?.message ?? "Could not load FIPI/LIPI data. Please try again shortly."
          }
        />
      )}
    </div>
  );
}

function toneOf(value: number | null | undefined): "gain" | "loss" | "default" {
  if (value == null || Number.isNaN(value)) return "default";
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "default";
}
