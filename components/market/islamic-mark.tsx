"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const MOSQUE_SRC = "/icons/mosque-color.png";

/** True when a fund name is Islamic / Shariah-branded. */
export function isIslamicOrShariahName(value: string | null | undefined) {
  return /islamic|shariah|sharia|alhamra|al\s*ameen|meezan/i.test(value ?? "");
}

export function IslamicMark({
  className,
  size = "sm",
  title = "Islamic / Shariah",
}: {
  className?: string;
  size?: "xs" | "sm" | "md";
  title?: string;
}) {
  const dimension = size === "xs" ? "size-3.5" : size === "md" ? "size-5" : "size-4";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MOSQUE_SRC}
      alt=""
      title={title}
      aria-hidden
      className={cn(
        "inline-block shrink-0 bg-transparent object-contain",
        dimension,
        className
      )}
    />
  );
}

export function IslamicTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
        className
      )}
    >
      <IslamicMark size="xs" title="Islamic" />
      Islamic
    </span>
  );
}

/** Loads KMI All Share symbols once — used to mark Shariah-compliant stocks. */
export function useShariahSymbols() {
  const [symbols, setSymbols] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/index/KMIALLSHR", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        const rows = (data?.constituents ?? data?.stocks ?? []) as Array<{
          symbol?: string;
          ticker?: string;
        }>;
        const next = new Set<string>();
        for (const row of rows) {
          const sym = (row.symbol ?? row.ticker ?? "").toUpperCase().trim();
          if (sym) next.add(sym);
        }
        if (!cancelled && next.size > 0) setSymbols(next);
      } catch {
        // Best-effort — leave empty if index data is unavailable.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return symbols;
}

export function isShariahSymbol(symbol: string | null | undefined, shariah: Set<string>) {
  if (!symbol || shariah.size === 0) return false;
  return shariah.has(symbol.toUpperCase().trim());
}
