import { NextResponse } from "next/server";
import { z } from "zod";
import {
  WORLD_PULSE_TIME_RANGES,
  WORLD_PULSE_VIEWS,
} from "@/lib/analysis/world-pulse";
import { getWorldPulseData } from "@/lib/services/world-pulse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  view: z.enum(WORLD_PULSE_VIEWS).default("world"),
  timeRange: z.enum(WORLD_PULSE_TIME_RANGES).default("48h"),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = requestSchema.safeParse({
      view: searchParams.get("view") ?? undefined,
      timeRange: searchParams.get("timeRange") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid world monitor request." }, { status: 400 });
    }

    const cached = await getWorldPulseData(parsed.data);
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
          "Cache-Control": "public, max-age=120, stale-while-revalidate=900",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        error: "World Monitor is temporarily unavailable. Please try again in a few minutes.",
      },
      { status: 500 }
    );
  }
}
