"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

/**
 * Symbol input with live suggestions from /api/search. Writes the chosen
 * symbol into a hidden field named by `name` so it submits with the form.
 */
export function SymbolField({
  name = "symbol",
  defaultValue = "",
  required,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = React.useState(defaultValue.toUpperCase());
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const q = value.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        /* aborted */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <Input
        value={value}
        required={required}
        autoComplete="off"
        placeholder="e.g. OGDC"
        onChange={(e) => {
          setValue(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto scrollbar-thin rounded-lg border border-border bg-popover p-1 shadow-md">
          {results.map((r) => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => {
                setValue(r.symbol);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
              )}
            >
              <span className="font-medium">{r.symbol}</span>
              <span className="max-w-44 truncate text-xs text-muted-foreground">
                {r.company}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
