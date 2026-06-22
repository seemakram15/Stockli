"use client";

import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerfPoint } from "@/lib/services/performance";
import { formatPKR, formatPKRCompact, formatDate } from "@/lib/format";

export function PerformanceChart({
  data,
  showBenchmark = true,
  height = 280,
}: {
  data: PerfPoint[];
  showBenchmark?: boolean;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No performance data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(d).replace(/ \d{4}$/, "")}
          minTickGap={40}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatPKRCompact(v).replace("Rs ", "")}
          width={52}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<PerfTooltip showBenchmark={showBenchmark} />} />
        <Area
          type="monotone"
          dataKey="value"
          name="Portfolio"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#pfFill)"
        />
        {showBenchmark && (
          <Line
            type="monotone"
            dataKey="benchmark"
            name="KSE-100 (rebased)"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function PerfTooltip({
  active,
  payload,
  label,
  showBenchmark,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
  showBenchmark?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const value = payload.find((p) => p.dataKey === "value")?.value;
  const bench = payload.find((p) => p.dataKey === "benchmark")?.value;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{formatDate(label)}</p>
      <p className="flex items-center gap-2">
        <span className="size-2 rounded-sm" style={{ background: "var(--chart-1)" }} />
        Portfolio <span className="ml-auto tabular-nums">{formatPKR(value)}</span>
      </p>
      {showBenchmark && bench != null && (
        <p className="flex items-center gap-2">
          <span className="size-2 rounded-sm" style={{ background: "var(--chart-2)" }} />
          KSE-100 <span className="ml-auto tabular-nums">{formatPKR(bench)}</span>
        </p>
      )}
    </div>
  );
}
