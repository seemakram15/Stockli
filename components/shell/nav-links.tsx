"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Star,
  TrendingUp,
  Bell,
  ShieldCheck,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Wallet,
  Star,
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
  const pathname = usePathname();

  // The Admin link is appended only for superadmins — normal users never see it.
  const items = showAdmin
    ? [...NAV_ITEMS, { href: "/admin", label: "Admin", icon: "ShieldCheck" } as const]
    : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
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
