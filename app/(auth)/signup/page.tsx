import { redirect } from "next/navigation";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const params = new URLSearchParams({ auth: "signup" });
  if (redirectTo) params.set("redirectTo", redirectTo);

  redirect(`/?${params.toString()}`);
}
