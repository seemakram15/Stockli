import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/keep-alive — lightweight daily ping to stop the Supabase free
 * project pausing after 7 days idle. Protected by the same CRON_SECRET as the
 * market refresh route.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({ ok: true, mode: "demo", note: "No Supabase to ping." });
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("tickers").select("symbol").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, pingedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
