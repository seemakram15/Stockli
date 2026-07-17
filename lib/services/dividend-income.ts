import "server-only";
import type {
  Transaction,
  Holding,
  TaxSettings,
  ReceivedDividend,
  UpcomingDividend,
  DividendIncomeSummary,
} from "@/lib/types";
import type { DividendHistoryRow, BookClosureRow } from "@/lib/services/market-resources";
import { calcDividendTaxes } from "@/lib/services/tax";

function parsePayout(raw: string): number {
  const match = raw.replace(/,/g, "").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export function getHoldingQtyAtDate(
  transactions: Transaction[],
  symbol: string,
  date: string
): number {
  return transactions
    .filter((t) => t.symbol.toUpperCase() === symbol.toUpperCase() && t.transacted_at <= date)
    .sort((a, b) => a.transacted_at.localeCompare(b.transacted_at))
    .reduce((qty, t) => {
      if (t.type === "BUY") return qty + Number(t.quantity);
      if (t.type === "SELL") return qty - Number(t.quantity);
      return qty;
    }, 0);
}

export function getDividendIncomeForPortfolio(
  transactions: Transaction[],
  dividendHistory: DividendHistoryRow[],
  bookClosures: BookClosureRow[],
  currentHoldings: Holding[],
  settings: TaxSettings
): DividendIncomeSummary {
  const everHeldSymbols = new Set(transactions.map((t) => t.symbol.toUpperCase()));

  const received: ReceivedDividend[] = dividendHistory
    .filter((d) => everHeldSymbols.has(d.symbol.toUpperCase()))
    .flatMap((d) => {
      const perShare = parsePayout(d.payout);
      if (perShare <= 0) return [];
      const qty = getHoldingQtyAtDate(transactions, d.symbol, d.creditedOn);
      if (qty <= 0) return [];
      const gross = qty * perShare;
      const { wht, zakat, net } = calcDividendTaxes(gross, settings);
      return [
        {
          symbol: d.symbol.toUpperCase(),
          creditedOn: d.creditedOn,
          perShare,
          quantityHeld: qty,
          grossAmount: gross,
          whtAmount: wht,
          zakatAmount: zakat,
          netAmount: net,
        } satisfies ReceivedDividend,
      ];
    })
    .sort((a, b) => b.creditedOn.localeCompare(a.creditedOn));

  const heldSymbols = new Set(currentHoldings.map((h) => h.symbol.toUpperCase()));
  const upcoming: UpcomingDividend[] = bookClosures
    .filter((bc) => heldSymbols.has(bc.symbol.toUpperCase()) && bc.payout)
    .map((bc) => {
      const holding = currentHoldings.find(
        (h) => h.symbol.toUpperCase() === bc.symbol.toUpperCase()
      );
      return {
        symbol: bc.symbol.toUpperCase(),
        company: bc.company,
        payout: bc.payout,
        bookClosureFrom: bc.bookClosureFrom,
        bookClosureTo: bc.bookClosureTo,
        currentQty: Number(holding?.quantity ?? 0),
      } satisfies UpcomingDividend;
    });

  const totalGross = received.reduce((s, r) => s + r.grossAmount, 0);
  const totalWHT = received.reduce((s, r) => s + r.whtAmount, 0);
  const totalZakat = received.reduce((s, r) => s + r.zakatAmount, 0);
  const totalNet = received.reduce((s, r) => s + r.netAmount, 0);

  return { received, upcoming, totalGross, totalWHT, totalZakat, totalNet };
}
