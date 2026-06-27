import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function EtfDetailLoading() {
  return <PageLoadingState message="Loading ETF profile..." variant="fund-detail" />;
}
