"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
import {
  CONTROL_PANEL_NAV_ITEMS,
  EXPLORE_NAV_ITEMS,
  MARKET_NAV_ITEMS,
  NAV_ITEMS,
  TOOL_NAV_ITEMS,
  type NavAccent,
} from "@/lib/constants";
import { resolvePageKey } from "@/lib/access/page-registry";
import { useRouteTransition } from "@/components/navigation/route-transition-provider";
import { cn } from "@/lib/utils";
import {
  NavIconChip,
  PendingNavIconChip,
  PendingNavTintedIcon,
  resolveNavIcon,
  toAccent,
} from "./nav-icons";
import { PrefetchNavLink } from "./prefetch-nav-link";
import { ACCENT_ICON } from "@/components/ui/accent";

function isLockedForGuest(
  href: string,
  isGuest: boolean | undefined,
  guestPageAccess: Record<string, boolean> | null | undefined
): boolean {
  if (!isGuest || !guestPageAccess) return false;
  const key = resolvePageKey(href);
  return key != null && guestPageAccess[key] === false;
}

export function DesktopNav({
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
  const marketActive = pathname === "/market" || pathname.startsWith("/market/");
  const toolsActive = pathname.startsWith("/analysis");
  const exploreActive =
    pathname.startsWith("/explore") || pathname.startsWith("/youtubers");
  const controlPanelActive =
    pathname.startsWith("/control-panel") || pathname.startsWith("/admin");
  const dashboardItem = NAV_ITEMS.find((item) => item.href === "/dashboard")!;
  const portfoliosItem = NAV_ITEMS.find((item) => item.href === "/portfolios")!;
  const watchlistItem = NAV_ITEMS.find((item) => item.href === "/watchlist")!;
  const alertsItem = NAV_ITEMS.find((item) => item.href === "/alerts")!;
  const newsItem = NAV_ITEMS.find((item) => item.href === "/news")!;
  const toolsLinks = React.useMemo<DropdownLink[]>(() => [...TOOL_NAV_ITEMS], []);
  const exploreLinks = React.useMemo<DropdownLink[]>(() => [...EXPLORE_NAV_ITEMS], []);
  const controlPanelLinks = React.useMemo<DropdownLink[]>(
    () => [...CONTROL_PANEL_NAV_ITEMS],
    []
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
      router.push(href);
      requestAnimationFrame(() => afterNavigate?.());
    },
    [beginNavigation, pathname, router]
  );

  return (
    // Wide desktop (≥2xl / 1536px): horizontal primary nav.
    // Mid (lg–2xl): AppSidebar. Below lg: MobileNav sheet.
    // overflow-visible: absolute Market/Tools/Explore menus are not portalled.
    <nav className="hidden min-w-0 shrink items-center gap-0.5 overflow-visible 2xl:flex 2xl:gap-1">
      <DesktopNavLink
        href={dashboardItem.href}
        label={dashboardItem.label}
        icon={dashboardItem.icon}
        accent={dashboardItem.accent}
        active={pathname === dashboardItem.href || pathname.startsWith(dashboardItem.href + "/")}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      <DesktopNavLink
        href={portfoliosItem.href}
        label={portfoliosItem.label}
        icon={portfoliosItem.icon}
        accent={portfoliosItem.accent}
        active={pathname === portfoliosItem.href || pathname.startsWith(portfoliosItem.href + "/")}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      <MarketDropdown
        active={marketActive}
        pathname={pathname}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      <NavDropdown
        label="Tools"
        sectionLabel="Tools"
        active={toolsActive}
        pathname={pathname}
        links={toolsLinks}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      <NavDropdown
        label="Explore"
        sectionLabel="Explore"
        active={exploreActive}
        pathname={pathname}
        links={exploreLinks}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      {showAdmin ? (
        <NavDropdown
          label="Control Panel"
          sectionLabel="Control Panel"
          active={controlPanelActive}
          pathname={pathname}
          links={controlPanelLinks}
          onNavigate={handleNavigate}
          isGuest={isGuest}
          guestPageAccess={guestPageAccess}
        />
      ) : null}
      <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
      <DesktopNavLink
        href={newsItem.href}
        label={newsItem.label}
        icon={newsItem.icon}
        accent={newsItem.accent}
        active={pathname === newsItem.href || pathname.startsWith(newsItem.href + "/")}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      <DesktopNavLink
        href={watchlistItem.href}
        label={watchlistItem.label}
        icon={watchlistItem.icon}
        accent={watchlistItem.accent}
        active={pathname === watchlistItem.href || pathname.startsWith(watchlistItem.href + "/")}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
      <DesktopNavLink
        href={alertsItem.href}
        label={alertsItem.label}
        icon={alertsItem.icon}
        accent={alertsItem.accent}
        active={pathname === alertsItem.href || pathname.startsWith(alertsItem.href + "/")}
        onNavigate={handleNavigate}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />
    </nav>
  );
}

type DropdownLink = {
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
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
  isGuest,
  guestPageAccess,
}: {
  label: string;
  sectionLabel: string;
  active: boolean;
  pathname: string;
  links: DropdownLink[];
  onNavigate: DesktopNavigateHandler;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
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
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
                  accent={item.accent}
                  active={pathname === item.href || pathname.startsWith(item.href + "/")}
                  onNavigate={onNavigate}
                  afterNavigate={closeMenu}
                  isGuest={isGuest}
                  guestPageAccess={guestPageAccess}
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
  isGuest,
  guestPageAccess,
}: {
  active: boolean;
  pathname: string;
  onNavigate: DesktopNavigateHandler;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
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
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
                        <NavIconChip icon={item.icon} accent={item.accent} />
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
                                accent={child.accent}
                                active={isMarketRouteActive(pathname, child.href)}
                                onNavigate={onNavigate}
                                afterNavigate={closeMenu}
                                isGuest={isGuest}
                                guestPageAccess={guestPageAccess}
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
                      accent={item.accent}
                      active={isMarketRouteActive(pathname, item.href)}
                      onNavigate={onNavigate}
                      afterNavigate={closeMenu}
                      isGuest={isGuest}
                      guestPageAccess={guestPageAccess}
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
  accent,
  active,
  onNavigate,
  isGuest,
  guestPageAccess,
}: {
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
  active: boolean;
  onNavigate?: DesktopNavigateHandler;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
}) {
  const Icon = resolveNavIcon(icon);
  const locked = isLockedForGuest(href, isGuest, guestPageAccess);
  const linkClass = cn(
    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
    active
      ? "bg-primary/10 text-primary ring-1 ring-primary/15"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

  if (locked) {
    return (
      <span
        aria-disabled="true"
        title="Sign in to access"
        className={cn(linkClass, "text-muted-foreground/50")}
      >
        {Icon ? (
          <Icon className={cn("size-4", ACCENT_ICON[toAccent(accent)], "opacity-50")} aria-hidden />
        ) : null}
        <span>{label}</span>
        <Lock className="size-3.5" />
      </span>
    );
  }

  return (
    <PrefetchNavLink
      href={href}
      onClick={(event) => onNavigate?.(event, href)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={linkClass}
    >
      <PendingNavTintedIcon icon={icon} accent={accent} />
      <span>{label}</span>
    </PrefetchNavLink>
  );
}

function DesktopMarketItem({
  href,
  label,
  icon,
  accent,
  active,
  onNavigate,
  afterNavigate,
  isGuest,
  guestPageAccess,
}: {
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
  active: boolean;
  onNavigate?: DesktopNavigateHandler;
  afterNavigate?: () => void;
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
}) {
  const external = /^https?:\/\//.test(href);
  const locked = !external && isLockedForGuest(href, isGuest, guestPageAccess);

  if (locked) {
    return (
      <span
        aria-disabled="true"
        title="Sign in to access"
        className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
      >
        <NavIconChip icon={icon} accent={accent} className="opacity-50" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <Lock className="size-3.5 shrink-0" />
      </span>
    );
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={afterNavigate}
        className="flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
      >
        <NavIconChip icon={icon} accent={accent} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" />
      </a>
    );
  }

  return (
    <PrefetchNavLink
      href={href}
      onClick={(event) => onNavigate?.(event, href, afterNavigate)}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <PendingNavIconChip icon={icon} accent={accent} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </PrefetchNavLink>
  );
}
