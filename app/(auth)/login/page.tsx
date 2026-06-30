import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { AuthScreen } from "@/components/auth/auth-screen";
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
  }>;
}) {
  const { redirectTo, authError, authMessage, authEmail } = await searchParams;

  return (
    <div>
      <div className="mb-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30">
          <LogIn className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to open your {APP_NAME} portfolio dashboard.
        </p>
      </div>
      <AuthScreen
        mode="login"
        redirectTo={redirectTo}
        demo={isDemoMode}
        initialState={{ error: authError, message: authMessage, email: authEmail }}
      />
    </div>
  );
}
