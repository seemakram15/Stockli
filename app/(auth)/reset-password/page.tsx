import Link from "next/link";
import { AlertCircle, KeyRound } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthCardShell } from "@/components/auth/auth-card-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthCardShell
      accent="primary"
      brandSurface="auth-reset"
      icon={<KeyRound />}
      title="Set a new password"
      description="Create a fresh password to secure your MyStockli account."
    >
      {user ? (
        <ResetPasswordForm email={user.email ?? null} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <AlertCircle className="size-4" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Reset link unavailable</p>
                <p className="mt-1 text-muted-foreground">
                  This password reset link is missing, expired, or was already used. Request a fresh one to continue.
                </p>
              </div>
            </div>
          </div>
          <Button asChild className="h-11 w-full">
            <Link href="/forgot-password">Request a new reset link</Link>
          </Button>
        </div>
      )}
    </AuthCardShell>
  );
}
