"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SectorPerformance } from "@/lib/services/market";

interface RingSlice {
  name: string;
  shortName: string;
  value: number;
  changePct: number;
  kind: "sector" | "stock";
  sector?: string;
}

export function SectorPerformancePanel({ data }: { data: SectorPerformance[] }) {
  const sectors = [...data].sort((a, b) => b.volume - a.volume);
  const inner: RingSlice[] = sectors.map((sector) => ({
    name: sector.sector,
    shortName: compactName(sector.sector),
    value: Math.max(1, sector.volume || sector.count),
    changePct: sector.avgChangePct,
    kind: "sector",
  }));

  const outer: RingSlice[] = sectors.flatMap((sector) =>
    sector.stocks
      .sort((a, b) => b.volume - a.volume)
      .map((stock) => ({
        name: stock.symbol,
        shortName: stock.symbol,
        value: Math.max(1, stock.volume),
        changePct: stock.changePct,
        kind: "stock" as const,
        sector: sector.sector,
      }))
  );

  const totalCount = data.reduce((sum, sector) => sum + sector.count, 0);
  const marketMove = totalCount
    ? data.reduce((sum, sector) => sum + sector.avgChangePct * sector.count, 0) / totalCount
    : 0;
  const sideList = [...data].sort((a, b) => Math.abs(b.avgChangePct) - Math.abs(a.avgChangePct)).slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sector Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="min-h-[420px] rounded-xl bg-muted/10 p-2 lg:col-span-3">
            <ResponsiveContainer width="100%" height={420}>
              <PieChart>
                <Pie
                  data={inner}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="30%"
                  outerRadius="56%"
                  paddingAngle={0.4}
                  stroke="var(--card)"
                  strokeWidth={1}
                  labelLine={false}
                  label={renderSectorLabel}
                >
                  {inner.map((slice) => (
                    <Cell key={slice.name} fill={moveColor(slice.changePct)} fillOpacity={moveOpacity(slice.changePct, 0.55)} />
                  ))}
                </Pie>
                <Pie
                  data={outer}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="56%"
                  outerRadius="86%"
                  paddingAngle={0.2}
                  stroke="var(--card)"
                  strokeWidth={0.7}
                  labelLine={false}
                  label={renderStockLabel}
                >
                  {outer.map((slice, i) => (
                    <Cell key={`${slice.sector}-${slice.name}-${i}`} fill={moveColor(slice.changePct)} fillOpacity={moveOpacity(slice.changePct, 0.65)} />
                  ))}
                </Pie>
                <Tooltip content={<SectorTooltip />} />
                <text
                  x="50%"
                  y="48%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-xl font-bold"
                >
                  PSX
                </text>
                <text
                  x="50%"
                  y="55%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn("fill-current text-sm font-semibold", plColorClass(marketMove))}
                >
                  {formatPercent(marketMove)}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 lg:col-span-2">
            {sideList.map((sector) => (
              <div key={sector.sector} className="rounded-lg border border-border bg-muted/15 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{sector.sector}</p>
                  <p className={cn("shrink-0 text-sm font-semibold tabular-nums", plColorClass(sector.avgChangePct))}>
                    {formatPercent(sector.avgChangePct)}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{sector.count} stocks</span>
                  <span>
                    <span className="text-gain">{sector.advancers}</span> up
                  </span>
                  <span>
                    <span className="text-loss">{sector.decliners}</span> down
                  </span>
                  <span>Vol {formatCompact(sector.volume)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function renderSectorLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  payload?: RingSlice;
}) {
  if (!props.payload || (props.percent ?? 0) < 0.045) return null;
  return renderRadialLabel(props, props.payload.shortName, "text-[11px] font-semibold");
}

function renderStockLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  payload?: RingSlice;
}) {
  if (!props.payload || (props.percent ?? 0) < 0.022) return null;
  return renderRadialLabel(props, props.payload.shortName, "text-[10px] font-bold");
}

function renderRadialLabel(
  props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
  },
  label: string,
  className: string
) {
  const cx = props.cx ?? 0;
  const cy = props.cy ?? 0;
  const midAngle = props.midAngle ?? 0;
  const radius = ((props.innerRadius ?? 0) + (props.outerRadius ?? 0)) / 2;
  const rad = (-midAngle * Math.PI) / 180;
  const x = cx + radius * Math.cos(rad);
  const y = cy + radius * Math.sin(rad);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      className={cn("fill-white drop-shadow-sm", className)}
    >
      {label}
    </text>
  );
}

function SectorTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RingSlice }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{item.name}</p>
      {item.sector && <p className="text-xs text-muted-foreground">{item.sector}</p>}
      <p className={cn("tabular-nums", plColorClass(item.changePct))}>
        {formatPercent(item.changePct)}
      </p>
      <p className="text-xs text-muted-foreground">Vol {formatCompact(item.value)}</p>
    </div>
  );
}

function moveColor(changePct: number): string {
  if (changePct > 0) return "var(--gain)";
  if (changePct < 0) return "var(--loss)";
  return "var(--muted)";
}

function moveOpacity(changePct: number, base: number): number {
  return Math.min(0.98, base + Math.min(0.32, Math.abs(changePct) / 18));
}

function compactName(name: string): string {
  if (name.length <= 16) return name.toUpperCase();
  return `${name.slice(0, 13).toUpperCase()}...`;
}
