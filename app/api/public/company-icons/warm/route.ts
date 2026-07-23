import { NextResponse } from "next/server";
import { warmCompanyIcons } from "@/lib/services/company-icons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * POST /api/public/company-icons/warm
 * Body: { symbols: string[], budgetMs?: number }
 *
 * Best-effort icon warmup used by the post-login popup. Public because logos
 * are non-sensitive market assets; the caller still scopes symbols to the
 * signed-in user's holdings / watchlist.
 */
export async function POST(request: Request) {
  const body = await safeJson(request);
  const symbols = Array.isArray(body?.symbols) ? body.symbols : [];
  if (symbols.length === 0) {
    return NextResponse.json({ data: { warmed: 0, results: [] } });
  }

  const result = await warmCompanyIcons(symbols, {
    budgetMs: typeof body?.budgetMs === "number" ? body.budgetMs : 7_000,
  });

  return NextResponse.json(
    { data: result },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

async function safeJson(
  request: Request
): Promise<{ symbols?: unknown[]; budgetMs?: number } | null> {
  try {
    return (await request.json()) as { symbols?: unknown[]; budgetMs?: number };
  } catch {
    return null;
  }
}
