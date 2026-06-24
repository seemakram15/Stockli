import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getGlobalMarketMeta,
  type MarketUniverse,
} from "@/lib/services/global-markets";
import { CachedGlobalMarketPage } from "@/components/public-data/cached-global-market-page";

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
  const meta = getGlobalMarketMeta(market);

  return <CachedGlobalMarketPage market={market} title={meta.title} description={meta.description} />;
}

function isSupported(value: string): value is MarketUniverse {
  return (SUPPORTED as readonly string[]).includes(value);
}
