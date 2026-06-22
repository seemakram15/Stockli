import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { SEED_TICKERS } from "@/lib/psx/symbols";
import { sanitizeSearchQuery } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SearchResult {
  symbol: string;
  company: string | null;
  sector: string | null;
}

/** GET /api/search?q=ogd — ticker search by symbol or company name. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = sanitizeSearchQuery(searchParams.get("q"));
  if (q.length === 0) return NextResponse.json({ results: [] });

  let results: SearchResult[] = [];

  if (isDemoMode) {
    results = SEED_TICKERS.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) || t.company.toLowerCase().includes(q)
    )
      .slice(0, 20)
      .map((t) => ({ symbol: t.symbol, company: t.company, sector: t.sector }));
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("tickers")
      .select("symbol, company_name, sector")
      .or(`symbol.ilike.%${q}%,company_name.ilike.%${q}%`)
      .eq("is_active", true)
      .limit(20);
    results =
      (data as { symbol: string; company_name: string | null; sector: string | null }[] | null)?.map(
        (t) => ({ symbol: t.symbol, company: t.company_name, sector: t.sector })
      ) ?? [];
    // Fallback to the seed list if the table isn't populated yet.
    if (results.length === 0) {
      results = SEED_TICKERS.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) || t.company.toLowerCase().includes(q)
      )
        .slice(0, 20)
        .map((t) => ({ symbol: t.symbol, company: t.company, sector: t.sector }));
    }
  }

  return NextResponse.json({ results });
}
