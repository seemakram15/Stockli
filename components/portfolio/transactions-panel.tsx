"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { FilterPanel } from "@/components/ui/filter-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionsTable } from "@/components/transactions-table";
import type { Transaction } from "@/lib/types";

type TradeTypeFilter = "ALL" | "BUY" | "SELL";

export function TransactionsPanel({ transactions }: { transactions: Transaction[] }) {
  const [symbol, setSymbol] = React.useState("ALL");
  const [type, setType] = React.useState<TradeTypeFilter>("ALL");

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

  return (
    <div className="space-y-3">
      <div className="px-4 sm:px-2">
        <FilterPanel
          title="Transaction filters"
          summary={`Showing ${filtered.length} of ${transactions.length}`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <Filter className="size-4" />
              <span>
                Showing {filtered.length} of {transactions.length}
              </span>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="w-full sm:w-40">
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
                <SelectTrigger className="w-full sm:w-36">
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
        </FilterPanel>
      </div>
      <TransactionsTable transactions={filtered} />
    </div>
  );
}
