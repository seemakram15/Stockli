import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getGlobalIndexConstituents,
  getGlobalIndexTitle,
} from "@/lib/services/global-index-constituents";
import { Layers } from "lucide-react";
import { type MarketUniverse } from "@/lib/services/global-markets";
import { GlobalIndexConstituentsTable } from "@/components/market/global-index-constituents-table";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const SUPPORTED = ["us", "india", "world", "commodities", "crypto", "oil"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ market: string; symbol: string }>;
}): Promise<Metadata> {
  const { market, symbol } = await params;
  const decoded = decodeURIComponent(symbol);
  if (!isSupported(market)) {
    return buildPageMetadata({
      title: "Index constituents",
      description: "Global index constituents and component weights on Stockli.",
      path: `/market/${market}/index/${encodeURIComponent(decoded)}`,
      index: false,
    });
  }
  const title = getGlobalIndexTitle(decoded);
  return buildPageMetadata({
    title,
    description: `${title} constituents, weights and component performance tracked on Stockli.`,
    path: `/market/${market}/index/${encodeURIComponent(decoded)}`,
    keywords: [title, decoded, `${market} index constituents`],
  });
}

export default async function GlobalIndexConstituentsPage({
  params,
}: {
  params: Promise<{ market: string; symbol: string }>;
}) {
  const { market, symbol } = await params;
  if (!isSupported(market)) notFound();

  const data = await getGlobalIndexConstituents(market, decodeURIComponent(symbol));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref={`/market/${market}`} label="Back to market" />
      <PageHeader
        icon={<Layers />}
        eyebrow="Index constituents"
        accent="sky"
        title={data.title}
        description={`${data.description} · ${data.symbol}`}
      />
      <GlobalIndexConstituentsTable data={data} />
    </div>
  );
}

function isSupported(value: string): value is MarketUniverse {
  return (SUPPORTED as readonly string[]).includes(value);
}
