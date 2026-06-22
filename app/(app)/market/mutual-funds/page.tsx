import type { Metadata } from "next";
import { BadgePercent } from "lucide-react";
import { getMufapFunds } from "@/lib/services/mufap";
import { PageHeader } from "@/components/page-header";
import { MufapFundsBoard } from "@/components/market/mufap-funds-board";
import { DataDelayBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Mutual Funds" };
export const dynamic = "force-dynamic";

export default async function MutualFundsPage() {
  const data = await getMufapFunds();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <BadgePercent className="size-7 text-primary" />
            Mutual Funds
          </span>
        }
        description="MUFAP daily NAV, returns, AMC filters and Rs 100,000 performance view."
        actions={<DataDelayBadge />}
      />
      <MufapFundsBoard data={data} title="MUFAP mutual funds" />
    </div>
  );
}
