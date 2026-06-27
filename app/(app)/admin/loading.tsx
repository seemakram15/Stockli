import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function AdminLoading() {
  return <PageLoadingState message="Loading admin dashboard..." variant="admin" />;
}
