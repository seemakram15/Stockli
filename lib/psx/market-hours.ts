import {
  PSX_TIMEZONE,
  PSX_MARKET_OPEN,
  PSX_MARKET_CLOSE,
  PSX_TRADING_DAYS,
} from "@/lib/constants";

/**
 * Market-hours / holiday awareness for PSX (Pakistan Standard Time, UTC+5,
 * no DST). Used to pause scraping when the market is closed and to show a
 * "market closed / last updated" state.
 *
 * Holidays are announced in advance by the Exchange — extend this list each
 * year (YYYY-MM-DD in PKT).
 */
export const PSX_HOLIDAYS_2026: string[] = [
  "2026-02-05", // Kashmir Day
  "2026-03-23", // Pakistan Day
  "2026-05-01", // Labour Day
  "2026-08-14", // Independence Day
  "2026-12-25", // Quaid-e-Azam Day / Christmas
  // Religious holidays (Eid etc.) are moon-dependent — add when announced.
];

interface PktParts {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0 = Sunday
  hour: number;
  minute: number;
}

/** Decompose a Date into Pakistan-local parts without external tz libs. */
function pktParts(date: Date): PktParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PSX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // hour12:false can yield "24"
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    weekday: weekdayMap[get("weekday")] ?? 0,
    hour,
    minute: parseInt(get("minute"), 10),
  };
}

function pktDateString(p: PktParts): string {
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

export function isHoliday(date: Date = new Date()): boolean {
  return PSX_HOLIDAYS_2026.includes(pktDateString(pktParts(date)));
}

export function isTradingDay(date: Date = new Date()): boolean {
  const p = pktParts(date);
  return PSX_TRADING_DAYS.includes(p.weekday) && !isHoliday(date);
}

/** True when PSX is currently in a trading session. */
export function isMarketOpen(date: Date = new Date()): boolean {
  if (!isTradingDay(date)) return false;
  const p = pktParts(date);
  const mins = p.hour * 60 + p.minute;
  const open = PSX_MARKET_OPEN.hour * 60 + PSX_MARKET_OPEN.minute;
  const close = PSX_MARKET_CLOSE.hour * 60 + PSX_MARKET_CLOSE.minute;
  return mins >= open && mins <= close;
}

export type MarketStatus = "open" | "closed" | "pre-open" | "weekend" | "holiday";

export function marketStatus(date: Date = new Date()): {
  status: MarketStatus;
  label: string;
} {
  const p = pktParts(date);
  if (isHoliday(date)) return { status: "holiday", label: "Closed — holiday" };
  if (!PSX_TRADING_DAYS.includes(p.weekday))
    return { status: "weekend", label: "Closed — weekend" };

  const mins = p.hour * 60 + p.minute;
  const open = PSX_MARKET_OPEN.hour * 60 + PSX_MARKET_OPEN.minute;
  const close = PSX_MARKET_CLOSE.hour * 60 + PSX_MARKET_CLOSE.minute;

  if (mins < open) return { status: "pre-open", label: "Pre-open" };
  if (mins > close) return { status: "closed", label: "Closed" };
  return { status: "open", label: "Market open" };
}
