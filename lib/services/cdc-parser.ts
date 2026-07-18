import type { CdcParsedData } from "@/lib/types";

function parsePkrNumber(raw: string): number {
  return parseFloat(raw.replace(/,/g, "").trim()) || 0;
}

function normalizeDateStr(d: string): string {
  const match = d.match(/^(\d{1,2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return d;
}

export function parseCdcText(rawText: string): Omit<CdcParsedData, "symbol" | "symbolConfidence"> | null {
  // unpdf extracts text as flat space-separated — normalize to single spaces
  const text = rawText.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");

  // Company name: all-caps block before "DIVIDEND / ZAKAT"
  const companyMatch = text.match(/([A-Z][A-Z0-9\s\(\)&\-\.,]+?)\s+DIVIDEND\s*[\/\\]\s*ZAKAT/);
  if (!companyMatch) return null;
  const companyName = companyMatch[1].trim();

  // Issue date & financial year — values follow the column header block
  // e.g. "Date of Issue Financial Year Rate Per Security ZCCA Code Asset Code 07-11-2025 2024-25 Rs. 5.0000"
  const dateHeaderMatch = text.match(/Date of Issue\s+Financial Year[^0-9]*(\d{1,2}-\d{2}-\d{4})\s+(\S+)/);
  let issueDate = "";
  let financialYear = "";
  if (dateHeaderMatch) {
    issueDate = normalizeDateStr(dateHeaderMatch[1]);
    financialYear = dateHeaderMatch[2];
  }

  // Rate per security — Rs. value on the same block
  const rateMatch = text.match(/Date of Issue.*?Rs\.\s*([\d,]+\.?\d*)/);
  const ratePerSecurity = rateMatch ? parsePkrNumber(rateMatch[1]) : 0;

  // Warrant no & no. of securities
  // e.g. "Warrant No. No. of Securities Securities Liable to Zakat 95042528 20 20"
  const warrantMatch = text.match(/Warrant No\.\s+No\. of Securities[^0-9]*(\d+)\s+(\d+)/);
  let warrantNo = "";
  let noOfSecurities = 0;
  if (warrantMatch) {
    warrantNo = warrantMatch[1];
    noOfSecurities = parseInt(warrantMatch[2], 10) || 0;
  }

  // Gross amount — two numbers follow: [securities-not-liable-count] [dividend-amount]
  // e.g. "Securities not Liable to Zakat Amount of Dividend (Rs.) 0 100.00"
  const grossMatch = text.match(/Amount of Dividend \(Rs\.\)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
  let grossAmount = 0;
  if (grossMatch) {
    grossAmount = parsePkrNumber(grossMatch[2]);
  }

  // Zakat & tax deducted
  // e.g. "Zakat Deducted (Rs.) Tax Deducted (Rs.) 0.00 30.00"
  const zakatTaxMatch = text.match(/Zakat Deducted \(Rs\.\)\s+Tax Deducted \(Rs\.\)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/);
  let zakatDeducted = 0;
  let taxDeducted = 0;
  if (zakatTaxMatch) {
    zakatDeducted = parsePkrNumber(zakatTaxMatch[1]);
    taxDeducted = parsePkrNumber(zakatTaxMatch[2]);
  }

  // Net amount paid
  const netMatch = text.match(/Amount Paid \(Rs\.\)\s+([\d,]+\.?\d*)/);
  const netAmount = netMatch ? parsePkrNumber(netMatch[1]) : 0;

  // Payment status & date
  // e.g. "Payment Status Payment Date Paid 10-11-2025"
  const paymentMatch = text.match(/Payment Status\s+Payment Date\s+(\S+)\s+(\d{1,2}-\d{2}-\d{4})/);
  let paymentStatus = "Paid";
  let paymentDate = "";
  if (paymentMatch) {
    paymentStatus = paymentMatch[1];
    paymentDate = normalizeDateStr(paymentMatch[2]);
  }

  if (!paymentDate || !companyName) return null;

  return {
    companyName,
    warrantNo,
    issueDate,
    paymentDate,
    financialYear,
    ratePerSecurity,
    noOfSecurities,
    grossAmount,
    zakatDeducted,
    taxDeducted,
    netAmount,
    paymentStatus,
  };
}
