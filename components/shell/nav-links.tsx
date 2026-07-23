"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_ITEMS,
  EXPLORE_NAV_ITEMS,
  MARKET_NAV_ITEMS,
  NAV_ITEMS,
  TOOL_NAV_ITEMS,
  type NavAccent,
} from "@/lib/constants";
import { resolvePageKey } from "@/lib/access/page-registry";
import { NavIconChip, PendingNavIconChip } from "./nav-icons";
import { PrefetchNavLink } from "./prefetch-nav-link";

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

type NavItemRef = {
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
};

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
  const exploreItems: NavItemRef[] = showAdmin
    ? [...EXPLORE_NAV_ITEMS, ...ADMIN_NAV_ITEMS]
    : [...EXPLORE_NAV_ITEMS];

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        if (item.href === "/market") {
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
                <NavIconChip icon={item.icon} accent={item.accent} />
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
              accent={item.accent}
              active={toolsActive}
              pathname={pathname}
              items={[...TOOL_NAV_ITEMS]}
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
              accent={item.accent}
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

        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const locked = isLockedForGuest(item.href, isGuest, guestPageAccess);

        if (locked) {
          return (
            <LockedNavItem
              key={item.href}
              label={item.label}
              icon={item.icon}
              accent={item.accent}
            />
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
            <PendingNavIconChip icon={item.icon} accent={item.accent} />
            {item.label}
          </PrefetchNavLink>
        );
      })}
    </nav>
  );
}

function LockedNavItem({
  label,
  icon,
  accent,
}: {
  label: string;
  icon: string;
  accent: NavAccent;
}) {
  return (
    <span
      aria-disabled="true"
      title="Sign in to access"
      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50"
    >
      <NavIconChip icon={icon} accent={accent} className="opacity-50" />
      <span className="flex-1">{label}</span>
      <Lock className="size-3.5 shrink-0" />
    </span>
  );
}

function MobileNavGroup({
  label,
  icon,
  accent,
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
  accent: NavAccent;
  active: boolean;
  pathname: string;
  items: ReadonlyArray<NavItemRef>;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  prefetchOnMount: boolean;
} & NavAccessProps) {
  const [open, setOpen] = React.useState(active);

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
        <NavIconChip icon={icon} accent={accent} />
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
              accent={item.accent}
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
                <NavIconChip icon={item.icon} accent={item.accent} />
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
                      accent={child.accent}
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
            accent={item.accent}
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
  accent,
  pathname,
  onNavigate,
  prefetchOnMount,
  isGuest,
  guestPageAccess,
}: {
  href: string;
  label: string;
  icon: string;
  accent: NavAccent;
  pathname: string;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
  prefetchOnMount: boolean;
} & NavAccessProps) {
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
        className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      >
        <NavIconChip icon={icon} accent={accent} />
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
      <PendingNavIconChip icon={icon} accent={accent} />
      <span className="min-w-0 truncate">{label}</span>
    </PrefetchNavLink>
  );
}
