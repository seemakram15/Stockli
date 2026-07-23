"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";
import {
  Activity,
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Bell,
  Bitcoin,
  Boxes,
  CalendarDays,
  CandlestickChart,
  Compass,
  Crosshair,
  Droplets,
  Earth,
  Flag,
  FolderKanban,
  Gift,
  Globe2,
  History,
  Landmark,
  Layers3,
  LayoutDashboard,
  LineChart,
  Link2,
  Loader2,
  Map,
  Newspaper,
  PieChart,
  PlaySquare,
  Radar,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  ACCENT_ICON,
  IconChip,
  type Accent,
} from "@/components/ui/accent";
import type { NavAccent } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const NAV_ICONS: Record<string, LucideIcon> = {
  Activity,
  ArrowLeftRight,
  BadgePercent,
  BarChart3,
  Bell,
  Bitcoin,
  Boxes,
  CalendarDays,
  CandlestickChart,
  Compass,
  Crosshair,
  Droplets,
  Earth,
  Flag,
  FolderKanban,
  Gift,
  Globe2,
  History,
  Landmark,
  Layers3,
  LayoutDashboard,
  LineChart,
  Link2,
  Map,
  Newspaper,
  PieChart,
  PlaySquare,
  Radar,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  Wrench,
};

export function resolveNavIcon(name: string): LucideIcon | undefined {
  return NAV_ICONS[name];
}

export function toAccent(accent: NavAccent | Accent | string | undefined): Accent {
  switch (accent) {
    case "primary":
    case "emerald":
    case "sky":
    case "violet":
    case "amber":
    case "rose":
    case "teal":
    case "indigo":
    case "orange":
    case "slate":
      return accent;
    default:
      return "slate";
  }
}

/** Soft IconChip used in dropdown rows and sidebar/mobile lists. */
export function NavIconChip({
  icon,
  accent,
  pending,
  className,
}: {
  icon: string;
  accent?: NavAccent | Accent | string;
  pending?: boolean;
  className?: string;
}) {
  const Icon = resolveNavIcon(icon);
  if (!Icon && !pending) return null;
  return (
    <IconChip accent={toAccent(accent)} size="sm" className={className}>
      {pending ? <Loader2 className="animate-spin" /> : Icon ? <Icon /> : null}
    </IconChip>
  );
}

/** Compact tinted glyph for dense top-nav links (no chip surface). */
export function NavTintedIcon({
  icon,
  accent,
  pending,
  className,
}: {
  icon: string;
  accent?: NavAccent | Accent | string;
  pending?: boolean;
  className?: string;
}) {
  if (pending) {
    return <Loader2 className={cn("size-4 shrink-0 animate-spin text-primary", className)} />;
  }
  const Icon = resolveNavIcon(icon);
  if (!Icon) return null;
  return (
    <Icon
      className={cn("size-4 shrink-0", ACCENT_ICON[toAccent(accent)], className)}
      aria-hidden
    />
  );
}

/** Wraps a chip/tinted icon and swaps in a spinner while the link is pending. */
export function PendingNavIconChip({
  icon,
  accent,
  className,
}: {
  icon: string;
  accent?: NavAccent | Accent | string;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return <NavIconChip icon={icon} accent={accent} pending={pending} className={className} />;
}

export function PendingNavTintedIcon({
  icon,
  accent,
  className,
}: {
  icon: string;
  accent?: NavAccent | Accent | string;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return <NavTintedIcon icon={icon} accent={accent} pending={pending} className={className} />;
}
