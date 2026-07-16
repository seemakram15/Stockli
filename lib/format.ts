import { CURRENCY_SYMBOL } from "./constants";

/** Format a number as PKR currency, e.g. "Rs 1,23,456.00" (intl grouping). */
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

/** Compact currency, e.g. "Rs 1.2M". */
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

/** Generic compact market currency/price formatter. */
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

/** Plain number with grouping. */
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

/**
 * Compact money flow with an auto-scaled unit and currency suffix.
 * e.g. +12.34M USD · −340.00k USD · +1.20B PKR. Used for FIPI/LIPI flows.
 */
export function formatFlow(
  value: number | null | undefined,
  currency: "USD" | "PKR" = "USD",
  opts: { sign?: boolean; showUnit?: boolean } = {}
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const { sign = true, showUnit = true } = opts;
  const abs = Math.abs(value);
  const prefix = value < 0 ? "−" : sign ? "+" : "";
  let scaled: string;
  if (abs >= 1e9) scaled = `${(abs / 1e9).toFixed(2)}B`;
  else if (abs >= 1e6) scaled = `${(abs / 1e6).toFixed(2)}M`;
  else if (abs >= 1e3) scaled = `${(abs / 1e3).toFixed(2)}k`;
  else scaled = abs.toFixed(0);
  return `${prefix}${scaled}${showUnit ? ` ${currency}` : ""}`;
}

/** Compact plain number, e.g. "1.2M" (good for volume). */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

/** Format a percentage with explicit sign, e.g. "+2.34%". */
export function formatPercent(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

/** Signed number with explicit + / − prefix. */
export function formatSigned(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), decimals)}`;
}

/** Direction of a value: 'up' | 'down' | 'flat'. */
export function direction(value: number | null | undefined): "up" | "down" | "flat" {
  if (value == null || value === 0 || Number.isNaN(value)) return "flat";
  return value > 0 ? "up" : "down";
}

/** Tailwind text-colour class for a P/L value. */
export function plColorClass(value: number | null | undefined): string {
  const d = direction(value);
  if (d === "up") return "text-gain";
  if (d === "down") return "text-loss";
  return "text-muted-foreground";
}

/** Format an ISO date as "22 Jun 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format an ISO timestamp as "22 Jun, 14:35". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Relative time, e.g. "3 min ago". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
