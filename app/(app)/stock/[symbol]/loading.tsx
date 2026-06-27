import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function StockLoading() {
  return <PageLoadingState message="Loading stock details..." variant="stock" />;
}
