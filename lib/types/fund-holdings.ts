export interface FundPeriodStatus {
  year: number;
  month: number;
  status: "draft" | "published";
}

export interface FundHolding {
  id: number;
  symbol: string | null;
  stockName: string;
  percentage: number;
  rank: number | null;
  status: "draft" | "published";
}

export interface SaveHoldingInput {
  symbol: string | null;
  stockName: string;
  percentage: number;
}
