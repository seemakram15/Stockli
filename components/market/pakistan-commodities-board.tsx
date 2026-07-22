"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { PriceLineChart } from "@/components/charts/price-line-chart";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { PkCommoditiesData } from "@/lib/services/pakistan-commodities";
import type { PkRawMaterialsData } from "@/lib/services/pakistan-raw-materials";
import type { HistoryPoint } from "@/app/api/public/commodity-history/route";

const PK_CHART_OPTIONS = [
  { label: "Gold 24K / Tola",   symbol: "PK-GOLD-TOLA",     unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Silver / Tola",     symbol: "PK-SILVER-TOLA",    unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Copper / kg",       symbol: "PK-COPPER-KG",      unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Platinum / Tola",   symbol: "PK-PLATINUM-TOLA",  unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
] as const;

type ChartSymbol = (typeof PK_CHART_OPTIONS)[number]["symbol"];

const RAW_CHART_OPTIONS = [
  { label: "Coal / MT",     symbol: "PK-COAL",   unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Urea / 50kg",  symbol: "PK-UREA",   unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
  { label: "Cement / 50kg",symbol: "PK-CEMENT-V3", unit: "Rs ", fmt: (v: number) => v.toLocaleString("en-PK", { maximumFractionDigits: 0 }) },
] as const;

type RawChartSymbol = (typeof RAW_CHART_OPTIONS)[number]["symbol"];

const CATEGORY_STYLES: Record<string, { dot: string; label: string }> = {
  construction: { dot: "bg-orange-400",  label: "Construction" },
  fertilizer:   { dot: "bg-emerald-400", label: "Fertilizer"   },
  agriculture:  { dot: "bg-yellow-400",  label: "Agriculture"  },
  energy:       { dot: "bg-sky-400",     label: "Energy"       },
};

export interface PakCommoditiesBoardHandle {
  refresh(): Promise<void>;
}

export const PakistanCommoditiesBoard = React.forwardRef<PakCommoditiesBoardHandle>(
  function PakistanCommoditiesBoard(_, ref) {
    const [chartSymbol, setChartSymbol] = React.useState<ChartSymbol>("PK-GOLD-TOLA");
    const [rawChartSymbol, setRawChartSymbol] = React.useState<RawChartSymbol>("PK-COAL");

    const { data: commodities, isLoading, refreshNow } = usePersistentResource<PkCommoditiesData>({
      cacheKey: "public:pk-commodities-v12",
      url: "/api/public/pakistan-commodities",
      refreshInterval: 2 * 60 * 1000,
    });

    const { data: chartData, isLoading: chartLoading, refreshNow: refreshChart } = usePersistentResource<HistoryPoint[]>({
      cacheKey: `public:commodity-history-v4:${chartSymbol}`,
      url: `/api/public/commodity-history?symbol=${chartSymbol}`,
      refreshInterval: 4 * 60 * 60 * 1000,
    });

    const { data: rawMaterials, isLoading: rawLoading, refreshNow: refreshRaw } = usePersistentResource<PkRawMaterialsData>({
      cacheKey: "public:pk-raw-materials-v3",
      url: "/api/public/pakistan-raw-materials",
      refreshInterval: 6 * 60 * 60 * 1000,
    });

    const { data: rawChartData, isLoading: rawChartLoading, refreshNow: refreshRawChart } = usePersistentResource<HistoryPoint[]>({
      cacheKey: `public:commodity-history-v4:${rawChartSymbol}`,
      url: `/api/public/commodity-history?symbol=${rawChartSymbol}`,
      refreshInterval: 4 * 60 * 60 * 1000,
    });

    React.useImperativeHandle(ref, () => ({
      refresh: () => Promise.all([refreshNow(), refreshChart(), refreshRaw(), refreshRawChart()]).then(() => undefined),
    }), [refreshNow, refreshChart, refreshRaw, refreshRawChart]);

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
    const activeRawOption = RAW_CHART_OPTIONS.find((o) => o.symbol === rawChartSymbol)!;;

    // Group raw material items by category
    const rawGroups = React.useMemo(() => {
      if (!rawMaterials) return [];
      const order = ["construction", "fertilizer", "agriculture", "energy"] as const;
      return order
        .map((cat) => ({
          cat,
          items: rawMaterials.items.filter((i) => i.category === cat),
        }))
        .filter((g) => g.items.length > 0);
    }, [rawMaterials]);

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

        {/* Pakistan Raw Material Prices */}
        <div className="rounded-xl border border-border bg-muted/10 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pakistan Market Rates
          </p>
          {rawLoading && !rawMaterials ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : rawGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">Prices unavailable</p>
          ) : (
            <div className="space-y-3">
              {rawGroups.map(({ cat, items }) => {
                const style = CATEGORY_STYLES[cat];
                return (
                  <div key={cat}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {style.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {items.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                        >
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <div className="text-right">
                            {item.price != null ? (
                              <>
                                <span className="text-sm font-semibold tabular-nums">
                                  Rs {item.price.toLocaleString("en-PK")}
                                </span>
                                <span className="ml-1 text-[10px] text-muted-foreground">{item.unit}</span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {rawMaterials && (
            <p className="mt-2 text-[10px] text-muted-foreground/60">
              Sources: materialrate.pk · kissanshop.com · icons.com.pk · procarepk.com
            </p>
          )}
        </div>

        {/* Raw Material Price Charts */}
        <div className="rounded-xl border border-border bg-muted/10 p-3">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Raw Material Price History
          </p>
          <div className="mb-3 flex flex-wrap gap-1">
            {RAW_CHART_OPTIONS.map((opt) => (
              <button
                key={opt.symbol}
                type="button"
                onClick={() => setRawChartSymbol(opt.symbol)}
                className={
                  "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                  (rawChartSymbol === opt.symbol
                    ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          {rawChartLoading && !rawChartData ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted/20" />
          ) : !rawChartData || rawChartData.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No historical data available</p>
          ) : (
            <PriceLineChart
              data={rawChartData}
              color="hsl(25 95% 53%)"
              height={160}
              unit={activeRawOption.unit}
              label={activeRawOption.label}
              formatPrice={activeRawOption.fmt}
              defaultDuration="1Y"
            />
          )}
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            {rawChartSymbol === "PK-CEMENT-V3"
              ? "Pakistan cement sector trend — scaled to current local price"
              : "International benchmark × PKR rate, calibrated to current local price"}
          </p>
        </div>
      </div>
    );
  }
);

function fmtPKR(n: number) {
  return "Rs " + Math.abs(n).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}
