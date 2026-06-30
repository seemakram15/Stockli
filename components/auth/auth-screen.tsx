"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import type { AuthState } from "@/lib/actions/auth";

type AuthMode = "login" | "signup" | "forgot-password";

/**
 * Page-mode wrapper around <AuthForm>. Mode switches (and the confirmation /
 * reset-sent views) navigate between the dedicated /login, /signup and
 * /forgot-password screens instead of swapping content inside a dialog.
 */
export function AuthScreen({
  mode,
  redirectTo,
  demo,
  initialState,
}: {
  mode: AuthMode;
  redirectTo?: string;
  demo?: boolean;
  initialState?: AuthState;
}) {
  const router = useRouter();

  function go(next: AuthMode) {
    const qs = next === "login" && redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";
    router.push(`/${next}${qs}`);
  }

  return (
    <AuthForm
      mode={mode}
      redirectTo={redirectTo}
      demo={demo}
      initialState={initialState}
      onModeChange={go}
    />
  );
}
