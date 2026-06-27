import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function StockFundamentalsLoading() {
  return <PageLoadingState message="Loading fundamentals..." variant="fundamentals" />;
}
