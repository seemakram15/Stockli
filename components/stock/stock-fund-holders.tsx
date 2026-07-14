"use client";

import { Building2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { IconChip } from "@/components/ui/accent";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { identifyAmcBrand } from "@/lib/amc-brands";
import type { FundHoldingStock, FundsHoldingStockData } from "@/lib/services/fund-returns";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface AmcGroup {
  amc: string;
  amcShort: string;
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
        amcShort: fund.amcShort,
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
  const { data } = usePersistentResource<FundsHoldingStockData>({
    cacheKey: `public:stock-funds:${normalized}`,
    url: `/api/public/stock-funds/${encodeURIComponent(normalized)}`,
    refreshInterval: 30 * 60_000,
  });

  if (!data || data.funds.length === 0) return null;

  const periodLabel =
    data.periodYear && data.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  const amcGroups = groupByAmc(data.funds);
  const maxPct = Math.max(...data.funds.map((f) => f.percentage), 1);

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="funds-section"
      className="rounded-xl border border-border bg-card"
    >
      <AccordionItem value="funds-section" className="border-b-0">
        <AccordionTrigger className="gap-3 px-5 py-4 hover:no-underline">
          <div className="flex flex-1 items-center gap-3">
            <IconChip accent="violet"><Building2 /></IconChip>
            <div className="text-left">
              <p className="text-base font-semibold leading-snug">Funds holding {normalized}</p>
              <p className="text-sm font-normal text-muted-foreground">
                {data.funds.length} fund{data.funds.length !== 1 ? "s" : ""} across {amcGroups.length} AMC{amcGroups.length !== 1 ? "s" : ""}
                {periodLabel ? ` · ${periodLabel} holdings` : ""}
              </p>
            </div>
          </div>
        </AccordionTrigger>

        <AccordionContent className="px-3 pb-4">
          <Accordion type="multiple" defaultValue={amcGroups.map((g) => g.amc)}>
            {amcGroups.map((group) => (
              <AccordionItem key={group.amc} value={group.amc}>
                <AccordionTrigger className="rounded-lg px-2 py-2.5 hover:bg-muted/40 hover:no-underline">
                  <div className="flex flex-1 items-center gap-2.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="text-sm font-semibold">{group.amcShort}</span>
                    <span className="text-xs text-muted-foreground">
                      {group.funds.length} fund{group.funds.length !== 1 ? "s" : ""}
                    </span>
                    <span className="ml-auto mr-2 text-sm font-semibold tabular-nums">
                      {group.totalPct.toFixed(1)}%
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-1">
                  <div className="space-y-0.5 pl-4">
                    {group.funds.map((fund) => (
                      <div
                        key={`${fund.amc}||${fund.fundName}`}
                        className="grid grid-cols-[1fr_4.5rem] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                      >
                        <p className="min-w-0 truncate text-sm">{fund.fundName}</p>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {fund.percentage.toFixed(1)}%
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(4, (fund.percentage / maxPct) * 100)}%`,
                                backgroundColor: group.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
