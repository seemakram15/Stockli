"use client";

import { usePrices } from "@/lib/hooks/use-prices";
import { ChangeBadge } from "@/components/change-badge";
import { effectiveQuotePrice } from "@/lib/services/metrics";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote } from "@/lib/types";

/** Large live price + change for the stock header. Polls every ~30s. */
export function LiveQuote({
  symbol,
  initial,
  size = "lg",
}: {
  symbol: string;
  initial?: Quote | null;
  size?: "lg" | "sm";
}) {
  const { quotes } = usePrices([symbol], initial ? [initial] : undefined);
  const q = quotes.get(symbol.toUpperCase()) ?? initial ?? null;
  const price = effectiveQuotePrice(q);

  return (
    <div className="flex items-baseline gap-3">
      <span
        className={cn(
          "font-semibold tabular-nums",
          size === "lg" ? "text-3xl" : "text-xl"
        )}
      >
        {price != null ? formatPKR(price) : "—"}
      </span>
      <ChangeBadge value={q?.change} pct={q?.changePct} showValue variant="pill" />
    </div>
  );
}
