"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PriceLineChart } from "@/components/charts/price-line-chart";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { PkCommoditiesData } from "@/lib/services/pakistan-commodities";
import type { HistoryPoint } from "@/app/api/public/commodity-history/route";

const PK_CHART_OPTIONS = [
  { label: "Gold 24K / Tola",   symbol: "PK-GOLD-TOLA",     unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Silver / Tola",     symbol: "PK-SILVER-TOLA",    unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Copper / kg",       symbol: "PK-COPPER-KG",      unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Platinum / Tola",   symbol: "PK-PLATINUM-TOLA",  unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
] as const;

type ChartSymbol = (typeof PK_CHART_OPTIONS)[number]["symbol"];

export function PakistanCommoditiesBoard() {
  const [chartSymbol, setChartSymbol] = React.useState<ChartSymbol>("PK-GOLD-TOLA");

  const { data: commodities, isLoading } = usePersistentResource<PkCommoditiesData>({
    cacheKey: "public:pk-commodities-v8",
    url: "/api/public/pakistan-commodities",
    refreshInterval: 2 * 60 * 1000,
  });

  const { data: chartData, isLoading: chartLoading } = usePersistentResource<HistoryPoint[]>({
    cacheKey: `public:commodity-history-v4:${chartSymbol}`,
    url: `/api/public/commodity-history?symbol=${chartSymbol}`,
    refreshInterval: 4 * 60 * 60 * 1000,
  });

  const statCards = React.useMemo(() => {
    if (!commodities) return [];
    return [
      commodities.gold24?.pricePerTola != null && {
        label: "Gold 24K / Tola",
        value: fmtPKR(commodities.gold24.pricePerTola),
        change: commodities.gold24.changePerTola,
      },
      commodities.silver?.pricePerTola != null && {
        label: "Silver / Tola",
        value: fmtPKR(commodities.silver.pricePerTola),
        change: commodities.silver.changePerTola,
      },
      commodities.copper?.pricePerKg != null && {
        label: "Copper / kg",
        value: fmtPKR(commodities.copper.pricePerKg),
        change: commodities.copper.changePerKg,
      },
      commodities.platinum?.pricePerTola != null && {
        label: "Platinum / Tola",
        value: fmtPKR(commodities.platinum.pricePerTola),
        change: commodities.platinum.changePerTola,
      },
    ].filter(Boolean) as { label: string; value: string; change: number | null }[];
  }, [commodities]);

  const activeOption = PK_CHART_OPTIONS.find((o) => o.symbol === chartSymbol)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {isLoading && !commodities
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)
          : statCards.map((c) => (
              <StatCard
                key={c.label}
                label={c.label}
                value={c.value}
                sub={c.change != null ? (
                  <span className={c.change > 0 ? "text-gain" : c.change < 0 ? "text-loss" : "text-muted-foreground"}>
                    {c.change > 0 ? "+" : c.change < 0 ? "-" : ""}{fmtPKR(c.change)} today
                  </span>
                ) : undefined}
                tone={c.change == null ? "default" : c.change > 0 ? "gain" : c.change < 0 ? "loss" : "default"}
                accent="amber"
                icon={c.change != null && c.change >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              />
            ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/10 p-3">
        <div className="mb-3 flex flex-wrap gap-1">
          {PK_CHART_OPTIONS.map((opt) => (
            <button
              key={opt.symbol}
              type="button"
              onClick={() => setChartSymbol(opt.symbol)}
              className={
                "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                (chartSymbol === opt.symbol
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
        {chartLoading && !chartData ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/20" />
        ) : (
          <PriceLineChart
            data={chartData ?? []}
            color="hsl(43 96% 56%)"
            height={160}
            unit={activeOption.unit}
            label={activeOption.label}
            formatPrice={activeOption.fmt}
            defaultDuration="1Y"
          />
        )}
      </div>
    </div>
  );
}

function fmtPKR(n: number) {
  return "Rs " + Math.abs(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}
