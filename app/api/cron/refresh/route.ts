import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { runBackendWarmup } from "@/lib/services/backend-warmup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/refresh — secured scheduled cache/database warmup.
 *
 * The implementation lives in the shared backend warmup service so cron and
 * post-login background refreshes follow the same market-hours rules.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBackendWarmup({ trigger: "cron", force: true });
  return NextResponse.json(result);
}

