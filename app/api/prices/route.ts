import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/services/prices";
import { marketStatus } from "@/lib/psx/market-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/prices?symbols=OGDC,LUCK,HBL
 * Returns cached-or-fresh quotes. The client (SWR) polls this every ~30s;
 * the heavy lifting (scrape) only runs on a cache miss.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ quotes: [], market: marketStatus() });
  }

  try {
    const map = await getQuotes(symbols);
    const quotes = symbols.map((s) => map.get(s)).filter(Boolean);
    return NextResponse.json(
      { quotes, market: marketStatus() },
      {
        headers: {
          // Let the CDN serve a slightly stale copy while revalidating.
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("[/api/prices] failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch prices", quotes: [] },
      { status: 502 }
    );
  }
}
