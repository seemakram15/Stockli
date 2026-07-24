import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function AdminFundHoldingsLoading() {
  return <PageLoadingState message="Loading fund holdings..." variant="admin" />;
}
