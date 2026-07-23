/**
 * Broker Statement of Account parser.
 * Tuned for PSX broker SOA PDFs (e.g. Khanani Securities) whose narrations look like:
 *   T+1 BUY # 1091163 FFC 35 @ 576.07
 *   T+1 SELL # 870183 PSO 356 @ 352.75
 *
 * Files are never stored — only in-memory text extraction.
 */

export type StatementTradeSide = "BUY" | "SELL";

export interface ParsedStatementTrade {
  /** Stable client key for editing rows. */
  key: string;
  side: StatementTradeSide;
  symbol: string;
  companyName: string;
  quantity: number;
  price: number;
  /** Broker / misc fees attributed to this trade (editable). */
  fees: number;
  /** Tax / CGT attributed to this trade (editable; folded into fees on import). */
  tax: number;
  /** quantity × price */
  tradeValue: number;
  /** YYYY-MM-DD when known */
  date: string;
  orderRef: string;
  note: string;
  confidence: "high" | "medium" | "low";
  rawNarration: string;
}

export interface ParsedStatementCharge {
  key: string;
  label: string;
  amount: number;
  kind: "custody" | "sms" | "cgt" | "other";
  rawNarration: string;
}

export interface ParsedBrokerStatement {
  brokerName: string | null;
  accountLabel: string | null;
  fromDate: string | null;
  toDate: string | null;
  trades: ParsedStatementTrade[];
  charges: ParsedStatementCharge[];
  warnings: string[];
}

function parsePkrNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, "").trim()) || 0;
}

/** DD-MM-YY or DD-MM-YYYY → YYYY-MM-DD */
export function normalizeStatementDate(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}|\d{4})$/);
  if (!m) return "";
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (year.length === 2) {
    const n = parseInt(year, 10);
    year = String(n >= 70 ? 1900 + n : 2000 + n);
  }
  return `${year}-${month}-${day}`;
}

function flattenText(raw: string): string {
  return raw.replace(/\u00a0/g, " ").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

const TRADE_RE =
  /\b(?:T\s*\+\s*\d+\s+)?(BUY|SELL)\s*#\s*(\d+)\s+([A-Z][A-Z0-9.&-]{0,19})\s+(\d+(?:\.\d+)?)\s*@\s*(\d+(?:\.\d+)?)/gi;

const CHARGE_PATTERNS: Array<{ kind: ParsedStatementCharge["kind"]; re: RegExp }> = [
  { kind: "custody", re: /(?:NORMAL\s+SHAREHOLDER\s+)?CUSTODY\s+FEE[^0-9]{0,40}/i },
  { kind: "sms", re: /SMS\s+CHARGES[^0-9]{0,60}/i },
  { kind: "cgt", re: /CGT\s+TARIFF[^0-9]{0,40}/i },
];

/** Inventory block often lists full names then symbols — use for company labels. */
function extractCompanyMap(text: string): Map<string, string> {
  const map = new Map<string, string>();

  // Tight, non-greedy patterns — never swallow the next company name.
  const nameHints: Array<[RegExp, string]> = [
    [/FAUJI\s+FERTILIZER(?:\s+COMPANY)?(?:\s+LIMITED)?\.?/i, "FFC"],
    [/THE\s+HUB\s+POWER(?:\s+COMPANY)?(?:\s+LIMITED)?\.?/i, "HUBC"],
    [/HUB\s+POWER(?:\s+COMPANY)?(?:\s+LIMITED)?\.?/i, "HUBC"],
    [/LUCKY\s+CEMENT(?:\s+LIMITED)?\.?/i, "LUCK"],
    [/MEEZAN\s+BANK(?:\s+LTD\.?|\s+LIMITED)?\.?/i, "MEBL"],
    [/OIL\s*&\s*GAS\s+DEV(?:ELOPMENT)?(?:\.?\s*CO(?:MPANY)?)?(?:\s+LIMITED)?\.?/i, "OGDC"],
    [/PAK(?:ISTAN)?\s+PETROLEUM(?:\s+LTD\.?|\s+LIMITED)?\.?/i, "PPL"],
    [/SYSTEMS?(?:\s+LIMITED)?\.?/i, "SYS"],
    [/PAKISTAN\s+STATE\s+OIL(?:\s+CO(?:MPANY)?)?(?:\s+LIMITED)?\.?/i, "PSO"],
  ];
  for (const [re, sym] of nameHints) {
    const m = text.match(re);
    if (m) {
      const name = cleanCompanyName(m[0]);
      if (name) map.set(sym, name);
    }
  }

  // Prefer ordered inventory: "... LIMITED. ... LIMITED FFC HUBC LUCK ..."
  const inv = text.match(
    /((?:[A-Z][A-Z0-9\s.&'/()-]+?(?:LIMITED|LTD\.?)\.?\s*){2,})\s+((?:[A-Z]{2,12}\s+){2,}[A-Z]{2,12})\b/
  );
  if (inv) {
    const nameBlob = inv[1];
    const symbols = inv[2].trim().split(/\s+/).filter((s) => /^[A-Z]{2,12}$/.test(s));
    const names = nameBlob
      .split(/(?<=LIMITED|LTD\.?)\.?\s+/i)
      .map((n) => cleanCompanyName(n))
      .filter(Boolean);
    if (names.length === symbols.length) {
      for (let i = 0; i < symbols.length; i++) {
        map.set(symbols[i], names[i]);
      }
    }
  }

  return map;
}

function cleanCompanyName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").replace(/\.+$/, "").trim();
  // Reject concatenated multi-company blobs
  const limitedHits = (name.match(/\bLIMITED\b|\bLTD\b/gi) ?? []).length;
  if (limitedHits > 1 || name.length > 72) return "";
  if ((name.match(/\bCOMPANY\b/gi) ?? []).length > 1 && limitedHits >= 1 && name.includes(" THE ")) {
    return "";
  }
  return name;
}

function sanitizeTradeCompanyNames(trades: ParsedStatementTrade[]): void {
  for (const t of trades) {
    t.companyName = cleanCompanyName(t.companyName || "");
  }
}

function extractBrokerName(text: string): string | null {
  const m =
    text.match(/([A-Z][A-Z0-9\s.&'-]{6,80}?SECURITIES(?:\s+(?:LTD|LIMITED))?)/i) ||
    text.match(/Statement\s+Of\s+Account\s+(.+?SECURITIES[A-Z\s.]*)/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

function extractAccountLabel(text: string): string | null {
  const m = text.match(/CDC\s*Id\s*:\s*([0-9-]+)/i) || text.match(/\b([A-Z][A-Z\s]{2,40})\s+CDC\s*Id/i);
  if (m && m[0].includes("CDC")) {
    const name = text.match(/([A-Z][A-Z\s.]{2,40})\s+CDC\s*Id/i);
    const id = text.match(/CDC\s*Id\s*:\s*([0-9-]+)/i);
    if (name && id) return `${name[1].trim()} (${id[1]})`;
    if (id) return `CDC ${id[1]}`;
  }
  return null;
}

/**
 * Collect short dates in document order (before inventory fluff when possible).
 * Used as a best-effort chronological assignment to trades.
 */
function extractOrderedDates(text: string): string[] {
  const cut = text.search(/Inventory\s+Position|Closing\s+Rate\s+As\s+On|Item\s+Symbol/i);
  const region = cut > 0 ? text.slice(0, cut) : text;
  const dates: string[] = [];
  const re = /\b(\d{1,2}-\d{2}-\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(region))) {
    const iso = normalizeStatementDate(m[1]);
    if (iso) dates.push(iso);
  }
  return dates;
}

function extractChargeAmounts(text: string, charges: ParsedStatementCharge[]): void {
  // After charge labels, amounts often appear later as bare numbers — best effort:
  // look for amount immediately after a charge phrase when present.
  for (const charge of charges) {
    const escaped = charge.rawNarration.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const near = text.match(new RegExp(`${escaped}[^0-9]{0,30}([\\d,]+\\.\\d{2})`, "i"));
    if (near) charge.amount = parsePkrNumber(near[1]);
  }
}

export function parseBrokerStatementText(rawText: string): ParsedBrokerStatement {
  const text = flattenText(rawText);
  const warnings: string[] = [];
  const companyMap = extractCompanyMap(text);
  const brokerName = extractBrokerName(text);
  const accountLabel = extractAccountLabel(text);

  const fromMatch = text.match(/From\s*Date\s*:?\s*(\d{1,2}-\d{2}-\d{2,4})/i);
  const toMatch = text.match(/To\s*Date\s*:?\s*(\d{1,2}-\d{2}-\d{2,4})/i);
  // Sometimes dates precede the labels
  let fromDate = fromMatch ? normalizeStatementDate(fromMatch[1]) : null;
  let toDate = toMatch ? normalizeStatementDate(toMatch[1]) : null;
  if (!fromDate || !toDate) {
    const pair = text.match(/(\d{1,2}-\d{2}-\d{4})\s+(\d{1,2}-\d{2}-\d{4})\s+From\s*Date/i);
    if (pair) {
      fromDate = normalizeStatementDate(pair[1]);
      toDate = normalizeStatementDate(pair[2]);
    }
  }

  const trades: ParsedStatementTrade[] = [];
  let tradeIdx = 0;
  TRADE_RE.lastIndex = 0;
  let tm: RegExpExecArray | null;
  while ((tm = TRADE_RE.exec(text))) {
    const side = tm[1].toUpperCase() as StatementTradeSide;
    const orderRef = tm[2];
    const symbol = tm[3].toUpperCase();
    const quantity = parseFloat(tm[4]);
    const price = parseFloat(tm[5]);
    if (!(quantity > 0) || !(price >= 0) || !symbol) continue;
    const tradeValue = Math.round(quantity * price * 100) / 100;
    trades.push({
      key: `t-${tradeIdx++}-${side}-${symbol}-${orderRef}`,
      side,
      symbol,
      companyName: companyMap.get(symbol) ?? "",
      quantity,
      price,
      fees: 0,
      tax: 0,
      tradeValue,
      date: "",
      orderRef,
      note: `${side} #${orderRef}`,
      confidence: "high",
      rawNarration: tm[0].replace(/\s+/g, " ").trim(),
    });
  }

  if (!trades.length) {
    warnings.push(
      "No BUY/SELL lines matched. This importer expects broker Statement of Account narrations like “T+1 BUY # 123456 FFC 35 @ 576.07”."
    );
  }

  // Date assignment: skip leading Balance B/F / funding dates when we have more dates than trades
  const orderedDates = extractOrderedDates(text);
  if (trades.length && orderedDates.length) {
    // Prefer trailing N dates matching trade count (effect dates often trail ledger rows)
    let assigned = orderedDates;
    if (orderedDates.length > trades.length) {
      assigned = orderedDates.slice(orderedDates.length - trades.length);
    }
    if (assigned.length >= trades.length) {
      for (let i = 0; i < trades.length; i++) {
        trades[i].date = assigned[i] ?? "";
        if (!trades[i].date) trades[i].confidence = "medium";
      }
    } else if (assigned.length > 0) {
      for (let i = 0; i < assigned.length && i < trades.length; i++) {
        trades[i].date = assigned[i];
      }
      warnings.push("Some trades are missing dates — please fill them in before approving.");
      for (const t of trades) {
        if (!t.date) t.confidence = "medium";
      }
    }
  } else if (trades.length) {
    warnings.push("Could not detect trade dates from the PDF — set dates before approving.");
    for (const t of trades) t.confidence = "medium";
  }

  // Charges (non-trade)
  const charges: ParsedStatementCharge[] = [];
  let chargeIdx = 0;
  for (const { kind, re } of CHARGE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      charges.push({
        key: `c-${chargeIdx++}-${kind}`,
        label: m[0].replace(/\s+/g, " ").trim(),
        amount: 0,
        kind,
        rawNarration: m[0].replace(/\s+/g, " ").trim(),
      });
    }
  }
  extractChargeAmounts(text, charges);

  // Attribute CGT tariff across SELL trades by proceeds share (editable later)
  const cgt = charges.find((c) => c.kind === "cgt" && c.amount > 0);
  if (cgt) {
    const sells = trades.filter((t) => t.side === "SELL");
    const totalProceeds = sells.reduce((s, t) => s + t.tradeValue, 0);
    if (sells.length && totalProceeds > 0) {
      let allocated = 0;
      sells.forEach((t, i) => {
        const share =
          i === sells.length - 1
            ? Math.round((cgt.amount - allocated) * 100) / 100
            : Math.round((cgt.amount * (t.tradeValue / totalProceeds)) * 100) / 100;
        t.tax = share;
        allocated += share;
      });
      warnings.push(
        `Allocated CGT tariff ${cgt.amount.toFixed(2)} across ${sells.length} sell trade(s). Adjust per row if needed.`
      );
    }
  }

  sanitizeTradeCompanyNames(trades);

  return {
    brokerName,
    accountLabel,
    fromDate,
    toDate,
    trades,
    charges,
    warnings,
  };
}
