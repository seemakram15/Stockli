"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Option {
  symbol: string;
  label: string;
}

export function SectorIndexPicker({
  options,
  selected,
}: {
  options: Option[];
  selected: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [pendingIndex, setPendingIndex] = React.useState<string | null>(null);

  function navigate(symbol: string) {
    if (symbol === selected) return;
    setPending(true);
    setPendingIndex(symbol);
    router.push(`/market/sectors?index=${symbol}`);
  }

  React.useEffect(() => {
    setPending(false);
    setPendingIndex(null);
  }, [selected]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.symbol === selected;
        const loading = pendingIndex === option.symbol;
        return (
          <button
            key={option.symbol}
            type="button"
            onClick={() => navigate(option.symbol)}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
              active
                ? "border-transparent bg-gradient-to-r from-teal-500 to-cyan-400 text-white shadow-sm shadow-teal-500/25"
                : "border-border bg-background hover:border-teal-500/40 hover:bg-muted/40",
              pending && !active && "opacity-60"
            )}
          >
            {loading && (
              <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
