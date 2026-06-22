import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const params = new URLSearchParams({ auth: "login" });
  if (redirectTo) params.set("redirectTo", redirectTo);

  redirect(`/?${params.toString()}`);
}
