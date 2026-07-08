import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { isDemoMode } from "@/lib/config";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirectTo?: string;
    authError?: string;
    authMessage?: string;
    authEmail?: string;
    accountDeleted?: string;
  }>;
}) {
  const { redirectTo, authError, authMessage, authEmail, accountDeleted } = await searchParams;

  return (
    <AuthCardShell
      accent="primary"
      icon={<LogIn />}
      title="Welcome back"
      description={`Sign in to open your ${APP_NAME} portfolio dashboard.`}
    >
      <AuthScreen
        mode="login"
        redirectTo={redirectTo}
        demo={isDemoMode}
        clearPrivateCachesOnMount={accountDeleted === "1"}
        initialState={{ error: authError, message: authMessage, email: authEmail }}
      />
    </AuthCardShell>
  );
}
