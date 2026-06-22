"use client";

import * as React from "react";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
}: {
  cards: IndexCard[];
  initialDetail: IndexDetail;
}) {
  const [selected, setSelected] = React.useState(initialDetail.symbol);
  const [detail, setDetail] = React.useState<IndexDetail>(initialDetail);
  const [loading, setLoading] = React.useState(false);
  const cache = React.useRef<Record<string, IndexDetail>>({ [initialDetail.symbol]: initialDetail });

  async function select(symbol: string) {
    if (symbol === selected) return;
    setSelected(symbol);
    if (cache.current[symbol]) {
      setDetail(cache.current[symbol]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/index/${symbol}`);
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

  return (
    <div className="space-y-4">
      {/* Index cards */}
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1">
        {cards.map((idx) => {
          const isActive = idx.symbol === selected;
          return (
            <button
              key={idx.symbol}
              onClick={() => select(idx.symbol)}
              className={cn(
                "flex min-w-44 shrink-0 items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left transition-colors sm:min-w-52 sm:p-4",
                isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{idx.symbol}</p>
                <p className="tabular-nums text-lg font-semibold">{formatNumber(idx.current, 0)}</p>
                <ChangeBadge pct={idx.changePct} className="text-xs" />
              </div>
              <Sparkline data={idx.spark} className="shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Selected index detail: stats + price chart */}
      <Card className={cn("transition-opacity", loading && "opacity-60")}>
        <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              {loading ? <Loader2 className="size-5 animate-spin" /> : <Activity className="size-5" />}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-xl">{detail.symbol}</CardTitle>
              <p className="truncate text-sm text-muted-foreground">{detail.name}</p>
            </div>
          </div>
          <DataDelayBadge />
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left: value, returns, stats */}
            <div className="space-y-5 lg:col-span-2">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-bold tabular-nums">{formatNumber(detail.current, 2)}</span>
                <span className={cn("pb-1 text-sm font-medium tabular-nums", plColorClass(detail.change))}>
                  {detail.change >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(detail.change), 2)} ({formatPercent(detail.changePct)})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {RETURN_LABELS.map(({ key, label }) => {
                  const v = detail.returns[key];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-lg border border-border px-2 py-2 text-center",
                        v > 0 ? "bg-gain/5" : v < 0 ? "bg-loss/5" : ""
                      )}
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={cn("text-sm font-semibold tabular-nums", plColorClass(v))}>
                        {formatPercent(v)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Stat label="Day High" value={formatNumber(detail.high, 2)} />
                <Stat label="Day Low" value={formatNumber(detail.low, 2)} />
                <Stat label="52W High" value={formatNumber(detail.week52High, 0)} />
                <Stat label="52W Low" value={formatNumber(detail.week52Low, 0)} />
                <Stat label="Prev Close" value={formatNumber(detail.prevClose, 2)} />
                <Stat label="Volume" value={formatCompact(detail.volume)} />
              </div>
            </div>

            {/* Right: price chart (replaces the old sector panel) */}
            <div className="lg:col-span-3">
              <PriceChart
                key={detail.symbol}
                candles={detail.candles}
                intraday={detail.intraday}
                defaultType="area"
                hideTypeToggle
                defaultRange={detail.intraday.length > 1 ? "1D" : "3M"}
                height={300}
              />
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
