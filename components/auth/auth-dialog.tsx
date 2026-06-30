"use client";

import * as React from "react";
import { BellRing, CalendarRange, Wallet, XIcon } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { StockliGlyph } from "@/components/logo";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APP_NAME } from "@/lib/constants";

type AuthMode = "login" | "signup";

const AUTH_COPY: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: "Welcome back",
    description: "Sign in to open your portfolio dashboard.",
  },
  signup: {
    title: `Create your ${APP_NAME} account`,
    description: "Start tracking portfolios, P/L calendars, alerts and market movement.",
  },
};

const PERKS = [
  { icon: Wallet, label: "Live P/L" },
  { icon: CalendarRange, label: "Daily calendars" },
  { icon: BellRing, label: "Price alerts" },
];

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
    <div>
      {/* Branded banner (full-bleed to the dialog edges) */}
      <div className="relative -mx-4 -mt-4 overflow-hidden rounded-t-xl bg-gradient-to-br from-[#06120f] via-[#0c241d] to-[#0a2030] px-5 pb-6 pt-7 text-white">
        <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid-faint opacity-40 [mask-image:radial-gradient(70%_70%_at_30%_0%,black,transparent)]" />

        <DialogClose className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-white/70 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <span className="relative flex size-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
          <StockliGlyph className="size-8" />
        </span>

        <DialogHeader className="relative mt-4 space-y-1.5">
          <DialogTitle className="text-xl font-semibold text-white">
            {AUTH_COPY[mode].title}
          </DialogTitle>
          <DialogDescription className="text-sm text-white/65">
            {AUTH_COPY[mode].description}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {PERKS.map((perk) => (
            <span
              key={perk.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85"
            >
              <perk.icon className="size-3 text-emerald-300" />
              {perk.label}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-5">
        <AuthForm
          key={mode}
          mode={mode}
          redirectTo={redirectTo}
          demo={demo}
          onModeChange={onModeChange}
        />
      </div>
    </div>
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
      <DialogContent showCloseButton={false} className="overflow-hidden sm:max-w-md">
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
