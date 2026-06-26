"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthDialogPanel } from "@/components/auth/auth-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type AuthMode = "login" | "signup";

function parseAuthMode(value: string | null): AuthMode | null {
  if (value === "login" || value === "signup") return value;
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

  React.useEffect(() => {
    if (!urlMode) return;
    setMode(urlMode);
    setOpen(true);
  }, [urlMode]);

  function clearAuthQuery() {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    nextParams.delete("auth");
    nextParams.delete("redirectTo");

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) clearAuthQuery();
  }

  return (
    <Dialog open={open && Boolean(urlMode)} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AuthDialogPanel
          mode={mode}
          redirectTo={redirectTo}
          demo={demo}
          onModeChange={setMode}
        />
      </DialogContent>
    </Dialog>
  );
}
