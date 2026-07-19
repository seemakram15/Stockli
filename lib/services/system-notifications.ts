import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMarketOpen,
  marketStatus,
  shouldRefreshPsxData,
} from "@/lib/psx/market-hours";
import {
  getGlobalMarketData,
  type GlobalMarketData,
  type GlobalMarketQuote,
} from "@/lib/services/global-markets";
import { getIndexCards } from "@/lib/services/market";
import { getMarketRows, marketWatchRowToQuote } from "@/lib/services/prices";
import { sendPushToAll, sendPushToUser } from "@/lib/services/push-notifications";
import type { NotificationType, Quote } from "@/lib/types";

interface CreateNotificationInput {
  userId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  symbol?: string | null;
  href?: string | null;
  eventKey?: string;
  eventPayload?: Record<string, unknown>;
}

interface WarmupNotificationOptions {
  admin: SupabaseClient;
  now: Date;
  quotes: Map<string, Quote>;
  triggerUserId?: string | null;
  psxRefreshError?: string | null;
}

/** Minimum absolute day move (%) for a watched stock to notify its watcher. */
const WATCHLIST_MOVE_THRESHOLD_PCT = 3;

export async function createNotification(admin: SupabaseClient, input: CreateNotificationInput) {
  if (input.eventKey) {
    const { error } = await admin.from("notification_events").insert({
      key: input.eventKey,
      type: input.type,
      payload: input.eventPayload ?? {},
    });
    if (error) {
      if (error.code === "23505") return { created: false, reason: "duplicate-event" };
      throw error;
    }
  }

  const { error } = await admin.from("notifications").insert({
    user_id: input.userId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    symbol: input.symbol ?? null,
    href: input.href ?? null,
  });
  if (error) throw error;

  const payload = {
    title: input.title,
    body: input.body,
    url: input.href ?? (input.symbol ? `/stock/${input.symbol}` : "/dashboard"),
    tag: input.eventKey,
    type: input.type,
    symbol: input.symbol,
  };

  if (input.userId) {
    await sendPushToUser(admin, input.userId, payload);
  } else {
    await sendPushToAll(admin, payload);
  }

  return { created: true };
}

export async function runSystemNotificationJobs({
  admin,
  now,
  quotes,
  triggerUserId,
  psxRefreshError,
}: WarmupNotificationOptions) {
  const results: Record<string, unknown> = {};

  // Market status + feed issues always run first — these are time-critical.
  try { results.marketSituation = await createMarketSituationNotification(admin, now); }
  catch (e) { results.marketSituation = String(e); }

  if (psxRefreshError) {
    try { results.marketFeed = await createFeedIssueNotification(admin, now, psxRefreshError); }
    catch (e) { results.marketFeed = String(e); }
  }

  // Analytics jobs (KSE-100, portfolio, watchlist, macro) are skipped in the first 30 min
  // after session open so the market-open notification arrives alone. They catch up on the
  // next cron tick (15 min later). Jobs run sequentially so push notifications reach the
  // user a few seconds apart rather than all at once.
  if (minutesSinceSessionOpen(now) < 30) return results;

  try { results.kse100 = await createKse100ChangeNotification(admin, now); }
  catch (e) { results.kse100 = String(e); }

  try { results.watchlistMoves = await createWatchlistMoveNotifications(admin, now, quotes, triggerUserId); }
  catch (e) { results.watchlistMoves = String(e); }

  try { results.portfolioPulse = await createPortfolioPulseNotifications(admin, now, quotes, triggerUserId); }
  catch (e) { results.portfolioPulse = String(e); }

  try { results.globalMacro = await createGlobalMacroNotifications(admin); }
  catch (e) { results.globalMacro = String(e); }

  return results;
}

function minutesSinceSessionOpen(now: Date): number {
  const { weekday, hour, minute } = pktParts(now);
  const total = hour * 60 + minute;
  if (weekday === 5) {
    if (total >= 14 * 60 + 32) return total - (14 * 60 + 32);
    if (total >= 9 * 60 + 17) return total - (9 * 60 + 17);
    return Infinity;
  }
  if (total >= 9 * 60 + 32) return total - (9 * 60 + 32);
  return Infinity;
}

async function createMarketSituationNotification(admin: SupabaseClient, now: Date) {
  const status = marketStatus(now);
  const date = pktDate(now);
  const keyStatus = status.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const betweenSessions = status.label.toLowerCase().includes("between sessions");
  const title = betweenSessions
    ? "PSX is on its mid-session break"
    : ({
        open: "PSX is live right now",
        "pre-open": "PSX pre-open has started",
        closed: "PSX is closed for now",
        weekend: "PSX is closed for the weekend",
        holiday: "PSX is closed for the holiday",
      }[status.status] ?? "PSX market update");

  const body = betweenSessions
    ? `The current session has paused for the break. ${describeNextTradingWindow(status.nextRefreshAt)}`
    : status.status === "open"
      ? "Live prices, portfolio moves, and alerts are updating during the trading session."
      : status.status === "pre-open"
        ? `Pre-open is underway. ${describeCurrentRegularOpen(now)}`
        : `${status.label}. ${describeNextTradingWindow(status.nextRefreshAt)}`;

  return createNotification(admin, {
    type: "MARKET",
    title,
    body,
    href: "/market",
    eventKey: `market-situation:${date}:${status.status}:${keyStatus}`,
    eventPayload: status,
  });
}

async function createFeedIssueNotification(admin: SupabaseClient, now: Date, message: string) {
  if (!shouldRefreshPsxData(now)) return null;
  const { hour } = pktParts(now);
  return createNotification(admin, {
    type: "MARKET",
    title: "Live PSX prices are delayed",
    body:
      "We are still showing the latest available market snapshot while the live PSX feed reconnects in the background.",
    href: "/market",
    eventKey: `market-feed-issue:${pktDate(now)}:${hour}`,
    eventPayload: { message: message.slice(0, 500) },
  });
}

async function createKse100ChangeNotification(admin: SupabaseClient, now: Date) {
  if (!shouldRefreshPsxData(now)) return null;

  const cards = await getIndexCards();
  const kse100 = cards.find((card) => card.symbol === "KSE100");
  if (!kse100 || Math.abs(kse100.changePct) < 0.5) return null;

  const bucket = twoHourBucket(now);
  const direction = kse100.change >= 0 ? "up" : "down";
  return createNotification(admin, {
    type: "MARKET",
    title: `KSE-100 is ${direction} ${formatPct(Math.abs(kse100.changePct))} today`,
    body: `Pakistan's benchmark index is ${direction} ${formatSignedNumber(kse100.change)} points and is trading near ${formatNumber(kse100.current)}.`,
    symbol: "KSE100",
    href: "/market",
    eventKey: `kse100-change:${pktDate(now)}:${bucket}:${direction}`,
    eventPayload: {
      current: kse100.current,
      change: kse100.change,
      changePct: kse100.changePct,
    },
  });
}

async function createPortfolioPulseNotifications(
  admin: SupabaseClient,
  now: Date,
  quotes: Map<string, Quote>,
  triggerUserId?: string | null
) {
  if (!isMarketOpen(now)) return null;

  let quoteMap = quotes;
  if (quoteMap.size === 0) {
    const rows = await getMarketRows();
    quoteMap = new Map(rows.map((row) => [row.symbol.toUpperCase(), marketWatchRowToQuote(row)]));
  }

  let portfoliosQuery = admin.from("portfolios").select("id,user_id,name");
  if (triggerUserId) portfoliosQuery = portfoliosQuery.eq("user_id", triggerUserId);

  const { data: portfolios } = await portfoliosQuery;
  const portfolioRows =
    (portfolios as { id: string; user_id: string; name: string | null }[] | null) ?? [];
  if (portfolioRows.length === 0) return { created: 0 };

  const portfolioIds = portfolioRows.map((portfolio) => portfolio.id);
  const { data: holdings } = await admin
    .from("holdings")
    .select("portfolio_id,symbol,quantity")
    .in("portfolio_id", portfolioIds);

  const ownerByPortfolio = new Map(portfolioRows.map((portfolio) => [portfolio.id, portfolio.user_id]));
  const totals = new Map<string, { dayPl: number; positions: number }>();

  for (const holding of (holdings as { portfolio_id: string; symbol: string; quantity: number | string }[] | null) ?? []) {
    const userId = ownerByPortfolio.get(holding.portfolio_id);
    const quote = quoteMap.get(String(holding.symbol).toUpperCase());
    const quantity = Number(holding.quantity);
    if (!userId || !quote || !Number.isFinite(quantity) || quantity <= 0) continue;
    const existing = totals.get(userId) ?? { dayPl: 0, positions: 0 };
    existing.dayPl += quote.change * quantity;
    existing.positions += 1;
    totals.set(userId, existing);
  }

  let created = 0;
  const bucket = twoHourBucket(now);
  for (const [userId, total] of totals.entries()) {
    if (Math.abs(total.dayPl) < 1) continue;
    const move = formatSignedMoney(total.dayPl);
    const holdingLabel = total.positions === 1 ? "holding" : "holdings";
    const direction = total.dayPl >= 0 ? "up" : "down";
    const result = await createNotification(admin, {
      userId,
      type: "PORTFOLIO",
      title: `Your portfolio is ${direction} ${move} today`,
      body: `Across ${total.positions} ${holdingLabel}, today's move is ${move} based on the latest PSX prices.`,
      href: "/dashboard",
      eventKey: `portfolio-pulse:${userId}:${pktDate(now)}:${bucket}`,
      eventPayload: total,
    });
    if (result.created) created += 1;
  }

  return { created };
}

async function createWatchlistMoveNotifications(
  admin: SupabaseClient,
  now: Date,
  quotes: Map<string, Quote>,
  triggerUserId?: string | null
) {
  if (!isMarketOpen(now)) return null;

  let quoteMap = quotes;
  if (quoteMap.size === 0) {
    const rows = await getMarketRows();
    quoteMap = new Map(rows.map((row) => [row.symbol.toUpperCase(), marketWatchRowToQuote(row)]));
  }

  let listsQuery = admin.from("watchlists").select("id,user_id");
  if (triggerUserId) listsQuery = listsQuery.eq("user_id", triggerUserId);

  const { data: lists } = await listsQuery;
  const listRows = (lists as { id: string; user_id: string }[] | null) ?? [];
  if (listRows.length === 0) return { created: 0 };

  const ownerByList = new Map(listRows.map((list) => [list.id, list.user_id]));
  const { data: items } = await admin
    .from("watchlist_items")
    .select("watchlist_id,symbol")
    .in("watchlist_id", listRows.map((list) => list.id));

  // Deduplicate to one (user, symbol) pair — a user may watch a symbol in more than one list.
  const seen = new Set<string>();
  const pairs: { userId: string; symbol: string }[] = [];
  for (const item of (items as { watchlist_id: string; symbol: string }[] | null) ?? []) {
    const userId = ownerByList.get(item.watchlist_id);
    if (!userId) continue;
    const symbol = String(item.symbol).toUpperCase();
    const key = `${userId}:${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ userId, symbol });
  }
  if (pairs.length === 0) return { created: 0 };

  let created = 0;
  for (const { userId, symbol } of pairs) {
    const quote = quoteMap.get(symbol);
    if (!quote || Math.abs(quote.changePct) < WATCHLIST_MOVE_THRESHOLD_PCT) continue;
    const direction = quote.change >= 0 ? "up" : "down";
    const result = await createNotification(admin, {
      userId,
      type: "WATCHLIST",
      title: `${symbol} is ${direction} ${formatPct(Math.abs(quote.changePct))} today`,
      body: `${symbol} on your watchlist is trading at Rs ${money(quote.price)} (${formatSignedMoney(quote.change)} today).`,
      symbol,
      href: `/stock/${symbol}`,
      eventKey: `watchlist-move:${userId}:${symbol}:${pktDate(now)}:${direction}`,
      eventPayload: {
        symbol,
        price: quote.price,
        change: quote.change,
        changePct: quote.changePct,
      },
    });
    if (result.created) created += 1;
  }

  return { created };
}

async function createGlobalMacroNotifications(admin: SupabaseClient) {
  const [oilData, commodityData, usData] = await Promise.all([
    getGlobalMarketData("oil"),
    getGlobalMarketData("commodities"),
    getGlobalMarketData("us"),
  ]);

  const [oil, gold, us] = await Promise.all([
    createOilNotification(admin, oilData),
    createGoldNotification(admin, commodityData),
    createUsMarketNotification(admin, usData),
  ]);

  return { oil, gold, us };
}

async function createOilNotification(admin: SupabaseClient, data: GlobalMarketData) {
  const oil =
    pickQuote(data, ["BZ=F", "CL=F"]) ??
    data.summary.best ??
    data.summary.worst;
  if (!oil || !hasMove(oil, 1)) return null;

  const direction = (oil.changePct ?? 0) >= 0 ? "up" : "down";
  const moveDate = notificationDateForQuote(oil);
  return createNotification(admin, {
    type: "MARKET",
    title: `Oil is ${direction} ${formatPct(Math.abs(oil.changePct ?? 0))} today`,
    body: `${oil.name} is trading near USD ${formatNumber(oil.price ?? 0)} a barrel after a ${formatSignedNumber(oil.change ?? 0)} move.`,
    href: "/market/oil",
    symbol: oil.displaySymbol ?? oil.symbol,
    eventKey: `macro-oil:${moveDate}:${direction}`,
    eventPayload: {
      symbol: oil.symbol,
      name: oil.name,
      price: oil.price,
      change: oil.change,
      changePct: oil.changePct,
    },
  });
}

async function createGoldNotification(admin: SupabaseClient, data: GlobalMarketData) {
  const gold = pickQuote(data, ["GC=F"]);
  if (!gold || !hasMove(gold, 0.75)) return null;

  const direction = (gold.changePct ?? 0) >= 0 ? "up" : "down";
  const moveDate = notificationDateForQuote(gold);
  return createNotification(admin, {
    type: "MARKET",
    title: `Gold is ${direction} ${formatPct(Math.abs(gold.changePct ?? 0))} today`,
    body: `${gold.name} is trading near USD ${formatNumber(gold.price ?? 0)} an ounce after a ${formatSignedNumber(gold.change ?? 0)} move.`,
    href: "/market/commodities",
    symbol: gold.displaySymbol ?? gold.symbol,
    eventKey: `macro-gold:${moveDate}:${direction}`,
    eventPayload: {
      symbol: gold.symbol,
      name: gold.name,
      price: gold.price,
      change: gold.change,
      changePct: gold.changePct,
    },
  });
}

async function createUsMarketNotification(admin: SupabaseClient, data: GlobalMarketData) {
  const sp500 = pickQuote(data, ["^GSPC", "SPY"]);
  if (!sp500 || !hasMove(sp500, 0.75)) return null;

  const direction = (sp500.changePct ?? 0) >= 0 ? "higher" : "lower";
  const moveDate = notificationDateForQuote(sp500);
  return createNotification(admin, {
    type: "MARKET",
    title: `US stocks are ${direction} today`,
    body: `The ${sp500.name} is ${formatSignedPct(sp500.changePct ?? 0)} and is trading near ${formatNumber(sp500.price ?? 0)}.`,
    href: "/market/us",
    symbol: sp500.displaySymbol ?? sp500.symbol,
    eventKey: `macro-us:${moveDate}:${direction}`,
    eventPayload: {
      symbol: sp500.symbol,
      name: sp500.name,
      price: sp500.price,
      change: sp500.change,
      changePct: sp500.changePct,
    },
  });
}

function twoHourBucket(date: Date) {
  const { hour } = pktParts(date);
  return Math.floor(hour / 2);
}

function pktDate(date: Date): string {
  const { year, month, day } = pktParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pktParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  let hour = Number(value("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: weekdayMap[value("weekday")] ?? 0,
    hour,
    minute: Number(value("minute")),
  };
}

function formatNextRefresh(value: string | null) {
  if (!value) return "when the next session starts";
  const date = new Date(value);
  const day = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} at ${time}`;
}

function describeNextTradingWindow(value: string | null) {
  if (!value) return "We will resume updates as soon as the next PSX session begins.";
  const preOpen = new Date(value);
  const regularOpen = new Date(preOpen.getTime() + 17 * 60 * 1000);
  return `Pre-open starts ${formatNextRefresh(value)} and regular trading starts ${formatNextRefresh(regularOpen.toISOString())}.`;
}

function describeCurrentRegularOpen(date: Date) {
  const current = pktParts(date);
  const regularOpen =
    current.weekday === 5
      ? current.hour < 12
        ? pktMoment(current, 9, 17)
        : pktMoment(current, 14, 32)
      : pktMoment(current, 9, 32);
  return describeRegularTradingAt(regularOpen);
}

function describeRegularTradingAt(date: Date) {
  return `Regular trading begins ${formatNextRefresh(date.toISOString())}.`;
}

function pktMoment(
  parts: ReturnType<typeof pktParts>,
  hour: number,
  minute: number
) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 5, minute));
}

function pickQuote(data: GlobalMarketData, symbols: string[]) {
  const preferred = symbols
    .map((symbol) => data.quotes.find((quote) => quote.symbol === symbol))
    .find(Boolean);
  return preferred ?? null;
}

function hasMove(quote: GlobalMarketQuote, minimumChangePct: number) {
  return quote.price != null && quote.change != null && Math.abs(quote.changePct ?? 0) >= minimumChangePct;
}

function notificationDateForQuote(quote: GlobalMarketQuote) {
  if (quote.updatedAt) return quote.updatedAt.slice(0, 10);
  return pktDate(new Date());
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number) {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatSignedPct(value: number) {
  return `${value >= 0 ? "+" : "-"}${formatPct(Math.abs(value))}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(value: number) {
  return `${value >= 0 ? "+" : "-"}Rs ${money(Math.abs(value))}`;
}
