import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isDemoMode } from "@/lib/config";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
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

  return (
    <div>
      <div className="mb-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-400 text-white shadow-lg shadow-sky-500/30">
          <UserPlus className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Create your {APP_NAME} account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start tracking portfolios, P/L calendars, alerts and market movement.
        </p>
      </div>
      <AuthScreen
        mode="signup"
        redirectTo={redirectTo}
        demo={isDemoMode}
        initialState={{ error: authError, message: authMessage, email: authEmail }}
      />
    </div>
  );
}
