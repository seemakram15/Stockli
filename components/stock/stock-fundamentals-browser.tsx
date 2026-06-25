"use client";

import * as React from "react";
import { ChevronDown, Database, FileText, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";
import { StockFinancialsPanel } from "./stock-financials-panel";
import { StockLogo } from "./stock-logo";

type FundamentalsCompanyOption = {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  image: string | null;
};

type CompaniesPayload = {
  companies: FundamentalsCompanyOption[];
};

export function StockFundamentalsBrowser() {
  const [query, setQuery] = React.useState("");
  const [selectedSymbol, setSelectedSymbol] = React.useState<string | null>(null);
  const [finderOpen, setFinderOpen] = React.useState(true);
  const { data, error, isLoading, isRefreshing } = usePersistentResource<CompaniesPayload>({
    cacheKey: "public:stock-fundamentals:companies:v1",
    url: "/api/public/stock-fundamentals/companies",
    refreshInterval: 24 * 60 * 60 * 1000,
  });

  const companies = React.useMemo(() => data?.companies ?? [], [data?.companies]);
  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return companies.slice(0, 80);
    return companies
      .filter((company) =>
        `${company.symbol} ${company.name} ${company.sector}`.toLowerCase().includes(term)
      )
      .slice(0, 120);
  }, [companies, query]);

  const selected = companies.find((company) => company.symbol === selectedSymbol) ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/10 via-background to-background p-4 shadow-sm sm:p-5">
        <h1 className="text-3xl font-bold tracking-tight">Fundamentals & Comparison</h1>
        <p className="mt-1 max-w-5xl text-muted-foreground">
          Search any company, then review overview, latest results, statements, cash flows,
          ratios and peer comparisons from our cached records.
        </p>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-background shadow-sm">
        <CardHeader className="gap-0 border-b bg-primary/5 px-0 py-0">
          <button
            type="button"
            onClick={() => setFinderOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-primary/10 sm:px-5"
            aria-expanded={finderOpen}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <SlidersHorizontal className="size-5" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-lg">Find a stock</CardTitle>
                <CardDescription>Search by ticker, company name, or sector.</CardDescription>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              {selected ? (
                <span className="hidden rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                  {selected.symbol}
                </span>
              ) : null}
              {isRefreshing ? (
                <span className="hidden items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  Refreshing list
                </span>
              ) : null}
              <span className="hidden rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-primary shadow-sm sm:inline-flex">
                {finderOpen ? "Hide finder" : "Show finder"}
              </span>
              <ChevronDown
                className={cn(
                  "size-5 text-primary transition-transform",
                  finderOpen && "rotate-180"
                )}
              />
            </span>
          </button>
        </CardHeader>
        {finderOpen ? (
          <CardContent className="space-y-4 px-4 py-4 sm:px-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search stock name or symbol..."
                className="h-11 pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-primary" />
                Loading stock list...
              </div>
            ) : error ? (
              <EmptyState
                icon={<Database className="size-6" />}
                title="Stock list unavailable"
                description={error.message}
                className="border-solid"
              />
            ) : filtered.length ? (
              <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((company) => {
                  const active = (selected?.symbol ?? selectedSymbol) === company.symbol;
                  return (
                    <button
                      key={`${company.id}-${company.symbol}`}
                      type="button"
                      onClick={() => {
                        setSelectedSymbol(company.symbol);
                        setFinderOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5",
                        active && "border-primary bg-primary/10"
                      )}
                    >
                      <StockLogo
                        symbol={company.symbol}
                        name={company.name}
                        image={company.image}
                        size="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{company.symbol}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {company.name}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {company.sector}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Search className="size-6" />}
                title="No matching stocks"
                description="Try a ticker like FFC, LUCK, MEBL, or a company name."
                className="border-solid"
              />
            )}
          </CardContent>
        ) : null}
      </Card>

      {selected ? (
        <StockFinancialsPanel symbol={selected.symbol} companyName={selected.name} />
      ) : (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="Select a stock"
          description="Choose a company above to load its full fundamentals record."
          className="border-solid"
        />
      )}
    </div>
  );
}
