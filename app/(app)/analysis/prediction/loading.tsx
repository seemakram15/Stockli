import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function PredictionLoading() {
  return <PageLoadingState message="Fusing live market signals..." variant="list" />;
}
