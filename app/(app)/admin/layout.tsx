import { requireSuperadmin } from "@/lib/auth/roles";

/**
 * Gate for the entire admin area. Non-superadmins get a 404 (route existence
 * is not revealed). Every admin service/action re-checks independently.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperadmin();
  return <>{children}</>;
}
