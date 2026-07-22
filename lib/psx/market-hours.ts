import { PSX_TIMEZONE, PSX_TRADING_DAYS } from "@/lib/constants";

/**
 * PSX market-hours / holiday awareness.
 *
 * Source checked from the official PSX Trading Hours page on 24 Jun 2026:
 * - Mon-Thu regular market pre-open 09:15-09:32, open 09:32-15:30 PKT.
 * - Friday regular market pre-open/open runs in two sessions:
 *   09:00-09:17 / 09:17-12:00 and 14:15-14:32 / 14:32-16:30 PKT.
 *
 * The cache helpers below let the app keep PSX screens fast after close: serve
 * the latest known quote/cache while the exchange is closed, then resume normal
 * short polling from pre-open onward.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const OPEN_CACHE_TTL_SECONDS = 60;
const CLOSED_MAX_STALE_SECONDS = 7 * DAY;
const REFRESH_WINDOW_BUFFER_SECONDS = 5 * MINUTE;
/** PSX HTML feed lags ~10 min; keep refreshing past official close to catch the final print. */
const POST_CLOSE_SETTLEMENT_MINUTES = 20;

export const PSX_HOLIDAYS_2026: string[] = [
  "2026-02-05", // Kashmir Day
  "2026-03-20", // Juma-Tul-Wida
  "2026-03-21", // Eid-ul-Fitr
  "2026-03-22", // Eid-ul-Fitr
  "2026-03-23", // Eid-ul-Fitr / Pakistan Day
  "2026-05-01", // Labour Day
  "2026-05-26", // Eid-ul-Azha
  "2026-05-27", // Eid-ul-Azha
  "2026-05-28", // Eid-ul-Azha / Youm-e-Takbeer
  "2026-06-25", // Ashura
  "2026-06-26", // Ashura
  "2026-08-14", // Independence Day
  "2026-08-25", // Eid Milad-un-Nabi (SAW)
  "2026-11-09", // Allama Iqbal Day
  "2026-12-25", // Quaid-e-Azam Day / Christmas
];

interface PktParts {
  year: number;
  month: number;
  day: number;
  weekday: number; // 0 = Sunday
  hour: number;
  minute: number;
}

interface MarketSession {
  kind: "pre-open" | "open";
  start: number;
  end: number;
}

export type MarketStatus = "open" | "closed" | "pre-open" | "weekend" | "holiday";

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
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
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
  if (hour === 24) hour = 0;
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    weekday: weekdayMap[get("weekday")] ?? 0,
    hour,
    minute: parseInt(get("minute"), 10),
  };
}

function pktDateString(parts: PktParts): string {
  const mm = String(parts.month).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  return `${parts.year}-${mm}-${dd}`;
}

export function psxLocalDateString(date: Date = new Date()): string {
  return pktDateString(pktParts(date));
}

function minutes(hour: number, minute: number) {
  return hour * 60 + minute;
}

function sessionsForWeekday(weekday: number): MarketSession[] {
  if (weekday === 5) {
    return [
      { kind: "pre-open", start: minutes(9, 0), end: minutes(9, 17) },
      { kind: "open", start: minutes(9, 17), end: minutes(12, 0) },
      { kind: "pre-open", start: minutes(14, 15), end: minutes(14, 32) },
      { kind: "open", start: minutes(14, 32), end: minutes(16, 30) },
    ];
  }

  if (PSX_TRADING_DAYS.includes(weekday)) {
    return [
      { kind: "pre-open", start: minutes(9, 15), end: minutes(9, 32) },
      { kind: "open", start: minutes(9, 32), end: minutes(15, 30) },
    ];
  }

  return [];
}

function pktInstant(parts: Pick<PktParts, "year" | "month" | "day">, minuteOfDay: number) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  // Pakistan is fixed UTC+5 with no DST.
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 5, minute));
}

function addPktDays(parts: PktParts, days: number): PktParts {
  const noonUtc = Date.UTC(parts.year, parts.month - 1, parts.day + days, 12 - 5, 0);
  return pktParts(new Date(noonUtc));
}

function tradingSessionsForDate(parts: PktParts): MarketSession[] {
  if (!PSX_TRADING_DAYS.includes(parts.weekday)) return [];
  if (PSX_HOLIDAYS_2026.includes(pktDateString(parts))) return [];
  return sessionsForWeekday(parts.weekday);
}

export function isHoliday(date: Date = new Date()): boolean {
  return PSX_HOLIDAYS_2026.includes(pktDateString(pktParts(date)));
}

export function isTradingDay(date: Date = new Date()): boolean {
  return tradingSessionsForDate(pktParts(date)).length > 0;
}

export function lastTradingDayInPkt(date: Date = new Date()): string | null {
  let parts = pktParts(date);
  for (let i = 0; i < 14; i++) {
    parts = addPktDays(parts, -1);
    if (tradingSessionsForDate(parts).length > 0) return pktDateString(parts);
  }
  return null;
}

/** True only during regular continuous market trading. */
export function isMarketOpen(date: Date = new Date()): boolean {
  const parts = pktParts(date);
  const mins = parts.hour * 60 + parts.minute;
  return tradingSessionsForDate(parts).some(
    (session) => session.kind === "open" && mins >= session.start && mins <= session.end
  );
}

/**
 * True after the first regular open session has started for this Pakistan-local
 * date. Holidays, weekends, and pre-open periods return false, so calendar
 * overlays do not show a "today" P/L before any trading has actually happened.
 */
export function hasPsxTradingStartedToday(date: Date = new Date()): boolean {
  const parts = pktParts(date);
  const mins = parts.hour * 60 + parts.minute;
  const firstOpen = tradingSessionsForDate(parts).find((session) => session.kind === "open");
  return Boolean(firstOpen && mins >= firstOpen.start);
}

/** True during pre-open or regular open; this is when PSX caches may refresh. */
export function shouldRefreshPsxData(date: Date = new Date()): boolean {
  const parts = pktParts(date);
  const mins = parts.hour * 60 + parts.minute;
  const sessions = tradingSessionsForDate(parts);
  if (sessions.some((session) => mins >= session.start && mins <= session.end)) {
    return true;
  }
  // Delayed DPS feed can keep printing for a while after the bell — without this
  // window we freeze mid-session snapshots (e.g. KSE100 −1277 vs final −1703).
  return sessions
    .filter((session) => session.kind === "open")
    .some(
      (session) =>
        mins > session.end && mins <= session.end + POST_CLOSE_SETTLEMENT_MINUTES
    );
}

/**
 * Identifier for the current trading "cycle" — the Pakistan-local date while a
 * session is live (pre-open onward), otherwise "". Clients compare this against
 * a stored value to detect the moment a new session begins (e.g. 09:15 next
 * trading day) and drop the previous day's frozen device-cache snapshot.
 */
export function psxSessionCycleId(date: Date = new Date()): string {
  if (!shouldRefreshPsxData(date)) return "";
  return pktDateString(pktParts(date));
}

export function marketStatus(date: Date = new Date()): {
  status: MarketStatus;
  label: string;
  nextRefreshAt: string | null;
} {
  const parts = pktParts(date);
  if (isHoliday(date)) {
    return {
      status: "holiday",
      label: "Closed",
      nextRefreshAt: nextPsxRefreshAt(date)?.toISOString() ?? null,
    };
  }
  if (!PSX_TRADING_DAYS.includes(parts.weekday)) {
    return {
      status: "weekend",
      label: "Closed",
      nextRefreshAt: nextPsxRefreshAt(date)?.toISOString() ?? null,
    };
  }

  const mins = parts.hour * 60 + parts.minute;
  for (const session of tradingSessionsForDate(parts)) {
    if (mins >= session.start && mins <= session.end) {
      return {
        status: session.kind,
        label: session.kind === "open" ? "Open" : "Pre-open",
        nextRefreshAt: null,
      };
    }
  }

  return {
    status: "closed",
    label: "Closed",
    nextRefreshAt: nextPsxRefreshAt(date)?.toISOString() ?? null,
  };
}

export function nextPsxRefreshAt(date: Date = new Date()): Date | null {
  const now = date.getTime();
  const today = pktParts(date);

  for (let offset = 0; offset < 14; offset += 1) {
    const day = addPktDays(today, offset);
    for (const session of tradingSessionsForDate(day)) {
      const candidate = pktInstant(day, session.start);
      if (candidate.getTime() >= now - 1_000) return candidate;
    }
  }

  return null;
}

/**
 * Most recent regular-session close observed in Pakistan time. Useful for
 * deciding whether a "frozen while closed" device cache is still current or if
 * it predates the latest completed market session and must be refreshed once.
 */
export function lastCompletedPsxSessionEnd(date: Date = new Date()): Date | null {
  const now = date.getTime();
  const today = pktParts(date);

  for (let offset = 0; offset < 14; offset += 1) {
    const day = addPktDays(today, -offset);
    const sessions = tradingSessionsForDate(day).filter((session) => session.kind === "open");
    for (let index = sessions.length - 1; index >= 0; index -= 1) {
      const candidate = pktInstant(day, sessions[index].end);
      if (candidate.getTime() <= now + 1_000) return candidate;
    }
  }

  return null;
}

export function lastCompletedPsxSessionDate(date: Date = new Date()): string | null {
  const sessionEnd = lastCompletedPsxSessionEnd(date);
  return sessionEnd ? psxLocalDateString(sessionEnd) : null;
}

export function secondsUntilNextPsxRefresh(date: Date = new Date()): number | null {
  const next = nextPsxRefreshAt(date);
  if (!next) return null;
  return Math.max(0, Math.ceil((next.getTime() - date.getTime()) / 1000));
}

export function psxLiveCacheTtlSeconds(date: Date = new Date()): number {
  if (shouldRefreshPsxData(date)) return OPEN_CACHE_TTL_SECONDS;
  const untilNext = secondsUntilNextPsxRefresh(date);
  if (untilNext == null) return CLOSED_MAX_STALE_SECONDS;
  return Math.min(
    CLOSED_MAX_STALE_SECONDS,
    Math.max(5 * MINUTE, untilNext + REFRESH_WINDOW_BUFFER_SECONDS)
  );
}

export function psxClosedMaxStaleSeconds(): number {
  return CLOSED_MAX_STALE_SECONDS;
}
