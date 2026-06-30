import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = { title: "Reset your password" };

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

  return (
    <div>
      <div className="mb-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-lg shadow-amber-500/30">
          <KeyRound className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll email a secure password reset link to your inbox.
        </p>
      </div>
      <AuthScreen
        mode="forgot-password"
        demo={isDemoMode}
        initialState={{ error: authError, message: authMessage, email: authEmail }}
      />
    </div>
  );
}
