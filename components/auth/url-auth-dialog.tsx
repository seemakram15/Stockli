"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthDialogPanel } from "@/components/auth/auth-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { AuthState } from "@/lib/actions/auth";

type AuthMode = "login" | "signup" | "forgot-password";

function parseAuthMode(value: string | null): AuthMode | null {
  if (value === "login" || value === "signup" || value === "forgot-password") return value;
  return null;
}

export function UrlAuthDialog({ demo }: { demo?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const urlMode = parseAuthMode(searchParams?.get("auth") ?? null);
  const [mode, setMode] = React.useState<AuthMode>(urlMode ?? "login");
  const [open, setOpen] = React.useState(Boolean(urlMode));
  const redirectTo = searchParams?.get("redirectTo") ?? undefined;
  const initialState = React.useMemo<AuthState>(
    () => ({
      error: searchParams?.get("authError") ?? undefined,
      message: searchParams?.get("authMessage") ?? undefined,
      email: searchParams?.get("authEmail") ?? undefined,
    }),
    [searchParams]
  );

  React.useEffect(() => {
    if (!urlMode) return;
    setMode(urlMode);
    setOpen(true);
  }, [urlMode]);

  function clearAuthQuery() {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    nextParams.delete("auth");
    nextParams.delete("redirectTo");
    nextParams.delete("authError");
    nextParams.delete("authMessage");
    nextParams.delete("authEmail");

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) clearAuthQuery();
  }

  return (
    <Dialog open={open && Boolean(urlMode)} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className="overflow-hidden sm:max-w-md">
        <AuthDialogPanel
          mode={mode}
          redirectTo={redirectTo}
          demo={demo}
          onModeChange={setMode}
          initialState={initialState}
        />
      </DialogContent>
    </Dialog>
  );
}
