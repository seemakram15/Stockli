import useSWR from "swr";
import { api } from "@/lib/api";

const BASE = process.env.EXPO_PUBLIC_SITE_URL ?? "";

async function fetchPrices(symbols: string[]) {
  if (symbols.length === 0) return [];
  const qs = symbols.join(",");
  const res = await fetch(`${BASE}/api/prices?symbols=${encodeURIComponent(qs)}`, {
    headers: { "User-Agent": "StockliApp/1.0 (Mobile; React-Native)" },
  });
  if (!res.ok) return [];
  const json = await res.json() as { quotes: unknown[] };
  return json.quotes;
}

export function usePublicMarket() {
  return useSWR("public-market", () => api.market.public(), {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function usePrices(symbols: string[]) {
  const key = symbols.length > 0 ? `prices:${symbols.sort().join(",")}` : null;
  return useSWR(key, () => fetchPrices(symbols), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}

export function useSearch(query: string) {
  const key = query.trim().length >= 2 ? `search:${query}` : null;
  return useSWR(key, () => api.market.search(query), {
    revalidateOnFocus: false,
    dedupingInterval: 500,
  });
}
