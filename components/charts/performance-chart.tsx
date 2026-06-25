"use client";

import * as React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PerformanceResult,
  PerfPoint,
  PerfSeries,
} from "@/lib/services/performance";
import { formatDate, formatPercent, plColorClass } from "@/lib/format";

export function PerformanceChart({
  data,
  height = 300,
}: {
  data: PerformanceResult;
  height?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const points = data.points;
  const series = data.series.filter((item) =>
    points.some((point) => numeric(point[item.dailyKey]) != null)
  );

  if (points.length === 0 || series.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No performance data yet
      </div>
    );
  }

  if (!mounted) {
    return (
      <div>
        <div
          className="rounded-xl bg-muted/25"
          style={{ height }}
          aria-hidden
        />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: item.color }}
              />
              {item.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(String(d)).replace(/ \d{4}$/, "")}
            minTickGap={36}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatPercent(Number(v), 0)}
            width={48}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.35} />
          <Tooltip content={<PerfTooltip series={series} />} />
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.dailyKey}
              name={item.name}
              stroke={item.color}
              strokeWidth={item.kind === "benchmark" ? 1.8 : 2.4}
              strokeDasharray={item.kind === "benchmark" ? "5 4" : undefined}
              dot={points.length <= 7 ? { r: 3, strokeWidth: 1.5 } : false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function PerfTooltip({
  active,
  payload,
  label,
  series,
}: {
  active?: boolean;
  payload?: { payload: PerfPoint }[];
  label?: string;
  series: PerfSeries[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-2 font-medium">{formatDate(label)}</p>
      <div className="space-y-1.5">
        {series.map((item) => {
          const dailyValue = numeric(point[item.dailyKey]);
          if (dailyValue == null) return null;
          return (
            <div key={item.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: item.color }}
              />
              <span className="min-w-0 truncate">{item.name}</span>
              <span className={`font-semibold tabular-nums ${plColorClass(dailyValue)}`}>
                {formatPercent(dailyValue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function numeric(value: PerfPoint[string]): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
