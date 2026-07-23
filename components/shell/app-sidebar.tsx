"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouteTransition } from "@/components/navigation/route-transition-provider";
import { cn } from "@/lib/utils";
import { NavLinks } from "./nav-links";

const SIDEBAR_OPEN_KEY = "stockli-app-sidebar-open";

/**
 * Persistent left nav for mid widths only.
 * Visible: lg–2xl (1024px–1535px). Hidden below lg (mobile sheet) and at 2xl+ (top nav).
 * Layout is flex-based — content sits beside this aside, never under an overlay.
 * Collapse/expand via chevron on the sidebar edge (left when open, right when closed).
 */
export function AppSidebar({
  showAdmin = false,
  isGuest,
  guestPageAccess,
}: {
  showAdmin?: boolean;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { beginNavigation } = useRouteTransition();
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (stored === "false") setOpen(false);
    } catch {
      // ignore
    }
  }, []);

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="relative sticky top-0 z-40 hidden h-svh shrink-0 lg:block 2xl:hidden">
      <aside
        id="app-sidebar"
        aria-label="Primary"
        aria-hidden={!open}
        className={cn(
          "h-full overflow-x-hidden overflow-y-auto overscroll-contain border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
          open ? "w-64" : "w-0 border-transparent"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 w-64 flex-col px-3 py-4 transition-opacity duration-200",
            open ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Menu
          </p>
          <NavLinks
            showAdmin={showAdmin}
            isGuest={isGuest}
            guestPageAccess={guestPageAccess}
            onNavigate={(event, href) => {
              if (pathname === href || pathname.startsWith(`${href}/`)) return;
              event.preventDefault();
              beginNavigation(href);
              router.push(href);
            }}
          />
        </div>
      </aside>

      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="app-sidebar"
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        className={cn(
          "absolute top-[4.25rem] z-50 inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-[left,colors] duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open ? "left-[calc(16rem-0.875rem)]" : "left-2"
        )}
      >
        {open ? (
          <ChevronLeft className="size-4" aria-hidden />
        ) : (
          <ChevronRight className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
