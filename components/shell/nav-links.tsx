"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Bitcoin,
  Boxes,
  CalendarDays,
  CandlestickChart,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  Landmark,
  Layers3,
  LineChart,
  Lock,
  Wallet,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Globe2,
  Droplets,
  Gift,
  Bell,
  FileText,
  History,
  PieChart,
  ShieldCheck,
  Loader2,
  Link2,
  PlaySquare,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLORE_NAV_ITEMS, MARKET_NAV_ITEMS, NAV_ITEMS, TOOL_NAV_ITEMS } from "@/lib/constants";
import { resolvePageKey } from "@/lib/access/page-registry";
import { PrefetchNavLink } from "./prefetch-nav-link";

const ICONS: Record<string, LucideIcon> = {
  BadgePercent,
  Bitcoin,
  Boxes,
  CalendarDays,
  CandlestickChart,
  Globe2,
  Droplets,
  Gift,
  LayoutDashboard,
  Landmark,
  Layers3,
  LineChart,
  Wallet,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Bell,
  FileText,
  History,
  PieChart,
  ShieldCheck,
  Link2,
  PlaySquare,
  Settings,
};

/** Swaps the nav icon for a spinner while that link's navigation is pending. */
function NavIcon({ Icon, active }: { Icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )}
    />
  );
}

function isLockedForGuest(
  href: string,
  isGuest: boolean | undefined,
  guestPageAccess: Record<string, boolean> | null | undefined
): boolean {
  if (!isGuest || !guestPageAccess) return false;
  const key = resolvePageKey(href);
  return key != null && guestPageAccess[key] === false;
}

interface NavAccessProps {
  isGuest?: boolean;
  guestPageAccess?: Record<string, boolean> | null;
}

export function NavLinks({
  onNavigate,
  showAdmin = false,
  prefetchOnMount = true,
  isGuest,
  guestPageAccess,
}: {
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  showAdmin?: boolean;
  prefetchOnMount?: boolean;
} & NavAccessProps) {
  const pathname = usePathname() ?? "/";
  const marketActive = pathname === "/market" || pathname.startsWith("/market/");
  const [marketOpen, setMarketOpen] = React.useState(marketActive);

  React.useEffect(() => {
    if (marketActive) setMarketOpen(true);
  }, [marketActive]);

  const toolsActive = pathname === "/analysis/fundamentals" || pathname.startsWith("/analysis/");
  const exploreActive =
    pathname.startsWith("/explore") ||
    pathname.startsWith("/youtubers") ||
    pathname.startsWith("/admin");
  const exploreItems = showAdmin
    ? [
        ...EXPLORE_NAV_ITEMS,
        { href: "/admin", label: "Admin", icon: "ShieldCheck" } as const,
        { href: "/admin/fund-holdings", label: "Fund Holdings", icon: "PieChart" } as const,
        { href: "/admin/customisation", label: "Customisation", icon: "Settings" } as const,
      ]
    : EXPLORE_NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        if (item.href === "/market") {
          const Icon = ICONS[item.icon];
          return (
            <div key={item.href} className="space-y-1">
              <button
                type="button"
                aria-expanded={marketOpen}
                onClick={() => setMarketOpen((open) => !open)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  marketActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      marketActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                )}
                <span className="min-w-0 flex-1">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    marketOpen && "rotate-180"
                  )}
                />
              </button>
              {marketOpen && (
                <div className="space-y-1 pl-4">
                  <MarketNavItems
                    pathname={pathname}
                    onNavigate={onNavigate}
                    prefetchOnMount={prefetchOnMount}
                    isGuest={isGuest}
                    guestPageAccess={guestPageAccess}
                  />
                </div>
              )}
            </div>
          );
        }

        if (item.label === "Tools") {
          return (
            <MobileNavGroup
              key={item.href}
              label={item.label}
              icon={item.icon}
              active={toolsActive}
              pathname={pathname}
              items={TOOL_NAV_ITEMS}
              onNavigate={onNavigate}
              prefetchOnMount={prefetchOnMount}
              isGuest={isGuest}
              guestPageAccess={guestPageAccess}
            />
          );
        }

        if (item.label === "Explore") {
          return (
            <MobileNavGroup
              key={item.href}
              label={item.label}
              icon={item.icon}
              active={exploreActive}
              pathname={pathname}
              items={exploreItems}
              onNavigate={onNavigate}
              prefetchOnMount={prefetchOnMount}
              isGuest={isGuest}
              guestPageAccess={guestPageAccess}
            />
          );
        }

        const Icon = ICONS[item.icon];
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const locked = isLockedForGuest(item.href, isGuest, guestPageAccess);

        if (locked) {
          return (
            <LockedNavItem key={item.href} label={item.label} icon={item.icon} />
          );
        }

        return (
          <PrefetchNavLink
            key={item.href}
            href={item.href}
            onClick={(event) => onNavigate?.(event, item.href)}
            prefetchOnMount={prefetchOnMount}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            {Icon && <NavIcon Icon={Icon} active={active} />}
            {item.label}
          </PrefetchNavLink>
        );
      })}
    </nav>
  );
}

function LockedNavItem({ label, icon }: { label: string; icon: string }) {
  const Icon = ICONS[icon];
  return (
    <span
      aria-disabled="true"
      title="Sign in to access"
      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50"
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span className="flex-1">{label}</span>
      <Lock className="size-3.5 shrink-0" />
    </span>
  );
}

function MobileNavGroup({
  label,
  icon,
  active,
  pathname,
  items,
  onNavigate,
  prefetchOnMount,
  isGuest,
  guestPageAccess,
}: {
  label: string;
  icon: string;
  active: boolean;
  pathname: string;
  items: ReadonlyArray<{ href: string; label: string; icon: string }>;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  prefetchOnMount: boolean;
} & NavAccessProps) {
  const [open, setOpen] = React.useState(active);
  const Icon = ICONS[icon];

  React.useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        {Icon && (
          <Icon
            className={cn(
              "size-4 shrink-0",
              active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
        )}
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="space-y-1 pl-4">
          {items.map((item) => (
            <MarketNavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              pathname={pathname}
              onNavigate={onNavigate}
              prefetchOnMount={prefetchOnMount}
              isGuest={isGuest}
              guestPageAccess={guestPageAccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketNavItems({
  pathname,
  onNavigate,
  prefetchOnMount,
  isGuest,
  guestPageAccess,
}: {
  pathname: string;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  prefetchOnMount: boolean;
} & NavAccessProps) {
  const activeGroups = React.useMemo(() => {
    const groups: Record<string, boolean> = {};
    for (const item of MARKET_NAV_ITEMS) {
      if ("children" in item) {
        groups[item.label] = item.children.some(
          (child) => pathname === child.href || pathname.startsWith(child.href + "/")
        );
      }
    }
    return groups;
  }, [pathname]);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(activeGroups);

  React.useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const [label, active] of Object.entries(activeGroups)) {
        if (active) next[label] = true;
      }
      return next;
    });
  }, [activeGroups]);

  return (
    <>
      {MARKET_NAV_ITEMS.map((item) => {
        const ParentIcon = ICONS[item.icon];
        if ("children" in item) {
          const childActive = Boolean(activeGroups[item.label]);
          const isOpen = openGroups[item.label] ?? childActive;
          return (
            <div key={item.label} className="space-y-1">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [item.label]: !(current[item.label] ?? childActive),
                  }))
                }
                className={cn(
                  "group flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  childActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {ParentIcon && (
                  <ParentIcon
                    className={cn(
                      "size-4 shrink-0",
                      childActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="space-y-1 pl-3">
                  {item.children.map((child) => (
                    <MarketNavLink
                      key={child.href}
                      href={child.href}
                      label={child.label}
                      icon={child.icon}
                      pathname={pathname}
                      onNavigate={onNavigate}
                      prefetchOnMount={prefetchOnMount}
                      isGuest={isGuest}
                      guestPageAccess={guestPageAccess}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <MarketNavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            pathname={pathname}
            onNavigate={onNavigate}
            prefetchOnMount={prefetchOnMount}
            isGuest={isGuest}
            guestPageAccess={guestPageAccess}
          />
        );
      })}
    </>
  );
}

function MarketNavLink({
  href,
  label,
  icon,
  pathname,
  onNavigate,
  prefetchOnMount,
  isGuest,
  guestPageAccess,
}: {
  href: string;
  label: string;
  icon: string;
  pathname: string;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  prefetchOnMount: boolean;
} & NavAccessProps) {
  const Icon = ICONS[icon];
  const external = /^https?:\/\//.test(href);
  const active = !external && (pathname === href || (href !== "/market" && pathname.startsWith(href + "/")));
  const locked = !external && isLockedForGuest(href, isGuest, guestPageAccess);

  if (locked) {
    return (
      <span
        aria-disabled="true"
        title="Sign in to access"
        className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50"
      >
        {Icon && <Icon className="size-4 shrink-0" />}
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
        className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />}
        <span className="min-w-0 truncate">{label}</span>
        <ExternalLink className="size-3 shrink-0 text-muted-foreground/60" />
      </a>
    );
  }

  return (
    <PrefetchNavLink
      href={href}
      onClick={(event) => onNavigate?.(event, href)}
      prefetchOnMount={prefetchOnMount}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      {Icon && <NavIcon Icon={Icon} active={active} />}
      <span className="min-w-0 truncate">{label}</span>
    </PrefetchNavLink>
  );
}
