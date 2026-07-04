import { NextResponse } from "next/server";
import { z } from "zod";
import {
  WORLD_PULSE_TIME_RANGES,
  WORLD_PULSE_VIEWS,
} from "@/lib/analysis/world-pulse";
import { isDemoMode } from "@/lib/config";
import { WorldMonitorAiError, getWorldMonitorAiInsight } from "@/lib/services/world-monitor-ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  view: z.enum(WORLD_PULSE_VIEWS),
  timeRange: z.enum(WORLD_PULSE_TIME_RANGES),
});

export async function POST(request: Request) {
  try {
    if (!isDemoMode) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid world monitor AI request." }, { status: 400 });
    }

    const cached = await getWorldMonitorAiInsight(parsed.data);
    return NextResponse.json(
      {
        data: cached.value,
        cache: {
          status: cached.status,
          storedAt: cached.storedAt,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof WorldMonitorAiError
        ? error.message
        : "We could not refresh the live summary right now. Please try again in a few minutes.";
    const status = error instanceof WorldMonitorAiError ? error.statusCode : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
