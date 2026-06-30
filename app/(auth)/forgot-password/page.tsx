import { redirect } from "next/navigation";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    authError?: string;
    authMessage?: string;
    authEmail?: string;
  }>;
}) {
  const { authError, authMessage, authEmail } = await searchParams;
  const params = new URLSearchParams({ auth: "forgot-password" });
  if (authError) params.set("authError", authError);
  if (authMessage) params.set("authMessage", authMessage);
  if (authEmail) params.set("authEmail", authEmail);

  redirect(`/?${params.toString()}`);
}
