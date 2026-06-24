"use client";

import * as React from "react";
import { AuthForm } from "@/components/auth/auth-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AuthMode = "login" | "signup";

const AUTH_COPY: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: "Welcome back",
    description: "Sign in to open your portfolio dashboard.",
  },
  signup: {
    title: "Create your Stockli account",
    description: "Start tracking portfolios, P/L calendars, alerts and market movement.",
  },
};

export function AuthDialogPanel({
  mode,
  redirectTo,
  demo,
  onModeChange,
}: {
  mode: AuthMode;
  redirectTo?: string;
  demo?: boolean;
  onModeChange: (mode: AuthMode) => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">{AUTH_COPY[mode].title}</DialogTitle>
        <DialogDescription>{AUTH_COPY[mode].description}</DialogDescription>
      </DialogHeader>
      <AuthForm
        key={mode}
        mode={mode}
        redirectTo={redirectTo}
        demo={demo}
        onModeChange={onModeChange}
      />
    </>
  );
}

export function AuthDialog({
  initialMode,
  redirectTo,
  demo,
  children,
}: {
  initialMode: AuthMode;
  redirectTo?: string;
  demo?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<AuthMode>(initialMode);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setMode(initialMode);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="top-[calc(env(safe-area-inset-top)+5.5rem)] sm:top-[calc(env(safe-area-inset-top)+6.75rem)] sm:max-w-md lg:top-[7.25rem]">
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
