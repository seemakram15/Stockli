/**
 * Parses extracted PDF text from Pakistani mutual fund FMR reports.
 * Identifies fund sections and extracts equity holding rows.
 */

export interface ParsedHolding {
  stockName: string;
  percentage: number;
  symbol: string | null;
}

export interface ParsedFund {
  fundName: string;
  holdings: ParsedHolding[];
  fileName: string;
}

interface FundDef {
  name: string;
}

// ─── Text normalisation ───────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "fund", "the", "of", "for", "and", "a", "an", "plan",
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "class", "series", "scheme",
]);

function keyWords(name: string): string[] {
  return norm(name)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// ─── Fund header detection ────────────────────────────────────────────────────

type FundLine = { fundDef: FundDef; lineIdx: number; score: number };

function scoreLine(line: string, kw: string[]): number {
  if (!kw.length) return 0;
  const words = norm(line).split(" ");
  const hits = kw.filter((k) => words.includes(k) || words.some((w) => w.startsWith(k)));
  return hits.length / kw.length;
}

function findFundLines(lines: string[], funds: FundDef[]): FundLine[] {
  const kwMap = funds
    .map((f) => ({ fund: f, kw: keyWords(f.name) }))
    .filter(({ kw }) => kw.length > 0);

  // Score each line against each fund
  const byFund = new Map<string, FundLine>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 6 || line.length > 160) continue;

    for (const { fund, kw } of kwMap) {
      const score = scoreLine(line, kw);
      if (score >= 0.75) {
        const prev = byFund.get(fund.name);
        if (!prev || score > prev.score) {
          byFund.set(fund.name, { fundDef: fund, lineIdx: i, score });
        }
      }
    }
  }

  return [...byFund.values()].sort((a, b) => a.lineIdx - b.lineIdx);
}

// ─── Table boundary detection ─────────────────────────────────────────────────

const EQUITY_TABLE_STARTS = [
  "equity invest",
  "equity hold",
  "stock invest",
  "listed equity",
  "quoted equity",
  "equity portfolio",
  "equities",
  "top holding",
  "portfolio disclosure",
  "stocks / equities",
  "equity securities",
  "ordinary shares",
  "equity exposure",
];

const TABLE_END_MARKERS = [
  "total equity",
  "total stock",
  "total listed",
  "sub-total",
  "subtotal",
  "total invest",
  "debt invest",
  "fixed income",
  "money market",
  "term deposit",
  "tdr",
  "tfc",
  "sukuk",
  "cfs",
  "reverse repo",
  "tbills",
  "t-bills",
  "pib",
  "placement",
  "government securi",
  "cash and cash",
  "cash & cash",
  "other assets",
  "net assets",
  "receivable",
  "payable",
  "pibs",
];

const SKIP_HEADER_WORDS = [
  "s.no",
  "sr.",
  "security name",
  "company name",
  "% of nav",
  "% of net",
  "market value",
  "particulars",
  "name of company",
];

// ─── Holding row parsing ──────────────────────────────────────────────────────

// Pattern A: rank + name + percentage (column-style, rank and % separated by 2+ spaces)
const RE_RANK_COL = /^(\d{1,3})\s{2,}(.+?)\s{2,}(\d{1,3}\.\d{1,2})\s*%?\s*$/;
// Pattern B: optional rank + name + % (2+ space separator)
const RE_NAME_COL = /^(?:\d{1,3}[.):\s-]{1,3})?(.+?)\s{2,}(\d{1,3}\.\d{1,2})\s*%?\s*$/;
// Pattern C: explicit % sign, single space ok
const RE_EXPLICIT_PCT = /^(?:\d{1,3}[.):\s-]{1,3})?(.+?)\s+(\d{1,3}\.\d{1,2})\s*%\s*$/;

function parseHoldingLine(
  line: string,
): { stockName: string; percentage: number } | null {
  if (line.length < 8 || line.length > 200) return null;

  const mC = RE_RANK_COL.exec(line);
  if (mC) {
    const name = mC[2].trim();
    const pct = parseFloat(mC[3]);
    if (name.length >= 3 && pct > 0.01 && pct <= 100)
      return { stockName: name, percentage: pct };
  }

  for (const re of [RE_NAME_COL, RE_EXPLICIT_PCT]) {
    const m = re.exec(line);
    if (m) {
      const rawName = m[1];
      const pct = parseFloat(m[2]);
      const name = rawName.replace(/^\d{1,3}[.):\s-]{1,3}/, "").trim();
      if (name.length >= 3 && pct > 0.01 && pct <= 100)
        return { stockName: name, percentage: pct };
    }
  }

  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseFmrText(
  rawText: string,
  fundsToFind: FundDef[],
  fileName: string,
): ParsedFund[] {
  const lines = rawText.split("\n").map((l) => l.replace(/\r/g, "").trim());
  const fundLines = findFundLines(lines, fundsToFind);
  if (fundLines.length === 0) return [];

  const results: ParsedFund[] = [];

  for (let fi = 0; fi < fundLines.length; fi++) {
    const { fundDef, lineIdx } = fundLines[fi];
    const sectionEnd =
      fi + 1 < fundLines.length ? fundLines[fi + 1].lineIdx : lines.length;

    // Find equity table start within the section
    let tableStart = -1;
    let tableEnd = sectionEnd;

    for (let i = lineIdx; i < sectionEnd; i++) {
      const ll = lines[i].toLowerCase();

      if (tableStart === -1) {
        if (EQUITY_TABLE_STARTS.some((h) => ll.includes(h))) {
          tableStart = i + 2; // skip the header + column-label row
        }
      } else if (TABLE_END_MARKERS.some((e) => ll.includes(e))) {
        tableEnd = i;
        break;
      }
    }

    const scanFrom = tableStart >= 0 ? tableStart : lineIdx + 1;
    const holdings: ParsedHolding[] = [];
    const seen = new Set<string>();

    for (let i = scanFrom; i < tableEnd; i++) {
      const line = lines[i];
      if (!line) continue;

      const ll = line.toLowerCase();

      // Skip column header lines
      if (SKIP_HEADER_WORDS.some((w) => ll.includes(w))) continue;
      // Skip total / subtotal lines
      if (/\btotal\b|\bsub.?total\b/.test(ll)) break;
      // Stop at non-equity table markers
      if (TABLE_END_MARKERS.some((e) => ll.includes(e))) break;

      const h = parseHoldingLine(line);
      if (h) {
        const key = h.stockName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          holdings.push({ ...h, symbol: null });
        }
      }
    }

    // Sanity check: at least 2 holdings and plausible total
    if (holdings.length >= 2) {
      const total = holdings.reduce((s, h) => s + h.percentage, 0);
      if (total >= 3 && total <= 110) {
        results.push({ fundName: fundDef.name, holdings, fileName });
      }
    }
  }

  return results;
}
