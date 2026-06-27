import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function MarketStrategyLoading() {
  return <PageLoadingState message="Loading funds daily returns report..." variant="strategy" />;
}
