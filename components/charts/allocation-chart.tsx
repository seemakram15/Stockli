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

export function AllocationChart({ data }: { data: AllocationSlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No allocation data
      </div>
    );
  }

  // Collapse a long tail into "Other" so the donut stays legible.
  const top = data.slice(0, 6);
  const rest = data.slice(6);
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
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
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
