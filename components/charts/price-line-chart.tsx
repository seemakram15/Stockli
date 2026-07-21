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
import { cn } from "@/lib/utils";

interface DataPoint {
  date: string;
  price: number;
}

const DURATIONS = [
  { label: "15D", days: 15 },
  { label: "1M",  days: 30 },
  { label: "2M",  days: 60 },
  { label: "4M",  days: 120 },
  { label: "6M",  days: 180 },
  { label: "1Y",  days: 365 },
  { label: "2Y",  days: 730 },
  { label: "All", days: Infinity },
] as const;

type DurationLabel = (typeof DURATIONS)[number]["label"];

interface PriceLineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  unit?: string;
  label?: string;
  defaultDuration?: DurationLabel;
  formatPrice?: (v: number) => string;
}

export function PriceLineChart({
  data,
  color = "hsl(var(--primary))",
  height = 160,
  unit = "",
  label,
  defaultDuration = "1Y",
  formatPrice = (v) => v.toFixed(2),
}: PriceLineChartProps) {
  const [mounted, setMounted] = React.useState(false);
  const [duration, setDuration] = React.useState<DurationLabel>(defaultDuration);

  React.useEffect(() => { setMounted(true); }, []);

  const filtered = React.useMemo(() => {
    const days = DURATIONS.find((d) => d.label === duration)?.days ?? Infinity;
    if (!Number.isFinite(days)) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days as number));
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return data.filter((d) => d.date >= cutoffStr);
  }, [data, duration]);

  const gradId = `grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  const prices = filtered.map((d) => d.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 1;
  const padding = (max - min) * 0.08 || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {label && <p className="text-xs font-semibold text-muted-foreground">{label}</p>}
        <div className={cn("flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5", !label && "ml-auto")}>
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDuration(d.label)}
              className={cn(
                "rounded-md px-1.5 py-1 text-[10px] font-semibold transition-colors",
                duration === d.label
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {!mounted || filtered.length === 0 ? (
        <div className="animate-pulse rounded-xl bg-muted/20" style={{ height }} />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={filtered} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={fmtAxisDate}
              minTickGap={50}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[min - padding, max + padding]}
              tickFormatter={(v) => formatPrice(v)}
              width={52}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as DataPoint;
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-foreground">{fmtTooltipDate(pt.date)}</p>
                    <p className="text-muted-foreground">{unit}{formatPrice(pt.price)}</p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function fmtAxisDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short", year: "2-digit", timeZone: "UTC",
  });
}

function fmtTooltipDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}
