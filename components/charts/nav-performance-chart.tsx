"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MufapNavPoint } from "@/lib/services/mufap";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Range = "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";
const RANGES: Range[] = ["1M", "3M", "6M", "YTD", "1Y", "ALL"];
const RANGE_LABEL: Record<Range, string> = {
  "1M": "1m",
  "3M": "3m",
  "6M": "6m",
  YTD: "YTD",
  "1Y": "1y",
  ALL: "All",
};

export function NavPerformanceChart({
  history,
  height = 320,
}: {
  history: MufapNavPoint[];
  height?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [range, setRange] = React.useState<Range>("1Y");

  React.useEffect(() => setMounted(true), []);

  const points = React.useMemo(() => filterRange(history, range), [history, range]);

  if (history.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No NAV history available
      </div>
    );
  }

  if (!mounted) {
    return <div className="rounded-xl bg-muted/10" style={{ height }} />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              range === r
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(String(d)).replace(/ \d{4}$/, "")}
            minTickGap={48}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatNumber(Number(v), 0)}
            width={52}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<NavTooltip />} />
          <Area
            type="monotone"
            dataKey="nav"
            stroke="var(--chart-1)"
            strokeWidth={2.2}
            fill="url(#navGradient)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function NavTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: MufapNavPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{formatDate(point.date)}</p>
      <p className="tabular-nums text-muted-foreground">NAV {formatNumber(point.nav, 4)}</p>
    </div>
  );
}

function filterRange(history: MufapNavPoint[], range: Range): MufapNavPoint[] {
  if (range === "ALL") return history;
  const last = history[history.length - 1];
  if (!last) return history;
  const end = new Date(last.date);
  const start = new Date(end);
  if (range === "YTD") {
    start.setMonth(0, 1);
  } else {
    const monthsBack: Record<"1M" | "3M" | "6M" | "1Y", number> = {
      "1M": 1,
      "3M": 3,
      "6M": 6,
      "1Y": 12,
    };
    start.setMonth(start.getMonth() - monthsBack[range]);
  }
  return history.filter((p) => new Date(p.date) >= start);
}
