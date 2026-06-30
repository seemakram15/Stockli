"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp, type AuthState } from "@/lib/actions/auth";

function Field({
  label,
  htmlFor,
  icon: Icon,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}

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
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      {mode === "signup" && (
        <Field label="Name" htmlFor="displayName" icon={User}>
          <Input
            id="displayName"
            name="displayName"
            placeholder="Asad Khan"
            autoComplete="name"
            className="h-11 pl-9"
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email" icon={Mail}>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="h-11 pl-9"
        />
      </Field>

      <Field label="Password" htmlFor="password" icon={Lock}>
        <Input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          className="h-11 pl-9 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </Field>

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

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-400 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-500 hover:to-emerald-300 hover:shadow-emerald-500/35"
      >
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
