import { NextResponse } from "next/server";
import { config, isSupabaseAdminConfigured } from "@/lib/config";
import { refreshMarketWatch } from "@/lib/services/prices";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTradingDay } from "@/lib/psx/market-hours";
import { psx } from "@/lib/psx/adapter";

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
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${config.cronSecret}`) {
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
      .select("id, symbol, condition, target_price, is_active")
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
        triggered.push(a.symbol as string);
      }
    }
    result.alertsTriggered = triggered;
  } catch (err) {
    result.alertError = String(err);
  }

  return NextResponse.json(result);
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
