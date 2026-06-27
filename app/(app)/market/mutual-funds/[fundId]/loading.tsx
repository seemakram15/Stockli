import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function MutualFundDetailLoading() {
  return <PageLoadingState message="Loading fund profile..." variant="fund-detail" />;
}
