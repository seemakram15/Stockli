import { NextResponse } from "next/server";
import { z } from "zod";
import {
  PORTFOLIO_DURATIONS,
  PORTFOLIO_OBJECTIVES,
} from "@/lib/analysis/portfolio-suggestions";
import {
  StrategyAiError,
  getAiPortfolioSuggestion,
} from "@/lib/services/sector-portfolio-ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  duration: z.enum(PORTFOLIO_DURATIONS),
  objective: z.enum(PORTFOLIO_OBJECTIVES),
  holdings: z.number().int().min(3).max(12),
  variation: z.number().int().min(0).max(20).optional().default(0),
  currentSymbols: z.array(z.string().min(1).max(20)).max(12).optional().default([]),
  excludedSymbols: z.array(z.string().min(1).max(20)).max(120).optional().default([]),
  currentScore: z.number().min(0).max(100).nullable().optional().default(null),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid portfolio suggestion request." }, { status: 400 });
    }

    const cached = await getAiPortfolioSuggestion(parsed.data);
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
      error instanceof Error ? error.message : "Portfolio suggestions are unavailable right now.";
    const status =
      error instanceof StrategyAiError
        ? error.statusCode
        : /not configured/i.test(message)
          ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
