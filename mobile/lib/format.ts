const CURRENCY_SYMBOL = "Rs";

export function formatPKR(
  value: number | null | undefined,
  opts: { decimals?: number; sign?: boolean } = {}
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const { decimals = 2, sign = false } = opts;
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = value < 0 ? "−" : sign ? "+" : "";
  return `${prefix}${CURRENCY_SYMBOL} ${formatted}`;
}

export function formatPKRCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const prefix = value < 0 ? "−" : "";
  const compact = abs.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
  return `${prefix}${CURRENCY_SYMBOL} ${compact}`;
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSigned(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export function formatMarketPrice(
  value: number | null | undefined,
  currency?: string | null
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const decimals = Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 10 ? 2 : 4;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function plColor(value: number | null | undefined, theme: { gain: string; loss: string; muted: string }) {
  if (value == null || Number.isNaN(value)) return theme.muted;
  if (value > 0) return theme.gain;
  if (value < 0) return theme.loss;
  return theme.muted;
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
