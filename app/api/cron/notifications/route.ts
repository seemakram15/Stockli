import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketRows, marketWatchRowToQuote } from "@/lib/services/prices";
import { runSystemNotificationJobs } from "@/lib/services/system-notifications";
import type { Quote } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * GET /api/cron/notifications — lightweight scheduled notification sweep.
 *
 * Unlike /api/cron/refresh this does NOT refresh the PSX market snapshot; it
 * only runs the time-gated notification jobs (market status, breaking news,
 * global macro, portfolio/watchlist pulses) against the latest cached quotes.
 * It is safe to hit every 15 minutes all day — each job deduplicates through
 * notification_events and applies its own PKT time window.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json({ ok: true, mode: "demo", note: "No Supabase admin — nothing to notify." });
  }

  const now = new Date();
  let quotes = new Map<string, Quote>();
  try {
    const rows = await getMarketRows();
    quotes = new Map(rows.map((row) => [row.symbol.toUpperCase(), marketWatchRowToQuote(row)]));
  } catch {
    // Jobs that need quotes fetch their own fallback; the rest run regardless.
  }

  const admin = createAdminClient();
  const results = await runSystemNotificationJobs({ admin, now, quotes });

  return NextResponse.json(
    { ok: true, ranAt: now.toISOString(), results },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
