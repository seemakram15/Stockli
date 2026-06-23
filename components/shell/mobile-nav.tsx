"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { NavLinks } from "./nav-links";
import { InstallAppButton } from "@/components/pwa/install-app-button";

export function MobileNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 max-w-[calc(100vw-2rem)] p-0">
        <SheetHeader className="border-b border-border px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <SheetTitle asChild>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 px-3 py-4">
          <NavLinks onNavigate={() => setOpen(false)} showAdmin={showAdmin} />
        </div>
        <div className="border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <InstallAppButton className="w-full justify-start" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
