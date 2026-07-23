import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import {
  refreshStockFinancials,
  StockFinancialsRefreshError,
  type StockFinancialsRefreshResult,
} from "@/lib/services/stock-fundamentals";
import {
  enforceRateLimit,
  formatRetryAfter,
  getRequestClientIp,
  rateLimitKeyPart,
} from "@/lib/security/rate-limit";
import { normalizeSymbol } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";
import type { StockFinancialsRefreshProgress } from "@/lib/types/stock-fundamentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RefreshStreamEvent =
  | ({ type: "progress" } & StockFinancialsRefreshProgress)
  | ({ type: "result" } & ReturnType<typeof buildRefreshPayload>)
  | { type: "error"; error: string; status?: number };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  let userId: string | null = null;
  if (!isDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sign in to refresh fundamentals." },
        { status: 401 }
      );
    }
    userId = user.id;
  }

  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const ip = await getRequestClientIp();
  const rateLimit = await enforceRateLimit({
    scope: "stock-financials-refresh",
    windowSeconds: 5 * 60,
    buckets: [
      { key: `ip:${rateLimitKeyPart(ip)}`, limit: 8 },
      ...(userId ? [{ key: `user:${rateLimitKeyPart(userId)}`, limit: 4 }] : []),
    ],
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many snapshot refreshes. Please wait ${formatRetryAfter(
          rateLimit.retryAfterSeconds
        )} before trying again.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterSeconds))),
        },
      }
    );
  }

  const wantsStream =
    new URL(request.url).searchParams.get("stream") === "1" ||
    (request.headers.get("accept") ?? "").includes("application/x-ndjson");

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: RefreshStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          const refreshed = await refreshStockFinancials(symbol, {
            onProgress: async (progress) => {
              send({ type: "progress", ...progress });
            },
          });
          if (!refreshed) {
            send({
              type: "error",
              error: "Financial data unavailable",
              status: 404,
            });
            return;
          }
          send({ type: "result", ...buildRefreshPayload(symbol, refreshed) });
        } catch (error) {
          const message =
            error instanceof StockFinancialsRefreshError
              ? error.message
              : "Fresh fundamentals could not be fetched right now.";
          const status =
            error instanceof StockFinancialsRefreshError ? error.statusCode : 500;
          send({ type: "error", error: message, status });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  try {
    const refreshed = await refreshStockFinancials(symbol);
    if (!refreshed) {
      return NextResponse.json({ error: "Financial data unavailable" }, { status: 404 });
    }

    return NextResponse.json(buildRefreshPayload(symbol, refreshed), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof StockFinancialsRefreshError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      {
        error: "Fresh fundamentals could not be fetched right now.",
      },
      { status: 500 }
    );
  }
}

function buildRefreshPayload(symbol: string, refreshed: StockFinancialsRefreshResult) {
  const cacheStatus = refreshed.usedFallback ? "stale" : "fresh";
  const warning = refreshed.usedFallback
    ? `Fresh statement rows were not available for ${symbol}. The last cached snapshot was preserved.`
    : refreshed.complete
      ? null
      : `Complete fundamentals are not available for ${symbol} yet. Missing sections: ${refreshed.missingTabs.join(", ")}.`;

  return {
    data: refreshed.value,
    refresh: {
      usedFallback: refreshed.usedFallback,
      hadMeaningfulFreshData: refreshed.hadMeaningfulFreshData,
      complete: refreshed.complete,
      missingTabs: refreshed.missingTabs,
    },
    cache: {
      status: cacheStatus,
      storedAt: refreshed.storedAt,
    },
    warning,
  };
}
