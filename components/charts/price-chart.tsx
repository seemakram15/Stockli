"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { Candle, SeriesPoint } from "@/lib/types";

type ChartType = "candles" | "area";
type Range = "1D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGES: Range[] = ["1D", "1M", "3M", "6M", "1Y", "ALL"];
const RANGE_DAYS: Record<Exclude<Range, "1D">, number> = {
  "1M": 22,
  "3M": 66,
  "6M": 132,
  "1Y": 252,
  ALL: Infinity,
};

function palette(dark: boolean) {
  return dark
    ? {
        up: "#34d8a0",
        down: "#ff6f6f",
        text: "#cfd6e2",
        grid: "rgba(255,255,255,0.05)",
        border: "rgba(255,255,255,0.10)",
        areaTop: "rgba(52,216,160,0.30)",
        areaBottom: "rgba(52,216,160,0.0)",
        line: "#34d8a0",
      }
    : {
        up: "#0f9d6b",
        down: "#d64545",
        text: "#46506180",
        grid: "rgba(0,0,0,0.05)",
        border: "rgba(0,0,0,0.10)",
        areaTop: "rgba(15,157,107,0.25)",
        areaBottom: "rgba(15,157,107,0.0)",
        line: "#0f9d6b",
      };
}

export function PriceChart({
  candles,
  intraday,
  className,
  height = 380,
  defaultType = "candles",
  hideTypeToggle = false,
  defaultRange = "3M",
}: {
  candles: Candle[];
  intraday?: SeriesPoint[];
  className?: string;
  height?: number;
  defaultType?: ChartType;
  hideTypeToggle?: boolean;
  defaultRange?: Range;
}) {
  const { resolvedTheme } = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [type, setType] = React.useState<ChartType>(defaultType);
  const [range, setRange] = React.useState<Range>(defaultRange);
  const [mounted, setMounted] = React.useState(false);

  const hasIntraday = (intraday?.length ?? 0) > 1;
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!mounted || !containerRef.current) return;
    const el = containerRef.current;
    const dark = resolvedTheme !== "light";
    const c = palette(dark);
    const intradayView = range === "1D" && hasIntraday;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const lwc = await import("lightweight-charts");
      if (disposed) return;
      const chart = lwc.createChart(el, {
        autoSize: true,
        layout: {
          background: { type: lwc.ColorType.Solid, color: "transparent" },
          textColor: c.text,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          attributionLogo: true, // satisfies TradingView attribution requirement
        },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        rightPriceScale: { borderColor: c.border },
        timeScale: { borderColor: c.border, timeVisible: intradayView },
        crosshair: { mode: lwc.CrosshairMode.Normal },
      });

      if (intradayView) {
        const series = chart.addSeries(lwc.AreaSeries, {
          lineColor: c.line,
          topColor: c.areaTop,
          bottomColor: c.areaBottom,
          lineWidth: 2,
        });
        series.setData(intraday!.map((p) => ({ time: p.time as never, value: p.value })));
      } else {
        const days = RANGE_DAYS[range as Exclude<Range, "1D">] ?? Infinity;
        const sliced = candles.length <= days ? candles : candles.slice(-days);
        if (type === "candles") {
          const series = chart.addSeries(lwc.CandlestickSeries, {
            upColor: c.up,
            downColor: c.down,
            borderUpColor: c.up,
            borderDownColor: c.down,
            wickUpColor: c.up,
            wickDownColor: c.down,
          });
          series.setData(
            sliced.map((d) => ({
              time: d.time as never,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            }))
          );
        } else {
          const series = chart.addSeries(lwc.AreaSeries, {
            lineColor: c.line,
            topColor: c.areaTop,
            bottomColor: c.areaBottom,
            lineWidth: 2,
          });
          series.setData(sliced.map((d) => ({ time: d.time as never, value: d.close })));
        }
      }

      chart.timeScale().fitContent();
      cleanup = () => chart.remove();
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [mounted, resolvedTheme, type, range, candles, intraday, hasIntraday]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {hideTypeToggle ? (
          <span />
        ) : (
          <div className="inline-flex w-fit rounded-lg border border-border p-0.5">
            {(["candles", "area"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                disabled={range === "1D"}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40",
                  type === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="flex max-w-full overflow-x-auto rounded-lg border border-border p-0.5 scrollbar-thin">
          {RANGES.map((r) => {
            if (r === "1D" && !hasIntraday) return null;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <div ref={containerRef} style={{ height }} className="min-h-64 w-full" />
    </div>
  );
}
