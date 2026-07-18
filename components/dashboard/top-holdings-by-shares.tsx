"use client";

import { CandlestickChart } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatPKR } from "@/lib/format";
import type { HoldingWithMetrics } from "@/lib/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function TopHoldingsByShares({ holdings }: { holdings: HoldingWithMetrics[] }) {
  const rows = aggregateHoldings(holdings).slice(0, 8);
  const maxValue = Math.max(...rows.map((row) => row.value), 0);
  if (rows.length === 0 || maxValue <= 0) return null;

  const chart = {
    width: 760,
    height: 280,
    left: 80,
    right: 24,
    top: 26,
    bottom: 58,
  };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const chartBottom = chart.top + plotHeight;
  const niceMax = niceCeil(maxValue);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => niceMax * ratio);
  const step = plotWidth / rows.length;
  const candleWidth = Math.max(26, Math.min(44, step * 0.42));

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="top-holdings"
      className="rounded-xl border border-border bg-muted/10 px-4"
    >
      <AccordionItem value="top-holdings" className="border-b-0">
        <AccordionTrigger className="py-3">
          <span className="flex flex-1 items-center gap-2">
            <CandlestickChart className="size-4 text-primary" />
            <span className="font-semibold">Top holdings by value</span>
            <span className="ml-auto text-xs font-normal text-muted-foreground">Top 8</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pt-1 pb-4">
          <MobileHoldingsBars rows={rows} maxValue={maxValue} />
          <div className="hidden rounded-xl border border-border bg-background/70 p-2 sm:block">
        <svg
          role="img"
          aria-label="Top holdings by market value bar chart"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="h-auto w-full"
        >
          <line
            x1={chart.left}
            x2={chart.left}
            y1={chart.top}
            y2={chartBottom}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1={chart.left}
            x2={chart.width - chart.right}
            y1={chartBottom}
            y2={chartBottom}
            stroke="var(--border)"
            strokeWidth="1"
          />

          {ticks.map((tick) => {
            const y = chartBottom - (tick / niceMax) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={chart.left}
                  x2={chart.width - chart.right}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 5"
                  strokeOpacity="0.8"
                />
                <text
                  x={chart.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {compactPKR(tick)}
                </text>
              </g>
            );
          })}

          {rows.map((row, index) => {
            const x = chart.left + step * index + step / 2;
            const valueY = chartBottom - (row.value / niceMax) * plotHeight;
            const bodyHeight = Math.max(18, chartBottom - valueY);
            const bodyTop = chartBottom - bodyHeight;
            const wickTop = Math.max(chart.top + 4, bodyTop - 14);
            const wickBottom = Math.min(chartBottom + 8, chartBottom + 10);
            const color = COLORS[index % COLORS.length];
            return (
              <g key={row.symbol}>
                <line
                  x1={x}
                  x2={x}
                  y1={wickTop}
                  y2={wickBottom}
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  rx="5"
                  fill={color}
                  opacity="0.92"
                />
                <line
                  x1={x - candleWidth * 0.33}
                  x2={x + candleWidth * 0.33}
                  y1={Math.min(chartBottom - 5, bodyTop + 8)}
                  y2={Math.min(chartBottom - 5, bodyTop + 8)}
                  stroke="var(--card)"
                  strokeOpacity="0.55"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <text
                  x={x}
                  y={Math.max(chart.top + 12, wickTop - 8)}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-semibold tabular-nums"
                >
                  {compactPKR(row.value)}
                </text>
                <text
                  x={x}
                  y={chart.height - 24}
                  textAnchor="middle"
                  className="fill-foreground text-[12px] font-semibold"
                >
                  {row.symbol}
                </text>
              </g>
            );
          })}
          <text
            x={chart.left}
            y={chart.height - 6}
            className="fill-muted-foreground text-[10px]"
          >
            Market value (Rs.) across all portfolios
          </text>
        </svg>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function MobileHoldingsBars({
  rows,
  maxValue,
}: {
  rows: { symbol: string; value: number }[];
  maxValue: number;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/70 p-3 sm:hidden">
      {rows.map((row, index) => {
        const width = `${Math.max(12, (row.value / maxValue) * 100)}%`;
        const color = COLORS[index % COLORS.length];
        return (
          <div key={row.symbol} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold">{row.symbol}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatPKR(row.value)}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-lg border border-border bg-muted/30">
              <div
                className="flex h-full min-w-12 items-center justify-end rounded-md pr-2 text-[11px] font-semibold text-white shadow-sm"
                style={{ width, background: color }}
              >
                {compactPKR(row.value)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function aggregateHoldings(holdings: HoldingWithMetrics[]) {
  const bySymbol = new Map<string, number>();
  for (const holding of holdings) {
    const symbol = holding.symbol.toUpperCase();
    bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + holding.marketValue);
  }
  return Array.from(bySymbol.entries())
    .map(([symbol, value]) => ({ symbol, value }))
    .sort((a, b) => b.value - a.value);
}

function niceCeil(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function compactPKR(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${Math.round(value)}`;
}
