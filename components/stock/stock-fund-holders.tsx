"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/accent";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { identifyAmcBrand } from "@/lib/amc-brands";
import { cn } from "@/lib/utils";
import type { FundsHoldingStockData } from "@/lib/services/fund-returns";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function StockFundHolders({ symbol }: { symbol: string }) {
  const normalized = symbol.toUpperCase();
  const { data } = usePersistentResource<FundsHoldingStockData>({
    cacheKey: `public:stock-funds:${normalized}`,
    url: `/api/public/stock-funds/${encodeURIComponent(normalized)}`,
    refreshInterval: 30 * 60_000,
  });

  if (!data || data.funds.length === 0) return null;

  const periodLabel =
    data.periodYear && data.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";
  const maxPct = Math.max(...data.funds.map((f) => f.percentage), 1);

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <IconChip accent="violet"><Building2 /></IconChip>
          <div>
            <CardTitle>Funds holding {normalized}</CardTitle>
            <CardDescription>
              {data.funds.length} mutual fund{data.funds.length !== 1 ? "s" : ""} disclose a position
              {periodLabel ? ` · ${periodLabel} holdings` : ""}, ranked by weight.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {data.funds.map((fund, index) => {
            const brand = identifyAmcBrand(fund.amc);
            return (
              <div
                key={`${fund.amc}||${fund.fundName}`}
                className="grid grid-cols-[1.75rem_1fr_4.5rem] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40"
              >
                <span className="text-center text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{fund.fundName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: brand.color }}
                    />
                    <span className="truncate text-xs text-muted-foreground">{fund.amcShort}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {fund.percentage.toFixed(1)}%
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full")}
                      style={{
                        width: `${Math.max(4, (fund.percentage / maxPct) * 100)}%`,
                        backgroundColor: brand.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
