import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/auth/roles";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

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
