import { PageLoadingState } from "@/components/loading/page-loading-state";

export default function AdminUserLoading() {
  return <PageLoadingState message="Loading user account..." variant="admin-user" />;
}
