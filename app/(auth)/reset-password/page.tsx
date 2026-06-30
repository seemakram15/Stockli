import Link from "next/link";
import { AlertCircle, KeyRound } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Card className="w-full max-w-lg border-primary/15 shadow-xl">
      <CardHeader className="gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <KeyRound className="size-5" />
        </span>
        <div>
          <CardTitle className="text-2xl font-semibold">Set a new password</CardTitle>
          <CardDescription className="mt-1">
            Create a fresh password to secure your Stockli account.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {user ? (
          <ResetPasswordForm email={user.email ?? null} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 p-4 text-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
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
      </CardContent>
    </Card>
  );
}
