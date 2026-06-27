import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function PortfolioLoading() {
  return <PageLoadingState message="Loading portfolio details..." variant="portfolio-detail" />;
}
