"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { updatePassword, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm({ email }: { email?: string | null }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  if (state.nextStep === "password-reset-complete") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <CheckCircle2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Password updated</p>
              <p className="mt-1 text-muted-foreground">
                {state.message ?? "Your password is updated and your recovery session is active."}
              </p>
            </div>
          </div>
        </div>

        <Button asChild className="h-11 w-full">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {email ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Resetting password for <span className="font-medium text-foreground">{email}</span>
        </p>
      ) : null}

      <PasswordField
        id="password"
        name="password"
        label="New password"
        autoComplete="new-password"
        placeholder="Minimum 8 characters"
        show={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Re-enter your new password"
        show={showConfirmPassword}
        onToggle={() => setShowConfirmPassword((value) => !value)}
      />

      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 w-full gap-2">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save new password
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  show,
  onToggle,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className="h-11 pl-9 pr-10"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
