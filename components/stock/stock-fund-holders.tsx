"use client";

import { Building2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IconChip } from "@/components/ui/accent";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import { FundIslamicIcon, isIslamicOrShariahName } from "@/components/market/islamic-mark";
import { identifyAmcBrand } from "@/lib/amc-brands";
import type { FundHoldingStock, FundsHoldingStockData } from "@/lib/services/fund-returns";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface AmcGroup {
  amc: string;
  fullName: string;
  shortName: string;
  color: string;
  totalPct: number;
  funds: FundHoldingStock[];
}

function groupByAmc(funds: FundHoldingStock[]): AmcGroup[] {
  const map = new Map<string, AmcGroup>();
  for (const fund of funds) {
    const brand = identifyAmcBrand(fund.amc);
    const existing = map.get(fund.amc);
    if (existing) {
      existing.totalPct += fund.percentage;
      existing.funds.push(fund);
    } else {
      map.set(fund.amc, {
        amc: fund.amc,
        fullName: brand.fullName,
        shortName: brand.shortName,
        color: brand.color,
        totalPct: fund.percentage,
        funds: [fund],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalPct - a.totalPct);
}

export function StockFundHolders({ symbol }: { symbol: string }) {
  const normalized = symbol.toUpperCase();
  const { data, isLoading } = usePersistentResource<FundsHoldingStockData>({
    cacheKey: `public:stock-funds-v3:${normalized}`,
    url: `/api/public/stock-funds/${encodeURIComponent(normalized)}`,
    refreshInterval: 30 * 60_000,
  });

  const pending = isLoading || data == null;
  const funds = data?.funds ?? [];
  const amcGroups = pending ? [] : groupByAmc(funds);
  const periodLabel =
    data?.periodYear && data?.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  let subtitle: string;
  if (pending) {
    subtitle = "Loading…";
  } else if (funds.length === 0) {
    subtitle = "No funds holding this stock yet";
  } else {
    subtitle = `${funds.length} fund${funds.length !== 1 ? "s" : ""} across ${amcGroups.length} AMC${amcGroups.length !== 1 ? "s" : ""}${periodLabel ? ` · ${periodLabel} holdings` : ""}`;
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="funds-section"
      className="overflow-hidden rounded-xl border border-violet-200/60 bg-card dark:border-violet-800/30"
    >
      <AccordionItem value="funds-section" className="border-b-0">
        <AccordionTrigger className="bg-gradient-to-r from-violet-500/10 via-violet-400/6 to-transparent px-5 py-4 hover:from-violet-500/15 hover:no-underline">
          <div className="flex flex-1 items-center gap-3">
            <IconChip accent="violet" variant="gradient"><Building2 /></IconChip>
            <div className="text-left">
              <p className="text-base font-semibold leading-snug">Funds holding {normalized}</p>
              <p className="text-sm font-normal text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="space-y-1.5 px-3 pt-2 pb-3">
          {pending ? (
            <div className="space-y-2 px-1 py-1" aria-busy="true" aria-label="Loading fund holders">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : funds.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              No funds holding this stock yet
            </p>
          ) : (
            <Accordion type="multiple" defaultValue={[]}>
              {amcGroups.map((group) => (
                <AccordionItem
                  key={group.amc}
                  value={group.amc}
                  className="mb-1.5 overflow-hidden rounded-lg border-0 last:mb-0"
                >
                  <AccordionTrigger
                    className="rounded-lg px-3 py-2.5 hover:no-underline hover:brightness-95 dark:hover:brightness-110"
                    style={{
                      borderLeft: `4px solid ${group.color}`,
                      backgroundColor: `${group.color}18`,
                    }}
                  >
                    <div className="flex flex-1 items-center gap-2.5 min-w-0">
                      <AmcBrandMark label={group.amc} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-snug sm:hidden">
                          {group.shortName}
                        </p>
                        <p className="hidden truncate text-sm font-semibold leading-snug sm:block">
                          {group.fullName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.funds.length} fund{group.funds.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span
                        className="mr-1 shrink-0 rounded-md px-2 py-0.5 text-sm font-bold tabular-nums text-white"
                        style={{ backgroundColor: group.color }}
                      >
                        {group.totalPct.toFixed(1)}%
                      </span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="pb-1 pt-1">
                    <div className="pl-2">
                      <div className="grid grid-cols-[1fr_56px] border-b border-border/50 px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <span>Fund</span>
                        <span className="text-right">% Held</span>
                      </div>
                      {group.funds.map((fund) => {
                        const islamic =
                          fund.classFilter === "islamic" || isIslamicOrShariahName(fund.fundName);
                        return (
                        <div
                          key={`${fund.amc}||${fund.fundName}`}
                          className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p className="min-w-0 truncate text-sm text-foreground/80">
                              {fund.fundName}
                            </p>
                            {islamic ? <FundIslamicIcon size="md" /> : null}
                          </div>
                          <p className="text-right text-sm font-semibold tabular-nums">
                            {fund.percentage.toFixed(1)}%
                          </p>
                        </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
