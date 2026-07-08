"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import type { AuthState } from "@/lib/actions/auth";
import { clearPrivateResourceCaches } from "@/lib/hooks/use-persistent-resource";

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
  clearPrivateCachesOnMount = false,
}: {
  mode: AuthMode;
  redirectTo?: string;
  demo?: boolean;
  initialState?: AuthState;
  clearPrivateCachesOnMount?: boolean;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!clearPrivateCachesOnMount) return;
    void clearPrivateResourceCaches({ includeLegacyDeviceCache: true });
  }, [clearPrivateCachesOnMount]);

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
