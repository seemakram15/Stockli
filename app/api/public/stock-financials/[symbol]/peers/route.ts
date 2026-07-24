import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import {
  ensureStockFinancialPeerComparison,
  getStockFinancialPeerCandidates,
  getStockFinancialPeerComparison,
  StockFinancialsRefreshError,
} from "@/lib/services/stock-fundamentals";
import {
  enforceRateLimit,
  formatRetryAfter,
  getRequestClientIp,
  rateLimitKeyPart,
} from "@/lib/security/rate-limit";
import { normalizeSymbol } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";
import type {
  StockFinancialPeerPrepareProgress,
  StockFinancialTabId,
} from "@/lib/types/stock-fundamentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PEER_TABS = ["latest", "income", "balance", "cashflow", "ratios"] as const;

type PeerPrepareStreamEvent =
  | StockFinancialPeerPrepareProgress
  | { type: "error"; error: string; status?: number };

function parsePeerRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  const tabId = searchParams.get("tab") as StockFinancialTabId | null;
  const metric = searchParams.get("metric")?.trim() ?? "";
  const mode = searchParams.get("mode")?.trim() || "comparison";
  if (!tabId || !PEER_TABS.includes(tabId as (typeof PEER_TABS)[number]) || !metric) {
    return null;
  }
  return {
    tabId: tabId as Exclude<StockFinancialTabId, "overview">,
    metric,
    mode,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const parsed = parsePeerRequest(request);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid peer comparison request" }, { status: 400 });
  }

  if (parsed.mode === "candidates") {
    const listed = await getStockFinancialPeerCandidates(symbol);
    if (!listed) {
      return NextResponse.json({ error: "Peer companies unavailable" }, { status: 404 });
    }
    return NextResponse.json(
      {
        data: listed,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const cached = await getStockFinancialPeerComparison({
    symbol,
    tabId: parsed.tabId,
    metricLabel: parsed.metric,
  });
  if (!cached) {
    return NextResponse.json({ error: "Peer comparison unavailable" }, { status: 404 });
  }

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
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}

/**
 * Fetch missing peer fundamentals (AskAnalyst) in parallel, streaming status,
 * then emit the metric comparison. Honors request abort (Completed?).
 */
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
    userId = user?.id ?? null;
  }

  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const parsed = parsePeerRequest(request);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid peer comparison request" }, { status: 400 });
  }

  const ip = await getRequestClientIp();
  const rateLimit = await enforceRateLimit({
    scope: "stock-financials-peer-prepare",
    windowSeconds: 10 * 60,
    buckets: [
      { key: `ip:${rateLimitKeyPart(ip)}`, limit: userId ? 20 : 8 },
      ...(userId ? [{ key: `user:${rateLimitKeyPart(userId)}`, limit: 30 }] : []),
    ],
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many peer comparisons. Please wait ${formatRetryAfter(
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PeerPrepareStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Stream already closed (client aborted).
        }
      };

      try {
        const comparison = await ensureStockFinancialPeerComparison({
          symbol,
          tabId: parsed.tabId,
          metricLabel: parsed.metric,
          signal: request.signal,
          fetchMissing: true,
          onProgress: async (progress) => {
            if (request.signal.aborted) return;
            send(progress);
          },
        });
        if (!comparison && !request.signal.aborted) {
          send({ type: "error", error: "Peer comparison unavailable", status: 404 });
        }
      } catch (error) {
        if (request.signal.aborted) return;
        if (error instanceof StockFinancialsRefreshError) {
          send({ type: "error", error: error.message, status: error.statusCode });
        } else {
          console.error("[stock-financials/peers] prepare failed:", error);
          send({
            type: "error",
            error: "Peer comparison could not be prepared right now.",
            status: 500,
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // Client aborted (Completed?) — ensure() also watches request.signal.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
