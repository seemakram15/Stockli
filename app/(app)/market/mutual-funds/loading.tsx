import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function MutualFundsLoading() {
  return <PageLoadingState message="Loading mutual funds..." variant="list" />;
}
