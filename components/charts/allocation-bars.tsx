import { formatPKRCompact, formatPercent } from "@/lib/format";
import type { AllocationSlice } from "@/lib/types";

export function AllocationBars({
  data,
  maxItems = 8,
}: {
  data: AllocationSlice[];
  maxItems?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No allocation data
      </div>
    );
  }

  const shown = data.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {shown.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <span className="min-w-0 flex-1 truncate font-medium" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground sm:text-right">
              {formatPKRCompact(item.value)} · {formatPercent(item.pct).replace("+", "")}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2"
              style={{ width: `${Math.max(3, Math.min(100, item.pct))}%` }}
            />
          </div>
        </div>
      ))}
      {data.length > shown.length && (
        <p className="pt-1 text-xs text-muted-foreground">
          Showing top {shown.length} of {data.length}. Expand for the full holdings table.
        </p>
      )}
    </div>
  );
}
