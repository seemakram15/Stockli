"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DesktopNav } from "@/components/shell/desktop-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { RouteTransitionProvider } from "@/components/navigation/route-transition-provider";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export function LandingHeader({
  authed,
  displayName,
  isGuest = false,
  guestPageAccess = null,
}: {
  authed: boolean;
  displayName?: string | null;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
}) {
  const initials = (displayName || "You")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <RouteTransitionProvider>
      <header className="fixed inset-x-0 top-0 z-[120] flex h-16 min-w-0 items-center gap-1.5 border-b border-border bg-background/85 px-3 backdrop-blur-xl sm:gap-2 sm:px-6 lg:gap-3 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MobileNav isGuest={isGuest} guestPageAccess={guestPageAccess} />
          <Link href="/" aria-label={`${APP_NAME} home`} className="hidden shrink-0 lg:flex">
            <Logo beta />
          </Link>
          <div className="hidden h-8 w-px shrink-0 bg-border lg:block" />
          <DesktopNav isGuest={isGuest} guestPageAccess={guestPageAccess} />
          <div className="hidden min-w-0 flex-1 lg:block" />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {authed ? (
            <>
              <Button
                asChild
                size="sm"
                className="hidden gap-1.5 bg-emerald-500 text-white hover:bg-emerald-400 sm:inline-flex"
              >
                <Link href="/portfolios">
                  <LayoutDashboard className="size-4" /> Portfolio
                </Link>
              </Button>
              <Link
                href="/portfolios"
                aria-label="Open portfolio"
                className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-xs font-semibold text-white shadow-sm"
              >
                {initials}
              </Link>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-300"
              >
                <Link href="/signup">
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>
    </RouteTransitionProvider>
  );
}
