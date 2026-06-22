"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keyboard shortcut: ⌘K / Ctrl-K
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(0);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  function go(symbol: string) {
    setOpen(false);
    router.push(`/stock/${symbol}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].symbol);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 min-w-0 flex-1 justify-start gap-2 px-2 text-muted-foreground sm:w-64 sm:flex-none sm:px-3",
            className
          )}
        >
          <Search className="size-4" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">Search stocks…</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium sm:inline">
            ⌘K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(92vw,28rem)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search by symbol or company…"
            className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
          />
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin p-1">
          {query.trim() && !loading && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for “{query}”.
            </p>
          )}
          {results.map((r, i) => (
            <button
              key={r.symbol}
              onClick={() => go(r.symbol)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
            >
              <span className="flex size-7 items-center justify-center rounded bg-muted text-muted-foreground">
                <TrendingUp className="size-3.5" />
              </span>
              <span className="flex-1 overflow-hidden">
                <span className="font-medium">{r.symbol}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.company}
                </span>
              </span>
              {r.sector && (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {r.sector}
                </span>
              )}
            </button>
          ))}
          {!query.trim() && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search ~460 PSX listings.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
