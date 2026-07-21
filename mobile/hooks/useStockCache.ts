import AsyncStorage from "@react-native-async-storage/async-storage";
import useSWR from "swr";

const BASE = process.env.EXPO_PUBLIC_SITE_URL ?? "";
const STORAGE_KEY = "@stockli:stocks:v2";
const MOBILE_UA = "StockliApp/1.0 (Mobile; React-Native)";
const STALE_MS = 60 * 60 * 1000;

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  current?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  pivot?: number;
  r1?: number; s1?: number; r2?: number; s2?: number; r3?: number; s3?: number;
}

async function loadStocks(): Promise<StockInfo[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const { stocks, t } = JSON.parse(raw);
      if (Date.now() - t < STALE_MS) return stocks;
    }
  } catch {}
  const res = await fetch(`${BASE}/api/public/pivot-points`, {
    headers: { "User-Agent": MOBILE_UA },
  });
  const json = await res.json();
  const rows: any[] = json?.data?.rows ?? [];
  const stocks: StockInfo[] = rows.map((r: any) => ({
    symbol: r.symbol,
    name: r.companyName ?? r.symbol,
    sector: r.sector ?? "",
    current: r.current,
    high: r.high,
    low: r.low,
    previousClose: r.previousClose,
    pivot: r.pivot,
    r1: r.r1, s1: r.s1, r2: r.r2, s2: r.s2, r3: r.r3, s3: r.s3,
  }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ stocks, t: Date.now() }));
  return stocks;
}

export function useStockCache() {
  const { data: stocks = [], isLoading } = useSWR<StockInfo[]>(
    "stock-cache",
    loadStocks,
    { revalidateOnFocus: false }
  );
  return { stocks, isLoading };
}
