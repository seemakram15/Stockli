export function cleanMarketDisplaySymbol(symbol: string) {
  const trimmed = symbol.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .replace(/^\^+/, "")
    .replace(/=F$/i, "F")
    .replace(/\.[A-Z]{1,4}$/i, "")
    .replace(/[.=]/g, "");
}

export function getMarketDisplaySymbol(
  symbol: string,
  displaySymbol?: string | null
) {
  const provided = displaySymbol?.trim();
  return provided && provided.length
    ? cleanMarketDisplaySymbol(provided)
    : cleanMarketDisplaySymbol(symbol);
}
