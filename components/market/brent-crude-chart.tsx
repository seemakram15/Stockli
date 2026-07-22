"use client";

import * as React from "react";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { PriceLineChart } from "@/components/charts/price-line-chart";

interface HistoryPoint {
  date: string;
  price: number;
}

export interface BrentCrudeChartHandle {
  refresh(): Promise<void>;
}

export const BrentCrudeChart = React.forwardRef<BrentCrudeChartHandle>(
  function BrentCrudeChart(_, ref) {
    const { data, isLoading, refreshNow } = usePersistentResource<HistoryPoint[]>({
      cacheKey: "public:brent-crude-history-v1",
      url: "/api/public/brent-crude-history",
      refreshInterval: 4 * 60 * 60 * 1000,
    });

    React.useImperativeHandle(ref, () => ({
      refresh: () => refreshNow(),
    }), [refreshNow]);

    if (isLoading && !data) {
      return <div className="h-40 animate-pulse rounded-xl bg-muted/20" />;
    }

    if (!data || data.length === 0) return null;

    return (
      <div className="rounded-xl border border-border bg-muted/10 p-3">
        <PriceLineChart
          data={data}
          color="hsl(199 89% 48%)"
          height={160}
          unit="$"
          label="Brent Crude (BZF) — USD/bbl"
        />
      </div>
    );
  }
);
