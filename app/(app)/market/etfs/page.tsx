import type { Metadata } from "next";
import { Layers3 } from "lucide-react";
import { getMufapFunds } from "@/lib/services/mufap";
import { PageHeader } from "@/components/page-header";
import { MufapFundsBoard } from "@/components/market/mufap-funds-board";
import { DataDelayBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Exchange Traded Funds" };
export const dynamic = "force-dynamic";

export default async function ExchangeTradedFundsPage() {
  const data = await getMufapFunds({ includeEtfs: true });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Layers3 className="size-7 text-primary" />
            Exchange Traded Funds
          </span>
        }
        description="MUFAP ETF NAVs, returns, AMC filters and Rs 100,000 performance view."
        actions={<DataDelayBadge />}
      />
      <MufapFundsBoard data={data} title="MUFAP exchange traded funds" etfMode />
    </div>
  );
}
