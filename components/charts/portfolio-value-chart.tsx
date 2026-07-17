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
import { formatDate, formatPKR, formatPKRCompact, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PortfolioValuePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

type Range = "5D" | "15D" | "1M" | "3M" | "6M" | "1Y" | "ALL";
const RANGES: Range[] = ["5D", "15D", "1M", "3M", "6M", "1Y", "ALL"];

export function PortfolioValueChart({
  days,
  height = 280,
}: {
  days: PortfolioValuePoint[];
  height?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [range, setRange] = React.useState<Range>("3M");
  React.useEffect(() => setMounted(true), []);

  const points = React.useMemo(() => filterRange(days, range), [days, range]);
  const first = points[0];
  const last = points[points.length - 1];
  const periodChange = first && last ? last.close - first.close : 0;
  const periodChangePct = first && first.close ? (periodChange / first.close) * 100 : 0;
  const positive = periodChange >= 0;

  if (days.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Not enough history yet to chart portfolio value.
      </div>
    );
  }

  if (!mounted) {
    return <div className="rounded-xl bg-muted/10" style={{ height }} />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className={cn("text-sm font-semibold tabular-nums", plColorClass(periodChange))}>
          {formatPKR(periodChange, { sign: true })}
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({periodChangePct >= 0 ? "+" : ""}
            {periodChangePct.toFixed(2)}% over {RANGE_LABEL[range]})
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
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
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioValueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={positive ? "var(--gain)" : "var(--loss)"}
                stopOpacity={0.32}
              />
              <stop
                offset="100%"
                stopColor={positive ? "var(--gain)" : "var(--loss)"}
                stopOpacity={0}
              />
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
            tickFormatter={(v) => formatPKRCompact(Number(v))}
            width={64}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip content={<ValueTooltip />} />
          <Area
            type="monotone"
            dataKey="close"
            stroke={positive ? "var(--gain)" : "var(--loss)"}
            strokeWidth={2.2}
            fill="url(#portfolioValueGradient)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const RANGE_LABEL: Record<Range, string> = {
  "5D": "5d",
  "15D": "15d",
  "1M": "1m",
  "3M": "3m",
  "6M": "6m",
  "1Y": "1y",
  ALL: "All",
};

function ValueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PortfolioValuePoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{formatDate(point.date)}</p>
      <p className="tabular-nums text-muted-foreground">{formatPKR(point.close)}</p>
    </div>
  );
}

function filterRange(days: PortfolioValuePoint[], range: Range): PortfolioValuePoint[] {
  if (range === "ALL") return days;
  if (range === "5D" || range === "15D") {
    const count = range === "5D" ? 5 : 15;
    return days.slice(-count);
  }
  const last = days[days.length - 1];
  if (!last) return days;
  const end = new Date(last.date);
  const start = new Date(end);
  const monthsBack: Record<"1M" | "3M" | "6M" | "1Y", number> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
  };
  start.setMonth(start.getMonth() - monthsBack[range]);
  return days.filter((d) => new Date(d.date) >= start);
}
