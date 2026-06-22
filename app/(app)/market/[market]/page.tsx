import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getGlobalMarketData,
  getGlobalMarketMeta,
  type MarketUniverse,
} from "@/lib/services/global-markets";
import { PageHeader } from "@/components/page-header";
import { GlobalMarketBoard } from "@/components/market/global-market-board";
import { DataDelayBadge } from "@/components/status-badges";

export const dynamic = "force-dynamic";

const SUPPORTED = ["us", "india", "world", "commodities", "crypto", "oil"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ market: string }>;
}): Promise<Metadata> {
  const { market } = await params;
  if (!isSupported(market)) return { title: "Market" };
  return { title: getGlobalMarketMeta(market).title };
}

export default async function GlobalMarketPage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await params;
  if (!isSupported(market)) notFound();

  const data = await getGlobalMarketData(market);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={data.title}
        description={data.description}
        actions={<DataDelayBadge />}
      />
      <GlobalMarketBoard data={data} showMap={market === "world"} />
    </div>
  );
}

function isSupported(value: string): value is MarketUniverse {
  return (SUPPORTED as readonly string[]).includes(value);
}
