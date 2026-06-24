import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { refreshMarketWatch } from "@/lib/services/prices";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTradingDay, marketStatus } from "@/lib/psx/market-hours";
import { getRedis } from "@/lib/cache/redis";
import { psx } from "@/lib/psx/adapter";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { getGlobalMarketData, type MarketUniverse } from "@/lib/services/global-markets";
import { getMarketStrategyData } from "@/lib/services/market-strategy";
import { getMufapFunds } from "@/lib/services/mufap";
import { getPublicMarketPageData } from "@/lib/services/public-market-page";
import { getYoutubeVideos } from "@/lib/services/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby limit

/**
 * GET /api/cron/refresh — warms the price cache and reconciles DB state.
 * Secured by `Authorization: Bearer <CRON_SECRET>` (Vercel cron + an external
 * scheduler both send this). Designed to be IDEMPOTENT: each run sets the
 * latest snapshot / upserts daily P/L rather than incrementing, so duplicate
 * or missed runs are safe.
 *
 * Steps: scrape /market-watch → cache + snapshot → upsert tickers →
 *        upsert today's daily P/L per holding → evaluate price alerts.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const quotes = await refreshMarketWatch();
  const result: Record<string, unknown> = {
    ok: true,
    refreshedSymbols: quotes.size,
    tradingDay: isTradingDay(startedAt),
    persisted: isSupabaseAdminConfigured,
    startedAt: startedAt.toISOString(),
  };

  if (!isSupabaseAdminConfigured) {
    result.publicCaches = await warmPublicCaches();
    result.note = "Demo mode — cache warmed, no DB writes (add Supabase keys to persist).";
    return NextResponse.json(result);
  }

  const admin = createAdminClient();

  // 1) Upsert ticker metadata from the live market watch.
  try {
    const rows = await psx.getMarketWatch();
    const tickerRows = rows.map((r) => ({
      symbol: r.symbol,
      sector: r.sector,
      listed_in: r.listedIn,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));
    await admin.from("tickers").upsert(tickerRows, { onConflict: "symbol" });
    result.tickersUpserted = tickerRows.length;
  } catch (err) {
    result.tickerError = String(err);
  }

  // 2) Upsert today's daily P/L for every holding (only on trading days).
  if (isTradingDay(startedAt)) {
    try {
      const { data: holdings } = await admin
        .from("holdings")
        .select("portfolio_id, symbol, quantity");
      const today = isoDateInPkt(startedAt);
      const dailyRows = (holdings ?? [])
        .map((h: { portfolio_id: string; symbol: string; quantity: number }) => {
          const q = quotes.get(h.symbol.toUpperCase());
          if (!q) return null;
          const closeValue = q.price * h.quantity;
          const dayPl = q.change * h.quantity;
          const openValue = closeValue - dayPl;
          return {
            portfolio_id: h.portfolio_id,
            symbol: h.symbol,
            date: today,
            open_value: openValue,
            close_value: closeValue,
            day_pl: dayPl,
            day_pl_pct: q.changePct,
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

  // 3) Evaluate active price alerts (~15 min cadence; email delivery is a
  //    later enhancement — here we just flag last_triggered_at idempotently).
  try {
    const { data: alerts } = await admin
      .from("alerts")
      .select("id, user_id, symbol, condition, target_price, is_active")
      .eq("is_active", true);
    const triggered: string[] = [];
    for (const a of alerts ?? []) {
      const q = quotes.get((a.symbol as string).toUpperCase());
      if (!q) continue;
      const hit =
        (a.condition === "ABOVE" && q.price >= a.target_price) ||
        (a.condition === "BELOW" && q.price <= a.target_price);
      if (hit) {
        await admin
          .from("alerts")
          .update({ last_triggered_at: new Date().toISOString(), is_active: false })
          .eq("id", a.id);
        // Notify the alert's owner.
        await admin.from("notifications").insert({
          user_id: a.user_id,
          type: "ALERT",
          title: `${a.symbol} ${a.condition === "ABOVE" ? "rose above" : "fell below"} Rs ${money(a.target_price)}`,
          body: `Your price alert triggered — now Rs ${money(q.price)}.`,
          symbol: a.symbol,
        });
        triggered.push(a.symbol as string);
      }
    }
    result.alertsTriggered = triggered;
  } catch (err) {
    result.alertError = String(err);
  }

  // 4) Market open/close/status-change notifications (global, deduped).
  try {
    const redis = getRedis();
    const status = marketStatus(startedAt);
    const prev = redis ? await redis.get<string>("psx:marketstatus") : null;
    if (prev && prev !== status.status) {
      const titles: Record<string, string> = {
        open: "📈 Market opened",
        "pre-open": "Pre-open session started",
        closed: "Market closed",
        weekend: "Market closed for the weekend",
        holiday: "Market closed for a holiday",
      };
      await admin.from("notifications").insert({
        user_id: null,
        type: "MARKET",
        title: titles[status.status] ?? "Market status changed",
        body: status.label,
      });
      result.marketEvent = `${prev} → ${status.status}`;
    }
    if (redis) await redis.set("psx:marketstatus", status.status);
  } catch (err) {
    result.marketStatusError = String(err);
  }

  result.publicCaches = await warmPublicCaches();
  return NextResponse.json(result);
}

async function warmPublicCaches() {
  const globalMarkets: MarketUniverse[] = ["us", "india", "world", "commodities", "crypto", "oil"];
  const jobs = [
    ["psx-market", () => getPublicMarketPageData()],
    ["mufap-mutual", () => getMufapFunds()],
    ["mufap-etfs", () => getMufapFunds({ includeEtfs: true })],
    ["market-strategy", () => getMarketStrategyData()],
    ["youtubers", () => getYoutubeVideos()],
    ...globalMarkets.map((market) => [`global-${market}`, () => getGlobalMarketData(market)] as const),
  ] as const;

  const results = await Promise.allSettled(jobs.map(([, run]) => run()));
  return jobs.map(([name], index) => ({
    name,
    ok: results[index].status === "fulfilled",
    error: results[index].status === "rejected" ? String(results[index].reason) : undefined,
  }));
}

/** Format a number with grouping for notification text. */
function money(n: number): string {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Today's date (YYYY-MM-DD) in Pakistan time. */
function isoDateInPkt(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d); // en-CA → YYYY-MM-DD
}
