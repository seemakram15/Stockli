"use client";

import Image from "next/image";
import * as React from "react";
import { Database, FileText, Loader2, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";
import { StockFinancialsPanel } from "./stock-financials-panel";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Fundamentals & Comparisons</h1>
        <p className="text-muted-foreground">
          Search any company, then review overview, latest results, statements, cash flows,
          ratios and peer comparisons from our cached records.
        </p>
      </div>

      <Card className="bg-background shadow-sm">
        <CardHeader className="gap-1 border-b px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Find a stock</CardTitle>
              <CardDescription>Search by ticker, company name, or sector.</CardDescription>
            </div>
            {isRefreshing ? (
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Refreshing list
              </span>
            ) : null}
          </div>
        </CardHeader>
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
                    onClick={() => setSelectedSymbol(company.symbol)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5",
                      active && "border-primary bg-primary/10"
                    )}
                  >
                    <CompanyAvatar company={company} />
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

function CompanyAvatar({ company }: { company: FundamentalsCompanyOption }) {
  const [failed, setFailed] = React.useState(false);

  if (company.image && !failed) {
    return (
      <Image
        src={company.image}
        alt=""
        width={42}
        height={42}
        unoptimized
        className="size-10 shrink-0 rounded-xl border bg-background object-contain p-1"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-sm font-bold text-primary">
      {company.symbol.slice(0, 2)}
    </span>
  );
}
