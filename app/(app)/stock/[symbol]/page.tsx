import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { CachedStockPage } from "@/components/stock/cached-stock-page";
import { normalizeSymbol } from "@/lib/security/validation";
import { getSessionUser } from "@/lib/services/portfolio";
import { SEED_TICKERS } from "@/lib/psx/symbols";
import { breadcrumbJsonLd, buildPageMetadata, stockPageJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol) ?? "Stock";
  const company = SEED_TICKERS.find((t) => t.symbol === symbol)?.company;
  const title = company ? `${symbol} share price — ${company}` : `${symbol} share price`;
  const description = company
    ? `Live ${symbol} (${company}) PSX share price, charts, fundamentals and portfolio tools on Stockli.`
    : `Live ${symbol} PSX share price, charts, fundamentals and portfolio tools on Stockli.`;

  return buildPageMetadata({
    title,
    description,
    path: `/stock/${symbol}`,
    keywords: [
      symbol,
      `${symbol} share price`,
      `${symbol} PSX`,
      `${symbol} stock`,
      company ?? "Pakistan stock exchange",
      "PSX live price",
      "Stockli",
    ],
  });
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: symbolRaw } = await params;
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) notFound();
  const user = await getSessionUser();
  const company = SEED_TICKERS.find((t) => t.symbol === symbol)?.company;
  const description = company
    ? `Live ${symbol} (${company}) PSX share price, charts and fundamentals on Stockli.`
    : `Live ${symbol} PSX share price, charts and fundamentals on Stockli.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      stockPageJsonLd({ symbol, company, description }),
      breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Market", path: "/market" },
        { name: symbol, path: `/stock/${symbol}` },
      ]),
    ],
  };

  return (
    <>
      <Script
        id={`stockli-stock-${symbol}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CachedStockPage symbol={symbol} userId={user?.id ?? "anonymous"} />
    </>
  );
}
