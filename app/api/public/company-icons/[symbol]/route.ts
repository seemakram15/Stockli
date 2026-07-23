import { NextResponse } from "next/server";
import { getCompanyIcon } from "@/lib/services/company-icons";
import { normalizeSymbol } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * GET /api/public/company-icons/:symbol
 *
 * Serves a Redis/memory-backed company logo (proxied from AskAnalyst on miss).
 * Same-origin so the service worker and browser HTTP cache can reuse it after
 * the post-login warmup prefetch.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const icon = await getCompanyIcon(symbol);
  if (!icon) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }

  const body = Buffer.from(icon.base64, "base64");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": icon.contentType,
      "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
      "X-Stockli-Icon-Source": icon.source,
    },
  });
}
