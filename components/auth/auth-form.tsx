"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  User,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  resendSignupConfirmation,
  signIn,
  signUp,
  type AuthState,
} from "@/lib/actions/auth";

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
  initialState,
}: {
  mode: "login" | "signup" | "forgot-password";
  redirectTo?: string;
  demo?: boolean;
  onModeChange?: (mode: "login" | "signup" | "forgot-password") => void;
  initialState?: AuthState;
}) {
  const action =
    mode === "login" ? signIn : mode === "signup" ? signUp : requestPasswordReset;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    initialState ?? {}
  );
  const [showPassword, setShowPassword] = React.useState(false);

  if (mode === "signup" && state.nextStep === "confirm-signup" && state.email) {
    return (
      <SignupConfirmationView
        email={state.email}
        message={state.message}
        error={state.error}
        demo={demo}
        onModeChange={onModeChange}
      />
    );
  }

  if (mode === "forgot-password" && state.nextStep === "reset-email-sent" && state.email) {
    return (
      <ResetRequestSentView
        email={state.email}
        message={state.message}
        onModeChange={onModeChange}
      />
    );
  }

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

      {mode !== "forgot-password" && (
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
      )}

      {mode === "login" ? (
        <div className="flex justify-end">
          {onModeChange ? (
            <button
              type="button"
              onClick={() => onModeChange("forgot-password")}
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          ) : (
            <Link href="/forgot-password" className="text-sm font-medium text-foreground hover:underline">
              Forgot password?
            </Link>
          )}
        </div>
      ) : null}

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
        {mode === "login"
          ? "Sign in"
          : mode === "signup"
            ? "Create account"
            : "Send reset link"}
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
        ) : mode === "forgot-password" ? (
          <>
            Remembered your password?{" "}
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

function SignupConfirmationView({
  email,
  message,
  error,
  demo,
  onModeChange,
}: {
  email: string;
  message?: string;
  error?: string;
  demo?: boolean;
  onModeChange?: (mode: "login" | "signup" | "forgot-password") => void;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    resendSignupConfirmation,
    {}
  );

  const note = state.message ?? message;
  const issue = state.error ?? error;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Confirm your email address</p>
            <p className="mt-1 text-muted-foreground">
              We sent a secure confirmation link to <span className="font-medium text-foreground">{email}</span>.
            </p>
            {note ? <p className="mt-2 text-muted-foreground">{note}</p> : null}
          </div>
        </div>
      </div>

      {issue ? (
        <p className="flex items-start gap-2 rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {issue}
        </p>
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="outline" className="h-11 w-full gap-2" disabled={pending || demo}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Resend confirmation email
        </Button>
      </form>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          onClick={() => onModeChange?.("signup")}
        >
          Use another email
        </Button>
        <Button
          type="button"
          className="h-11"
          onClick={() => onModeChange?.("login")}
        >
          I already confirmed
        </Button>
      </div>
    </div>
  );
}

function ResetRequestSentView({
  email,
  message,
  onModeChange,
}: {
  email: string;
  message?: string;
  onModeChange?: (mode: "login" | "signup" | "forgot-password") => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <KeyRound className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Check your email</p>
            <p className="mt-1 text-muted-foreground">
              Password reset instructions were sent for <span className="font-medium text-foreground">{email}</span>.
            </p>
            {message ? <p className="mt-2 text-muted-foreground">{message}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => onModeChange?.("forgot-password")}
        >
          Send another link
        </Button>
        <Button type="button" className="h-11" onClick={() => onModeChange?.("login")}>
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
