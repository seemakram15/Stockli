import { NextResponse } from "next/server";
import {
  getStockProfileDescriptionAi,
  StockProfileDescriptionAiError,
} from "@/lib/services/stock-profile-description-ai";
import { normalizeSymbol } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol: symbolRaw } = await params;
    const symbol = normalizeSymbol(symbolRaw);
    if (!symbol) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }

    const cached = await getStockProfileDescriptionAi({ symbol });

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
          // AI text is cached server-side for days; CDN can keep a shorter window.
          "Cache-Control": cached.value.usedAi
            ? "public, s-maxage=3600, stale-while-revalidate=86400"
            : "public, s-maxage=60, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof StockProfileDescriptionAiError
        ? error.message
        : "We could not refresh the company description right now.";
    const status =
      error instanceof StockProfileDescriptionAiError ? error.statusCode : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
