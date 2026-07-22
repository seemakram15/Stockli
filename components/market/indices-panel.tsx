"use client";

import * as React from "react";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { PriceChart } from "@/components/charts/price-chart";
import { ChangeBadge } from "@/components/change-badge";
import { DataDelayBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatCompact, plColorClass } from "@/lib/format";
import type {
  IndexCard,
  IndexDetail,
  IndexReturns,
} from "@/lib/services/market";

const RETURN_LABELS: { key: keyof IndexReturns; label: string }[] = [
  { key: "d1", label: "1D" },
  { key: "w1", label: "1W" },
  { key: "m1", label: "1M" },
  { key: "m3", label: "3M" },
  { key: "y1", label: "1Y" },
  { key: "ytd", label: "YTD" },
];

export function IndicesPanel({
  cards,
  initialDetail,
  onDetailChange,
}: {
  cards: IndexCard[];
  initialDetail: IndexDetail;
  onDetailChange?: (detail: IndexDetail) => void;
}) {
  const [selected, setSelected] = React.useState(initialDetail.symbol);
  const [detail, setDetail] = React.useState<IndexDetail>(initialDetail);
  const [loading, setLoading] = React.useState(false);
  const cache = React.useRef<Record<string, IndexDetail>>({ [initialDetail.symbol]: initialDetail });

  React.useEffect(() => {
    const cached = cache.current[initialDetail.symbol];
    const prefer =
      cached && (cached.candles?.length ?? 0) > (initialDetail.candles?.length ?? 0)
        ? {
            ...cached,
            // Always take the fresher live level/change even if we keep longer history.
            current: initialDetail.current,
            change: initialDetail.change,
            changePct: initialDetail.changePct,
            volume: initialDetail.volume,
            returns: initialDetail.returns ?? cached.returns,
          }
        : initialDetail;
    cache.current[initialDetail.symbol] = prefer;
    setDetail((prev) => {
      if (prev.symbol !== initialDetail.symbol) return prev;
      if ((prev.candles?.length ?? 0) > (prefer.candles?.length ?? 0)) {
        return {
          ...prev,
          current: prefer.current,
          change: prefer.change,
          changePct: prefer.changePct,
          volume: prefer.volume,
          returns: prefer.returns ?? prev.returns,
        };
      }
      return prefer;
    });
  }, [initialDetail]);

  React.useEffect(() => {
    onDetailChange?.(detail);
  }, [detail, onDetailChange]);

  // Always load live index history so long-range charts aren't stuck on a short page cache.
  React.useEffect(() => {
    const symbol = selected;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/index/${symbol}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: IndexDetail = await res.json();
        if (cancelled) return;
        const existing = cache.current[symbol];
        if (existing && (existing.candles?.length ?? 0) > (data.candles?.length ?? 0)) {
          const merged = {
            ...existing,
            current: data.current,
            change: data.change,
            changePct: data.changePct,
            volume: data.volume,
            returns: data.returns ?? existing.returns,
          };
          cache.current[symbol] = merged;
          setDetail((prev) => (prev.symbol === symbol ? merged : prev));
          return;
        }
        cache.current[symbol] = data;
        setDetail((prev) => (prev.symbol === symbol ? data : prev));
      } catch {
        /* keep existing detail */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function select(symbol: string) {
    if (symbol === selected) return;
    setSelected(symbol);
    if (cache.current[symbol]) {
      setDetail(cache.current[symbol]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/index/${symbol}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load index");
      const data: IndexDetail = await res.json();
      cache.current[symbol] = data;
      setDetail(data);
    } catch {
      toast.error("Couldn't load that index. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const range52 = Math.max(detail.week52High - detail.week52Low, 1);
  const pos52 = Math.min(
    100,
    Math.max(0, ((detail.current - detail.week52Low) / range52) * 100)
  );

  return (
    <div className="space-y-4">
      {/* Index cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {cards.map((idx) => {
          const isActive = idx.symbol === selected;
          return (
            <button
              key={idx.symbol}
              type="button"
              onClick={() => select(idx.symbol)}
              className={cn(
                "flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:p-4",
                isActive
                  ? "border-emerald-500 ring-1 ring-emerald-500/60"
                  : "border-border hover:border-emerald-500/40"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{idx.symbol}</p>
                <p className="tabular-nums text-lg font-semibold">{formatNumber(idx.current, 0)}</p>
                <ChangeBadge value={idx.change} pct={idx.changePct} showValue className="text-xs" />
              </div>
              <Sparkline data={idx.spark} className="hidden shrink-0 sm:block" />
            </button>
          );
        })}
      </div>

      {/* Selected index detail */}
      <Card className={cn("overflow-hidden transition-opacity", loading && "opacity-60")}>
        <CardHeader className="border-b border-border/60 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-sky-500/[0.04] pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <IconChip accent="emerald" variant="gradient">
                {loading ? <Loader2 className="animate-spin" /> : <Activity />}
              </IconChip>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl sm:text-2xl">{detail.symbol}</CardTitle>
                  <DataDelayBadge />
                </div>
                <p className="truncate text-sm text-muted-foreground">{detail.name}</p>
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1 pt-1">
                  <span className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
                    {formatNumber(detail.current, 2)}
                  </span>
                  <span
                    className={cn(
                      "pb-1 text-sm font-semibold tabular-nums sm:text-base",
                      plColorClass(detail.change)
                    )}
                  >
                    {detail.change >= 0 ? "+" : "−"}
                    {formatNumber(Math.abs(detail.change), 2)}{" "}
                    <span className="opacity-80">({formatPercent(detail.changePct)})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Returns */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {RETURN_LABELS.map(({ key, label }) => {
              const v = detail.returns[key];
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-center",
                    v > 0
                      ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                      : v < 0
                        ? "border-rose-500/20 bg-rose-500/[0.06]"
                        : "border-border bg-muted/20"
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  <p className={cn("mt-0.5 text-sm font-bold tabular-nums", plColorClass(v))}>
                    {formatPercent(v)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Stats + 52W range */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Day High" value={formatNumber(detail.high, 2)} />
              <StatTile label="Day Low" value={formatNumber(detail.low, 2)} />
              <StatTile label="Prev Close" value={formatNumber(detail.prevClose, 2)} />
              <StatTile label="Volume" value={formatCompact(detail.volume)} />
              <StatTile label="52W High" value={formatNumber(detail.week52High, 0)} />
              <StatTile label="52W Low" value={formatNumber(detail.week52Low, 0)} />
            </div>

            <div className="rounded-2xl border border-border bg-muted/15 p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">52-week range</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {pos52.toFixed(0)}% of range
                </p>
              </div>
              <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">{formatNumber(detail.week52Low, 0)}</span>
                <span className="font-medium text-foreground tabular-nums">
                  Now {formatNumber(detail.current, 0)}
                </span>
                <span className="tabular-nums">{formatNumber(detail.week52High, 0)}</span>
              </div>
              <div className="relative h-3 rounded-full bg-gradient-to-r from-rose-500/25 via-amber-400/30 to-emerald-500/35 ring-1 ring-border/60">
                <div
                  className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-emerald-500 shadow-md ring-2 ring-emerald-500/30"
                  style={{ left: `${pos52}%` }}
                  title={`Current: ${formatNumber(detail.current, 2)}`}
                />
              </div>
              <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                <span>Low</span>
                <span>Current position</span>
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <PriceChart
              key={detail.symbol}
              candles={detail.candles}
              intraday={detail.intraday}
              defaultType="candles"
              defaultRange="3M"
              height={440}
              showVolume
              typeLabels={{ area: "TrendView", candles: "TradingView" }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/10 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums sm:text-base">{value}</p>
    </div>
  );
}
