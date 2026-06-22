"use client";

import * as React from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Bitcoin,
  Boxes,
  CandlestickChart,
  ChevronDown,
  LayoutDashboard,
  Landmark,
  Layers3,
  LineChart,
  Wallet,
  Star,
  Target,
  TrendingUp,
  Globe2,
  Droplets,
  Bell,
  ShieldCheck,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKET_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";

const ICONS: Record<string, LucideIcon> = {
  BadgePercent,
  Bitcoin,
  Boxes,
  CandlestickChart,
  Globe2,
  Droplets,
  LayoutDashboard,
  Landmark,
  Layers3,
  LineChart,
  Wallet,
  Star,
  Target,
  TrendingUp,
  Bell,
  ShieldCheck,
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

export function NavLinks({
  onNavigate,
  showAdmin = false,
}: {
  onNavigate?: () => void;
  showAdmin?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const marketActive = pathname === "/market" || pathname.startsWith("/market/");
  const [marketOpen, setMarketOpen] = React.useState(marketActive);

  React.useEffect(() => {
    if (marketActive) setMarketOpen(true);
  }, [marketActive]);

  // The Admin link is appended only for superadmins — normal users never see it.
  const items = showAdmin
    ? [...NAV_ITEMS, { href: "/admin", label: "Admin", icon: "ShieldCheck" } as const]
    : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
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
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
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
                  <MarketNavItems pathname={pathname} onNavigate={onNavigate} />
                </div>
              )}
            </div>
          );
        }
        const Icon = ICONS[item.icon];
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            {Icon && <NavIcon Icon={Icon} active={active} />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MarketNavItems({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {MARKET_NAV_ITEMS.map((item) => {
        const ParentIcon = ICONS[item.icon];
        if ("children" in item) {
          const childActive = item.children.some(
            (child) => pathname === child.href || pathname.startsWith(child.href + "/")
          );
          return (
            <div key={item.label} className="space-y-1">
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
                  childActive ? "text-sidebar-foreground" : "text-muted-foreground"
                )}
              >
                {ParentIcon && <ParentIcon className="size-3.5" />}
                {item.label}
              </div>
              <div className="space-y-1 pl-3">
                {item.children.map((child) => (
                  <MarketNavLink
                    key={child.href}
                    href={child.href}
                    label={child.label}
                    icon={child.icon}
                    pathname={pathname}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
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
}: {
  href: string;
  label: string;
  icon: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = ICONS[icon];
  const active = pathname === href || (href !== "/market" && pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      {Icon && <NavIcon Icon={Icon} active={active} />}
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
