"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionsTable } from "@/components/transactions-table";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

type TradeTypeFilter = "ALL" | "BUY" | "SELL";

export function TransactionsPanel({
  transactions,
  currentPriceBySymbol,
}: {
  transactions: Transaction[];
  currentPriceBySymbol?: Record<string, number | null>;
}) {
  const [symbol, setSymbol] = React.useState("ALL");
  const [type, setType] = React.useState<TradeTypeFilter>("ALL");
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const symbols = React.useMemo(
    () => Array.from(new Set(transactions.map((t) => t.symbol))).sort(),
    [transactions]
  );

  const filtered = React.useMemo(
    () =>
      transactions.filter((t) => {
        const symbolMatch = symbol === "ALL" || t.symbol === symbol;
        const typeMatch = type === "ALL" || t.type === type;
        return symbolMatch && typeMatch;
      }),
    [transactions, symbol, type]
  );

  const activeFilters = (symbol !== "ALL" ? 1 : 0) + (type !== "ALL" ? 1 : 0);

  const countLabel = (
    <>
      Showing{" "}
      <span className="tabular-nums text-foreground">{filtered.length}</span>
      {" of "}
      <span className="tabular-nums text-foreground">{transactions.length}</span>
      {activeFilters ? (
        <span className="text-muted-foreground">
          {" "}
          · {activeFilters} active
        </span>
      ) : null}
    </>
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="px-3 sm:px-4 lg:px-5">
        {/* Mobile: compact disclose */}
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2 py-1.5 text-left text-sm sm:hidden"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((v) => !v)}
        >
          <Filter className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {countLabel}
          </span>
          <span
            className={cn(
              "text-xs text-muted-foreground transition-transform",
              mobileFiltersOpen && "rotate-180"
            )}
          >
            ▾
          </span>
        </button>

        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
            mobileFiltersOpen ? "flex" : "hidden sm:flex"
          )}
        >
          <p className="hidden text-sm text-muted-foreground sm:block">
            {countLabel}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger
                size="sm"
                className="w-full shadow-none sm:w-40"
                aria-label="Filter by holding"
              >
                <SelectValue placeholder="Holding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All holdings</SelectItem>
                {symbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={type} onValueChange={(v) => setType(v as TradeTypeFilter)}>
              <SelectTrigger
                size="sm"
                className="w-full shadow-none sm:w-36"
                aria-label="Filter by trade type"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All trades</SelectItem>
                <SelectItem value="BUY">Buy</SelectItem>
                <SelectItem value="SELL">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <TransactionsTable
        transactions={filtered}
        showBuyPL={Boolean(currentPriceBySymbol)}
        currentPriceBySymbol={currentPriceBySymbol}
      />
    </div>
  );
}
