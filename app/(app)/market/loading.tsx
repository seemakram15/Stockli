import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function MarketLoading() {
  return <PageLoadingState message="Loading market overview..." variant="market" />;
}
