import { redirect } from "next/navigation";

export default async function AdminUserRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/control-panel/users/${id}`);
}
