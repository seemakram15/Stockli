import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function MFTopHoldingsLoading() {
  return <PageLoadingState message="Loading top holdings by mutual funds..." variant="list" />;
}
