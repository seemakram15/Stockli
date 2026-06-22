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

export function MobileNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle asChild>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 py-4">
          <NavLinks onNavigate={() => setOpen(false)} showAdmin={showAdmin} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
