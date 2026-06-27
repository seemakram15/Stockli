import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function GlobalMarketLoading() {
  return <PageLoadingState message="Loading market board..." variant="global-market" />;
}
