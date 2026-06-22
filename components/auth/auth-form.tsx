"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

export function AuthForm({
  mode,
  redirectTo,
  demo,
  onModeChange,
}: {
  mode: "login" | "signup";
  redirectTo?: string;
  demo?: boolean;
  onModeChange?: (mode: "login" | "signup") => void;
}) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Name</Label>
          <Input id="displayName" name="displayName" placeholder="Asad Khan" autoComplete="name" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </div>

      {state.error && (
        <p className="flex items-start gap-2 rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="flex items-start gap-2 rounded-lg bg-gain/10 px-3 py-2 text-sm text-gain">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>

      {demo && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted-foreground">
          Running in demo mode — auth is disabled. You can{" "}
          <Link href="/dashboard" className="font-medium text-primary underline-offset-2 hover:underline">
            open the demo dashboard
          </Link>{" "}
          without an account.
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            {onModeChange ? (
              <button
                type="button"
                onClick={() => onModeChange("signup")}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Create an account
              </button>
            ) : (
              <Link href="/signup" className="font-medium text-foreground hover:underline">
                Create an account
              </Link>
            )}
          </>
        ) : (
          <>
            Already have an account?{" "}
            {onModeChange ? (
              <button
                type="button"
                onClick={() => onModeChange("login")}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Sign in
              </button>
            ) : (
              <Link href="/login" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            )}
          </>
        )}
      </p>
    </form>
  );
}
