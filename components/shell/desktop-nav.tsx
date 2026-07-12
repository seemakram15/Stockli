"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgePercent,
  Bell,
  Bitcoin,
  Boxes,
  CalendarDays,
  CandlestickChart,
  ChevronDown,
  FileText,
  Droplets,
  Gift,
  Globe2,
  History,
  Landmark,
  Layers3,
  LayoutDashboard,
  LineChart,
  Link2,
  Loader2,
  PieChart,
  PlaySquare,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { EXPLORE_NAV_ITEMS, MARKET_NAV_ITEMS, NAV_ITEMS, TOOL_NAV_ITEMS } from "@/lib/constants";
import { useRouteTransition } from "@/components/navigation/route-transition-provider";
import { cn } from "@/lib/utils";
import { PrefetchNavLink } from "./prefetch-nav-link";

const ICONS: Record<string, LucideIcon> = {
  BadgePercent,
  Bell,
  Bitcoin,
  Boxes,
  CalendarDays,
  CandlestickChart,
  Droplets,
  FileText,
  Gift,
  Globe2,
  History,
  Landmark,
  Layers3,
  LayoutDashboard,
  LineChart,
  Link2,
  PieChart,
  PlaySquare,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Wallet,
};

export function DesktopNav({ showAdmin = false }: { showAdmin?: boolean }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { beginNavigation } = useRouteTransition();
  const marketActive = pathname === "/market" || pathname.startsWith("/market/");
  const toolsActive = pathname.startsWith("/analysis");
  const exploreActive =
    pathname.startsWith("/explore") ||
    pathname.startsWith("/youtubers") ||
    pathname.startsWith("/admin");
  const dashboardItem = NAV_ITEMS.find((item) => item.href === "/dashboard")!;
  const portfoliosItem = NAV_ITEMS.find((item) => item.href === "/portfolios")!;
  const watchlistItem = NAV_ITEMS.find((item) => item.href === "/watchlist")!;
  const alertsItem = NAV_ITEMS.find((item) => item.href === "/alerts")!;
  const toolsLinks = React.useMemo<DropdownLink[]>(() => [...TOOL_NAV_ITEMS], []);
  const exploreLinks = React.useMemo<DropdownLink[]>(
    () => [
      ...EXPLORE_NAV_ITEMS,
      ...(showAdmin
        ? [
            { href: "/admin", label: "Admin", icon: "ShieldCheck" },
            { href: "/admin/fund-holdings", label: "Fund Holdings", icon: "PieChart" },
          ]
        : []),
    ],
    [showAdmin]
  );
  const handleNavigate = React.useCallback(
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      href: string,
      afterNavigate?: () => void
    ) => {
      if (pathname === href || pathname.startsWith(`${href}/`)) {
        afterNavigate?.();
        return;
      }

      event.preventDefault();
      beginNavigation(href);
      React.startTransition(() => {
        router.push(href);
      });
      requestAnimationFrame(() => afterNavigate?.());
    },
    [beginNavigation, pathname, router]
  );

  return (
    <nav className="hidden min-w-0 items-center gap-1 lg:flex">
      <DesktopNavLink
        href={dashboardItem.href}
        label={dashboardItem.label}
        icon={dashboardItem.icon}
        active={pathname === dashboardItem.href || pathname.startsWith(dashboardItem.href + "/")}
        onNavigate={handleNavigate}
      />
      <DesktopNavLink
        href={portfoliosItem.href}
        label={portfoliosItem.label}
        icon={portfoliosItem.icon}
        active={pathname === portfoliosItem.href || pathname.startsWith(portfoliosItem.href + "/")}
        onNavigate={handleNavigate}
      />
      <MarketDropdown active={marketActive} pathname={pathname} onNavigate={handleNavigate} />
      <NavDropdown
        label="Tools"
        sectionLabel="Tools"
        active={toolsActive}
        pathname={pathname}
        links={toolsLinks}
        onNavigate={handleNavigate}
      />
      <NavDropdown
        label="Explore"
        sectionLabel="Explore"
        active={exploreActive}
        pathname={pathname}
        links={exploreLinks}
        onNavigate={handleNavigate}
      />
      <DesktopNavLink
        href={watchlistItem.href}
        label={watchlistItem.label}
        icon={watchlistItem.icon}
        active={pathname === watchlistItem.href || pathname.startsWith(watchlistItem.href + "/")}
        onNavigate={handleNavigate}
      />
      <DesktopNavLink
        href={alertsItem.href}
        label={alertsItem.label}
        icon={alertsItem.icon}
        active={pathname === alertsItem.href || pathname.startsWith(alertsItem.href + "/")}
        onNavigate={handleNavigate}
      />
    </nav>
  );
}

type DropdownLink = {
  href: string;
  label: string;
  icon: string;
};

type DesktopNavigateHandler = (
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string,
  afterNavigate?: () => void
) => void;

function NavDropdown({
  label,
  sectionLabel,
  active,
  pathname,
  links,
  onNavigate,
}: {
  label: string;
  sectionLabel: string;
  active: boolean;
  pathname: string;
  links: DropdownLink[];
  onNavigate: DesktopNavigateHandler;
}) {
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    setOpen(true);
  }

  function closeMenu() {
    clearCloseTimer();
    setOpen(false);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(closeMenu, 90);
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && menuRef.current?.contains(nextTarget)) return;
    scheduleClose();
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    closeMenu();
  }

  React.useEffect(() => clearCloseTimer, []);
  React.useEffect(() => {
    closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div
      ref={menuRef}
      className="relative"
      onPointerEnter={openMenu}
      onPointerLeave={handlePointerLeave}
      onFocus={openMenu}
      onBlur={handleBlur}
    >
      <button
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-primary/10 text-primary ring-1 ring-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[120] pt-3" role="menu">
          <div className="w-80 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {sectionLabel}
            </p>
            <div className="space-y-1">
              {links.map((item) => (
                <DesktopMarketItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={pathname === item.href || pathname.startsWith(item.href + "/")}
                  onNavigate={onNavigate}
                  afterNavigate={closeMenu}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketDropdown({
  active,
  pathname,
  onNavigate,
}: {
  active: boolean;
  pathname: string;
  onNavigate: DesktopNavigateHandler;
}) {
  const [open, setOpen] = React.useState(false);
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<number | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    setOpen(true);
  }

  function closeMenu() {
    clearCloseTimer();
    setOpen(false);
    setOpenGroup(null);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(closeMenu, 90);
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && menuRef.current?.contains(nextTarget)) return;
    scheduleClose();
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    closeMenu();
  }

  React.useEffect(() => clearCloseTimer, []);
  React.useEffect(() => {
    closeMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={menuRef}
      className="relative"
      onPointerEnter={openMenu}
      onPointerLeave={handlePointerLeave}
      onFocus={openMenu}
      onBlur={handleBlur}
    >
      <button
        type="button"
        onPointerEnter={openMenu}
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          active ? "bg-primary/10 text-primary ring-1 ring-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        Market
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[120] pt-3" role="menu">
          <div className="w-80 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Markets
            </p>
            <div className="space-y-1">
              {MARKET_NAV_ITEMS.map((item) => {
                const ParentIcon = ICONS[item.icon];
                if ("children" in item) {
                  const childActive = item.children.some(
                    (child) => isMarketRouteActive(pathname, child.href)
                  );
                  const groupOpen = openGroup === item.label;
                  return (
                    <div
                      key={item.label}
                      className="relative"
                      onPointerEnter={() => setOpenGroup(item.label)}
                    >
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                          childActive && "text-foreground",
                          groupOpen && "bg-muted/70 text-foreground"
                        )}
                      >
                        {ParentIcon ? <ParentIcon className="size-4 text-muted-foreground" /> : null}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ChevronDown className="-rotate-90 size-4 text-muted-foreground" />
                      </button>
                      {groupOpen && (
                        <div className="absolute left-full top-0 z-[130] pl-2">
                          <div className="w-72 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
                            {item.children.map((child) => (
                              <DesktopMarketItem
                                key={child.href}
                                href={child.href}
                                label={child.label}
                                icon={child.icon}
                                active={isMarketRouteActive(pathname, child.href)}
                                onNavigate={onNavigate}
                                afterNavigate={closeMenu}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={item.href} onPointerEnter={() => setOpenGroup(null)}>
                    <DesktopMarketItem
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={isMarketRouteActive(pathname, item.href)}
                      onNavigate={onNavigate}
                      afterNavigate={closeMenu}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isMarketRouteActive(pathname: string, href: string) {
  if (href === "/market") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopNavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: DesktopNavigateHandler;
}) {
  const Icon = ICONS[icon];

  return (
    <PrefetchNavLink
      href={href}
      onClick={(event) => onNavigate?.(event, href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
        active ? "bg-primary/10 text-primary ring-1 ring-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {Icon ? <PendingIcon Icon={Icon} active={active} /> : null}
      <span>{label}</span>
    </PrefetchNavLink>
  );
}

function DesktopMarketItem({
  href,
  label,
  icon,
  active,
  onNavigate,
  afterNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: DesktopNavigateHandler;
  afterNavigate?: () => void;
}) {
  const Icon = ICONS[icon];

  return (
    <PrefetchNavLink
      href={href}
      onClick={(event) => onNavigate?.(event, href, afterNavigate)}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {Icon ? <PendingIcon Icon={Icon} active={active} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </PrefetchNavLink>
  );
}

function PendingIcon({ Icon, active }: { Icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 className="size-4 animate-spin text-primary" />;
  return <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />;
}
