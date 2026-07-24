import type { Metadata } from "next";
import { PieChart } from "lucide-react";
import { getActiveTickers } from "@/lib/services/fund-holdings";
import { PageHeader } from "@/components/page-header";
import { FundHoldingsEditor } from "@/components/admin/fund-holdings-editor";

export const metadata: Metadata = { title: "Edit Funds Holdings" };
export const dynamic = "force-dynamic";

export default async function EditFundsHoldingsPage() {
  const tickers = await getActiveTickers();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        icon={<PieChart />}
        accent="violet"
        eyebrow="Control Panel"
        title="Edit Funds Holdings"
        description="Manually manage mutual fund holdings by period. Published holdings are visible to all users."
      />
      <FundHoldingsEditor tickers={tickers} />
    </div>
  );
}
