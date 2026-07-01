import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import { DEMO_USER } from "@/lib/demo/data";
import { runBackendWarmup } from "@/lib/services/backend-warmup";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/background/warmup
 *
 * Silent authenticated warmup triggered after app login. It never exposes cron
 * secrets to the browser; it only runs when a valid app session exists.
 */
export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await safeJson(request);
  const manual = body?.mode === "manual" || body?.force === true;
  const result = await runBackendWarmup({
    trigger: manual ? "manual" : "login",
    userId,
    forcePsxRefresh: manual,
    allowPrivilegedWrites: false,
  });
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function safeJson(request: Request): Promise<{ mode?: string; force?: boolean } | null> {
  try {
    return (await request.json()) as { mode?: string; force?: boolean };
  } catch {
    return null;
  }
}

async function getAuthenticatedUserId() {
  if (isDemoMode) return DEMO_USER.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
