"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useRouteTransition } from "@/components/navigation/route-transition-provider";
import { Logo } from "@/components/logo";
import { NavLinks } from "./nav-links";
import { InstallAppButton } from "@/components/pwa/install-app-button";

export function MobileNav({
  showAdmin = false,
  isGuest,
  guestPageAccess,
}: {
  showAdmin?: boolean;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { beginNavigation } = useRouteTransition();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="z-[130] flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0 p-0"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 pb-5 pt-[max(1.5rem,calc(0.75rem+env(safe-area-inset-top)))] pr-14">
          <SheetTitle asChild>
            <div className="flex min-h-10 min-w-0 items-center overflow-visible">
              <Logo surface="mobile" beta className="min-w-0" />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks
            onNavigate={(event, href) => {
              if (pathname === href || pathname.startsWith(`${href}/`)) {
                setOpen(false);
                return;
              }

              event.preventDefault();
              beginNavigation(href);
              router.push(href);
              requestAnimationFrame(() => setOpen(false));
            }}
            showAdmin={showAdmin}
            isGuest={isGuest}
            guestPageAccess={guestPageAccess}
            prefetchOnMount={false}
          />
        </div>
        <div className="border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <InstallAppButton className="w-full justify-start" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
