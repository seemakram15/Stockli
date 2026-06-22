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

export function MarketPerformers({ data }: { data: MarketPerformersData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Performers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-5 lg:grid-cols-3">
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
    <div className="min-w-0 rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        {icon}
        <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
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
