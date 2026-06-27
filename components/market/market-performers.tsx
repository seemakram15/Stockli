import type * as React from "react";
import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChangeBadge } from "@/components/change-badge";
import { formatCompact, formatPKR } from "@/lib/format";
import type { MarketPerformer, MarketPerformers as MarketPerformersData } from "@/lib/services/market";

export function MarketPerformers({
  data,
  showHeader = true,
}: {
  data: MarketPerformersData;
  showHeader?: boolean;
}) {
  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle>Market Performers</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex snap-x gap-5 overflow-x-auto pb-2 scrollbar-thin lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
          <PerformerTable
            title="Top Active Stocks"
            icon={<Activity className="size-4 text-primary" />}
            rows={data.active}
          />
          <PerformerTable
            title="Top Advancers"
            icon={<ArrowUpRight className="size-4 text-gain" />}
            rows={data.advancers}
          />
          <PerformerTable
            title="Top Decliners"
            icon={<ArrowDownRight className="size-4 text-loss" />}
            rows={data.decliners}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PerformerTable({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: MarketPerformer[];
}) {
  return (
    <div className="min-w-[calc(100vw-5rem)] snap-start rounded-xl border border-border lg:min-w-0">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-2 p-3 sm:hidden">
        {rows.map((row) => (
          <Link
            key={row.symbol}
            href={`/stock/${row.symbol}`}
            className="block rounded-lg border border-border/70 bg-card px-3 py-2 hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.symbol}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vol {formatCompact(row.volume)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums">{formatPKR(row.price)}</p>
                <ChangeBadge value={row.change} pct={row.changePct} showValue className="justify-end text-xs" />
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="hidden overflow-x-auto scrollbar-thin sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.symbol} className="group">
                <TableCell>
                  <Link href={`/stock/${row.symbol}`} className="font-semibold group-hover:text-primary">
                    {row.symbol}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPKR(row.price)}</TableCell>
                <TableCell className="text-right">
                  <ChangeBadge value={row.change} pct={row.changePct} showValue className="justify-end" />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCompact(row.volume)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
