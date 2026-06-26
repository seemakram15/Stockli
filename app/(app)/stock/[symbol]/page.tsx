import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedStockPage } from "@/components/stock/cached-stock-page";
import { normalizeSymbol } from "@/lib/security/validation";
import { getSessionUser } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol: rawSymbol } = await params;
  return { title: normalizeSymbol(rawSymbol) ?? "Stock" };
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

  return <CachedStockPage symbol={symbol} userId={user?.id ?? "anonymous"} />;
}
