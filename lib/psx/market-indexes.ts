export const MARKET_SECTOR_INDEXES = [
  { symbol: "KSE100", label: "KSE100" },
  { symbol: "KMI30", label: "KMI30" },
  { symbol: "KSE30", label: "KSE30" },
  { symbol: "ALLSHR", label: "ALLSHARE" },
] as const;

const MARKET_SECTOR_INDEX_SYMBOLS = new Set(MARKET_SECTOR_INDEXES.map((item) => item.symbol));

export type MarketSectorIndexSymbol = (typeof MARKET_SECTOR_INDEXES)[number]["symbol"];

export function normalizeMarketSectorIndex(value?: string | null): MarketSectorIndexSymbol | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "ALLSHARE") return "ALLSHR";
  return MARKET_SECTOR_INDEX_SYMBOLS.has(normalized as MarketSectorIndexSymbol)
    ? (normalized as MarketSectorIndexSymbol)
    : null;
}

export function getMarketSectorIndexLabel(symbol: string) {
  return (
    MARKET_SECTOR_INDEXES.find((item) => item.symbol === symbol.toUpperCase())?.label ??
    symbol.toUpperCase()
  );
}
