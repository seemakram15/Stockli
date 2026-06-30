import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirectTo?: string;
    authError?: string;
    authMessage?: string;
    authEmail?: string;
  }>;
}) {
  const { redirectTo, authError, authMessage, authEmail } = await searchParams;
  const params = new URLSearchParams({ auth: "login" });
  if (redirectTo) params.set("redirectTo", redirectTo);
  if (authError) params.set("authError", authError);
  if (authMessage) params.set("authMessage", authMessage);
  if (authEmail) params.set("authEmail", authEmail);

  redirect(`/?${params.toString()}`);
}
