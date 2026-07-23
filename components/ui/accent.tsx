import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared accent palette for the whole app. Pick a colour family per
 * domain (markets = sky, AI/tools = violet, dividends = amber, …) so colour
 * carries meaning instead of being decorative noise.
 */
export type Accent =
  | "primary"
  | "emerald"
  | "sky"
  | "violet"
  | "amber"
  | "rose"
  | "teal"
  | "indigo"
  | "orange"
  | "slate";

/** Tinted, low-contrast surface — the default for icon chips & pills. */
const SOFT: Record<Accent, string> = {
  primary: "bg-primary/10 text-primary ring-primary/20",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  sky: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
  teal: "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-400",
  indigo: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400",
  orange: "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400",
  slate: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
};

/** Saturated gradient fill with a white glyph — for hero / feature chips. */
const GRADIENT: Record<Accent, string> = {
  primary: "bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-sm shadow-emerald-500/30",
  emerald: "bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-sm shadow-emerald-500/30",
  sky: "bg-gradient-to-br from-sky-500 to-indigo-400 text-white shadow-sm shadow-sky-500/30",
  violet: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/30",
  amber: "bg-gradient-to-br from-amber-500 to-orange-400 text-white shadow-sm shadow-amber-500/30",
  rose: "bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-sm shadow-rose-500/30",
  teal: "bg-gradient-to-br from-teal-500 to-cyan-400 text-white shadow-sm shadow-teal-500/30",
  indigo: "bg-gradient-to-br from-indigo-500 to-blue-400 text-white shadow-sm shadow-indigo-500/30",
  orange: "bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-sm shadow-orange-500/30",
  slate: "bg-gradient-to-br from-slate-600 to-slate-500 text-white shadow-sm shadow-slate-500/20",
};

/** Glyph-only tint — for compact nav icons without a chip surface. */
const ICON: Record<Accent, string> = {
  primary: "text-primary",
  emerald: "text-emerald-600 dark:text-emerald-400",
  sky: "text-sky-600 dark:text-sky-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  teal: "text-teal-600 dark:text-teal-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  orange: "text-orange-600 dark:text-orange-400",
  slate: "text-slate-600 dark:text-slate-300",
};

/** Outlined pill style for eyebrows. */
const PILL: Record<Accent, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  violet: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  teal: "border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300",
  indigo: "border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  orange: "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300",
  slate: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const CHIP_SIZE = {
  sm: "size-8 rounded-lg [&>svg]:size-4",
  default: "size-10 rounded-xl [&>svg]:size-5",
  lg: "size-12 rounded-2xl [&>svg]:size-6",
} as const;

export function IconChip({
  children,
  accent = "primary",
  variant = "soft",
  size = "default",
  className,
}: {
  children: React.ReactNode;
  accent?: Accent;
  variant?: "soft" | "gradient";
  size?: keyof typeof CHIP_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center [&>svg]:shrink-0",
        CHIP_SIZE[size],
        variant === "gradient" ? GRADIENT[accent] : cn("ring-1", SOFT[accent]),
        className
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** The colourful eyebrow pill used to label a section, e.g. landing sections. */
export function AccentPill({
  children,
  accent = "primary",
  className,
}: {
  children: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold [&>svg]:size-3.5",
        PILL[accent],
        className
      )}
    >
      {children}
    </span>
  );
}

export {
  SOFT as ACCENT_SOFT,
  GRADIENT as ACCENT_GRADIENT,
  PILL as ACCENT_PILL,
  ICON as ACCENT_ICON,
};
