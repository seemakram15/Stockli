import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMarketOpen,
  marketStatus,
  shouldRefreshPsxData,
} from "@/lib/psx/market-hours";
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
  const [marketEvent, kseEvent, portfolioEvent, feedEvent] = await Promise.allSettled([
    createMarketSituationNotification(admin, now),
    createKse100ChangeNotification(admin, now),
    createPortfolioPulseNotifications(admin, now, quotes, triggerUserId),
    psxRefreshError ? createFeedIssueNotification(admin, now, psxRefreshError) : Promise.resolve(null),
  ]);

  results.marketSituation =
    marketEvent.status === "fulfilled" ? marketEvent.value : String(marketEvent.reason);
  results.kse100 =
    kseEvent.status === "fulfilled" ? kseEvent.value : String(kseEvent.reason);
  results.portfolioPulse =
    portfolioEvent.status === "fulfilled" ? portfolioEvent.value : String(portfolioEvent.reason);
  if (psxRefreshError) {
    results.marketFeed =
      feedEvent.status === "fulfilled" ? feedEvent.value : String(feedEvent.reason);
  }
  return results;
}

async function createMarketSituationNotification(admin: SupabaseClient, now: Date) {
  const status = marketStatus(now);
  const date = pktDate(now);
  const keyStatus = status.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const title =
    status.label.toLowerCase().includes("between sessions")
      ? "PSX market break"
      : ({
          open: "PSX market opened",
          "pre-open": "PSX pre-open started",
          closed: "PSX market closed",
          weekend: "PSX market is closed",
          holiday: "PSX market holiday",
        }[status.status] ?? "PSX market update");

  const body =
    title === "PSX market break"
      ? `Trading is between sessions. Live refresh resumes ${formatNextRefresh(status.nextRefreshAt)}.`
      : status.status === "open"
        ? "Live prices, portfolio P/L, alerts and calendars are refreshing during the session."
        : status.status === "pre-open"
          ? "Pre-open is active. Live trading updates begin when the regular session starts."
          : `${status.label}. Next refresh window ${formatNextRefresh(status.nextRefreshAt)}.`;

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
    title: "Market feed needs attention",
    body:
      "The live PSX feed did not respond during a refresh window. Cached market data remains available while we retry.",
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
    title: `KSE100 is ${direction} ${formatPct(Math.abs(kse100.changePct))}`,
    body: `${formatSigned(kse100.change)} points today. Current level ${formatNumber(kse100.current)}.`,
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
  await Promise.all(
    Array.from(totals.entries()).map(async ([userId, total]) => {
      if (Math.abs(total.dayPl) < 1) return;
      const positive = total.dayPl >= 0;
      const result = await createNotification(admin, {
        userId,
        type: "PORTFOLIO",
        title: positive ? "Portfolio pulse: gain today" : "Portfolio pulse: loss today",
        body: `Your positions are ${positive ? "up" : "down"} Rs ${money(Math.abs(total.dayPl))} today across ${total.positions} positions.`,
        href: "/dashboard",
        eventKey: `portfolio-pulse:${userId}:${pktDate(now)}:${bucket}`,
        eventPayload: total,
      });
      if (result.created) created += 1;
    })
  );

  return { created };
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
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  let hour = Number(value("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour,
    minute: Number(value("minute")),
  };
}

function formatNextRefresh(value: string | null) {
  if (!value) return "when the next session starts";
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatSigned(value: number) {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
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
