import { NextRequest, NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFmrText } from "@/lib/utils/fmr-parser";
import { PAKISTAN_FUNDS } from "@/lib/constants/pakistan-funds";
import type { ParsedFund } from "@/lib/utils/fmr-parser";

// ─── Ticker fuzzy-matching ────────────────────────────────────────────────────

const SUFFIX_RE =
  /\s*(limited|ltd\.?|corporation|corp\.?|industries|company|co\.?|pvt\.?|private|pakistan|pak)\s*$/gi;

function normCompany(s: string): string {
  return s
    .toLowerCase()
    .replace(SUFFIX_RE, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTicker(
  stockName: string,
  tickers: { symbol: string; companyName: string }[],
): string | null {
  const n = normCompany(stockName);
  if (n.length < 3) return null;

  let best: { symbol: string; score: number } | null = null;

  for (const t of tickers) {
    const tn = normCompany(t.companyName);

    // Exact normalized match
    if (n === tn) return t.symbol;

    // One contains the other — prefer longer overlap
    if (
      (n.includes(tn) || tn.includes(n)) &&
      Math.min(n.length, tn.length) >= 6
    ) {
      const score =
        Math.min(n.length, tn.length) / Math.max(n.length, tn.length);
      if (!best || score > best.score) best = { symbol: t.symbol, score };
    }
  }

  return best && best.score >= 0.65 ? best.symbol : null;
}

// ─── Islamic keyword check ────────────────────────────────────────────────────

const ISLAMIC_KEYWORDS = [
  "islamic", "shariah", "alhamra", "al ameen", "meezan", "halal",
];

function isIslamicFund(name: string): boolean {
  const n = name.toLowerCase();
  return ISLAMIC_KEYWORDS.some((k) => n.includes(k));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await isSuperadmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const amc = (formData.get("amc") as string | null)?.trim();
  const type = formData.get("type") as "conventional" | "islamic" | null;
  const files = formData.getAll("files") as File[];

  if (!amc || !type) {
    return NextResponse.json({ error: "Missing amc or type" }, { status: 400 });
  }
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Filter funds by AMC + conventional/Islamic
  const targetFunds = PAKISTAN_FUNDS.filter((f) => {
    if (f.amc !== amc) return false;
    const islamic = isIslamicFund(f.name);
    return type === "islamic" ? islamic : !islamic;
  });

  if (targetFunds.length === 0) {
    return NextResponse.json(
      { error: "No matching funds for this AMC and type combination" },
      { status: 400 },
    );
  }

  // Load tickers once for symbol matching
  const db = createAdminClient();
  const { data: tickerRows } = await db
    .from("tickers")
    .select("symbol, company_name")
    .eq("is_active", true);
  const tickers = (tickerRows ?? []).map((t) => ({
    symbol: t.symbol as string,
    companyName: (t.company_name ?? t.symbol) as string,
  }));

  // Parse each PDF
  const allResults: ParsedFund[] = [];
  const sampleLines: string[] = []; // kept for debug when nothing is found

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      // Dynamic import — server-only, avoids client-bundle issues
      const { extractText } = await import("unpdf");
      const { text: pages } = await extractText(new Uint8Array(buffer));
      const text = pages.join("\n");

      if (!text.trim()) continue;

      // Collect sample lines for diagnostics
      if (sampleLines.length === 0) {
        text.split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .slice(0, 120)
          .forEach((l) => sampleLines.push(l));
      }

      const fundResults = parseFmrText(text, targetFunds, file.name);

      // Auto-match tickers
      for (const fund of fundResults) {
        for (const h of fund.holdings) {
          h.symbol = matchTicker(h.stockName, tickers);
        }
      }

      allResults.push(...fundResults);
    } catch (e) {
      console.warn(`[parse-fmr] Failed to parse ${file.name}:`, e);
    }
  }

  // Merge duplicate fund results across files — later file's holdings win on conflict
  const merged = new Map<string, ParsedFund>();
  for (const r of allResults) {
    const existing = merged.get(r.fundName);
    if (!existing) {
      merged.set(r.fundName, { ...r, holdings: [...r.holdings] });
    } else {
      // Append new stocks not already present
      const seenNames = new Set(
        existing.holdings.map((h) => h.stockName.toLowerCase()),
      );
      for (const h of r.holdings) {
        if (!seenNames.has(h.stockName.toLowerCase())) {
          existing.holdings.push(h);
          seenNames.add(h.stockName.toLowerCase());
        }
      }
    }
  }

  const results = [...merged.values()];

  // Return sample lines when nothing was found so callers can diagnose format issues
  if (results.length === 0 && sampleLines.length > 0) {
    return NextResponse.json({
      results: [],
      _debug: {
        sampleLines,
        fundsSearched: targetFunds.map((f) => f.name),
      },
    });
  }

  return NextResponse.json({ results });
}
