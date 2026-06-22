"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AllocationSlice } from "@/lib/types";
import { formatPKRCompact, formatPercent } from "@/lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface AllocationChartProps {
  data: AllocationSlice[];
  maxSlices?: number;
  showSliceLabels?: boolean;
}

export function AllocationChart({
  data,
  maxSlices = 6,
  showSliceLabels = false,
}: AllocationChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No allocation data
      </div>
    );
  }

  // Collapse a long tail into "Other" so the donut stays legible.
  const top = data.slice(0, maxSlices);
  const rest = data.slice(maxSlices);
  const slices =
    rest.length > 0
      ? [
          ...top,
          {
            label: "Other",
            value: rest.reduce((a, b) => a + b.value, 0),
            pct: rest.reduce((a, b) => a + b.pct, 0),
          },
        ]
      : top;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-56 w-full min-w-0 sm:h-52 sm:w-52 sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="42%"
              outerRadius="76%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              label={showSliceLabels ? renderSliceLabel : false}
              labelLine={false}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<AllocationTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {formatPercent(s.pct).replace("+", "")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderSliceLabel(props: {
  cx?: number | string;
  cy?: number | string;
  midAngle?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  payload?: AllocationSlice;
  percent?: number;
}) {
  const { cx, cy, midAngle, innerRadius, outerRadius, payload, percent } = props;
  if (cx == null || cy == null || midAngle == null || !payload) return null;
  const pct = (percent ?? payload.pct / 100) * 100;
  if (pct < 3) return null;
  const inner = Number(innerRadius) || 0;
  const outer = Number(outerRadius) || 0;
  const radius = inner + (outer - inner) * 0.52;
  const radian = (Math.PI / 180) * -midAngle;
  const x = Number(cx) + radius * Math.cos(radian);
  const y = Number(cy) + radius * Math.sin(radian);
  const text = payload.label.length > 8 ? payload.label.slice(0, 8) : payload.label;

  return (
    <text
      x={x}
      y={y}
      fill="var(--card)"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[10px] font-bold drop-shadow-sm"
    >
      {text}
    </text>
  );
}

function AllocationTooltip({ active, payload }: { active?: boolean; payload?: { payload: AllocationSlice }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="tabular-nums text-muted-foreground">
        {formatPKRCompact(d.value)} · {formatPercent(d.pct).replace("+", "")}
      </p>
    </div>
  );
}
