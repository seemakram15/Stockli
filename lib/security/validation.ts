const SYMBOL_RE = /^[A-Z0-9.&-]{1,20}$/;

export function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const symbol = value.trim().toUpperCase();
  return SYMBOL_RE.test(symbol) ? symbol : null;
}

export function normalizeSymbols(values: unknown[], limit = 40): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const symbol = normalizeSymbol(value);
    if (symbol) seen.add(symbol);
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}

export function sanitizeSearchQuery(value: unknown, maxLength = 40): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 .&-]/g, "")
    .slice(0, maxLength);
}

export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
