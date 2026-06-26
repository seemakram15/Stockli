import "server-only";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { isMarketOpen, isTradingDay, marketStatus, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { getRedis } from "@/lib/cache/redis";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGlobalMarketData, type MarketUniverse } from "@/lib/services/global-markets";
import { getMarketStrategyData } from "@/lib/services/market-strategy";
import {
  getBoardMeetingsData,
  getBookClosuresData,
  getDividendHistoryData,
  getPivotPointsData,
  getUsefulLinksData,
} from "@/lib/services/market-resources";
import { getMarketRows, refreshMarketWatch } from "@/lib/services/prices";
import { getMufapFunds } from "@/lib/services/mufap";
import { getPublicMarketPageData } from "@/lib/services/public-market-page";
import { createNotification, runSystemNotificationJobs } from "@/lib/services/system-notifications";
import { getYoutubeVideos } from "@/lib/services/youtube";
import type { Quote } from "@/lib/types";

export type BackendWarmupTrigger = "cron" | "login" | "manual";

export interface BackendWarmupOptions {
  trigger: BackendWarmupTrigger;
  userId?: string | null;
  force?: boolean;
  forcePsxRefresh?: boolean;
}

export async function runBackendWarmup({
  trigger,
  userId = null,
  force = false,
  forcePsxRefresh = false,
}: BackendWarmupOptions) {
  const startedAt = new Date();
  const status = marketStatus(startedAt);
  const psxRefreshAllowed = shouldRefreshPsxData(startedAt) || forcePsxRefresh;
  const throttle = force
    ? null
    : await claimWarmupSlot({ trigger, psxRefreshAllowed, userId });

  if (throttle?.skipped) {
    return {
      ok: true,
      skipped: true,
      reason: "recent-warmup",
      trigger,
      marketStatus: status,
      psxRefreshAllowed,
      nextAllowedAt: throttle.nextAllowedAt,
      startedAt: startedAt.toISOString(),
    };
  }

  let psxRefreshError: string | null = null;
  let quotes = new Map<string, Quote>();
  if (psxRefreshAllowed) {
    try {
      quotes = await refreshMarketWatch();
    } catch (err) {
      psxRefreshError = err instanceof Error ? err.message : String(err);
    }
  }
  const result: Record<string, unknown> = {
    ok: true,
    trigger,
    userId,
    refreshedSymbols: quotes.size,
    psxRefreshAllowed,
    marketStatus: status,
    tradingDay: isTradingDay(startedAt),
    persisted: isSupabaseAdminConfigured,
    startedAt: startedAt.toISOString(),
  };
  if (psxRefreshError) {
    result.psxRefreshError = psxRefreshError;
  }

  if (!psxRefreshAllowed) {
    result.psxRefreshSkipped = `PSX ${status.label.toLowerCase()}; serving cached data until the next refresh window.`;
  }

  if (!isSupabaseAdminConfigured) {
    result.publicCaches = await warmPublicCaches({ includePsx: psxRefreshAllowed });
    result.note = "Demo mode — cache warmed, no DB writes (add Supabase keys to persist).";
    return result;
  }

  const admin = createAdminClient();

  if (psxRefreshAllowed) {
    try {
      const rows = await getMarketRows();
      const tickerRows = rows.map((row) => ({
        symbol: row.symbol,
        sector: row.sector,
        listed_in: row.listedIn,
        is_active: true,
        updated_at: new Date().toISOString(),
      }));
      if (tickerRows.length) {
        await admin.from("tickers").upsert(tickerRows, { onConflict: "symbol" });
      }
      result.tickersUpserted = tickerRows.length;
    } catch (err) {
      result.tickerError = String(err);
    }
  }

  if (isMarketOpen(startedAt)) {
    try {
      const { data: holdings } = await admin
        .from("holdings")
        .select("portfolio_id, symbol, quantity");
      const today = isoDateInPkt(startedAt);
      const dailyRows = (holdings ?? [])
        .map((holding: { portfolio_id: string; symbol: string; quantity: number }) => {
          const quote = quotes.get(holding.symbol.toUpperCase());
          if (!quote) return null;
          const closeValue = quote.price * holding.quantity;
          const dayPl = quote.change * holding.quantity;
          const openValue = closeValue - dayPl;
          return {
            portfolio_id: holding.portfolio_id,
            symbol: holding.symbol,
            date: today,
            open_value: openValue,
            close_value: closeValue,
            day_pl: dayPl,
            day_pl_pct: quote.changePct,
          };
        })
        .filter(Boolean);
      if (dailyRows.length > 0) {
        await admin
          .from("daily_pl")
          .upsert(dailyRows as object[], { onConflict: "portfolio_id,symbol,date" });
      }
      result.dailyPlRows = dailyRows.length;
    } catch (err) {
      result.dailyPlError = String(err);
    }
  }

  if (isMarketOpen(startedAt)) {
    try {
      const { data: alerts } = await admin
        .from("alerts")
        .select("id, user_id, symbol, condition, target_price, is_active")
        .eq("is_active", true);
      const triggered: string[] = [];
      for (const alert of alerts ?? []) {
        const quote = quotes.get((alert.symbol as string).toUpperCase());
        if (!quote) continue;
        const hit =
          (alert.condition === "ABOVE" && quote.price >= alert.target_price) ||
          (alert.condition === "BELOW" && quote.price <= alert.target_price);
        if (!hit) continue;

        await admin
          .from("alerts")
          .update({ last_triggered_at: new Date().toISOString(), is_active: false })
          .eq("id", alert.id);
        await createNotification(admin, {
          userId: alert.user_id,
          type: "ALERT",
          title: `${alert.symbol} ${alert.condition === "ABOVE" ? "rose above" : "fell below"} Rs ${money(alert.target_price)}`,
          body: `Your price alert triggered — now Rs ${money(quote.price)}.`,
          symbol: alert.symbol,
          href: `/stock/${alert.symbol}`,
          eventKey: `price-alert:${alert.id}:${Math.round(Number(quote.price) * 100)}`,
          eventPayload: {
            alertId: alert.id,
            symbol: alert.symbol,
            price: quote.price,
            targetPrice: alert.target_price,
          },
        });
        triggered.push(alert.symbol as string);
      }
      result.alertsTriggered = triggered;
    } catch (err) {
      result.alertError = String(err);
    }
  }

  try {
    result.notifications = await runSystemNotificationJobs({
      admin,
      now: startedAt,
      quotes,
      triggerUserId: userId,
      psxRefreshError,
    });
  } catch (err) {
    result.notificationError = String(err);
  }

  result.publicCaches = await warmPublicCaches({ includePsx: psxRefreshAllowed });
  return result;
}

async function warmPublicCaches({ includePsx }: { includePsx: boolean }) {
  const globalMarkets: MarketUniverse[] = ["us", "india", "world", "commodities", "crypto", "oil"];
  const psxJobs = [
    ["psx-market", () => getPublicMarketPageData()],
    ["mufap-mutual", () => getMufapFunds()],
    ["mufap-etfs", () => getMufapFunds({ includeEtfs: true })],
    ["market-strategy", () => getMarketStrategyData()],
    ["board-meetings", () => getBoardMeetingsData()],
    ["book-closures", () => getBookClosuresData()],
    ["dividend-history", () => getDividendHistoryData()],
    ["pivot-points", () => getPivotPointsData()],
  ] as const;
  const jobs = [
    ...(includePsx ? psxJobs : []),
    ["useful-links", () => getUsefulLinksData()],
    ["youtubers", () => getYoutubeVideos()],
    ...globalMarkets.map(
      (market) => [`global-${market}`, () => getGlobalMarketData(market)] as const
    ),
  ] as const;

  const results = await Promise.allSettled(jobs.map(([, run]) => run()));
  return jobs.map(([name], index) => ({
    name,
    ok: results[index].status === "fulfilled",
    error: results[index].status === "rejected" ? String(results[index].reason) : undefined,
  }));
}

async function claimWarmupSlot({
  trigger,
  psxRefreshAllowed,
  userId,
}: {
  trigger: BackendWarmupTrigger;
  psxRefreshAllowed: boolean;
  userId: string | null;
}) {
  const ttlSeconds = psxRefreshAllowed ? 90 : 15 * 60;
  const key = `backend-warmup:${trigger}:${psxRefreshAllowed ? "psx-live" : "psx-closed"}`;
  const existing = getMemoryCache<string>(key);
  if (existing) return { skipped: true, nextAllowedAt: existing };

  const redis = getRedis();
  const nextAllowedAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  if (redis) {
    try {
      const cached = await redis.get<string>(key);
      if (cached) return { skipped: true, nextAllowedAt: cached };
      await redis.set(key, nextAllowedAt, { ex: ttlSeconds });
    } catch {
      // Memory throttle still protects this server instance.
    }
  }

  setMemoryCache(key, nextAllowedAt, ttlSeconds);
  if (userId) setMemoryCache(`backend-warmup:last-user:${userId}`, nextAllowedAt, ttlSeconds);
  return { skipped: false, nextAllowedAt };
}

function money(value: number): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isoDateInPkt(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date);
}
