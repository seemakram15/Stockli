import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { direction, formatPercent, formatSigned } from "@/lib/format";

interface ChangeBadgeProps {
  /** Primary value (the change amount, or use only pct). */
  value?: number | null;
  pct?: number | null;
  /** "pill" = filled chip, "plain" = inline coloured text. */
  variant?: "pill" | "plain";
  /** Show the absolute change value alongside the percentage. */
  showValue?: boolean;
  className?: string;
  iconClassName?: string;
}

/** A coloured up/down indicator for a change value and/or percentage. */
export function ChangeBadge({
  value,
  pct,
  variant = "plain",
  showValue = false,
  className,
  iconClassName,
}: ChangeBadgeProps) {
  const basis = pct ?? value ?? 0;
  const dir = direction(basis);
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;

  const color =
    dir === "up" ? "text-gain" : dir === "down" ? "text-loss" : "text-muted-foreground";
  const pill =
    dir === "up"
      ? "bg-gain/10 text-gain"
      : dir === "down"
        ? "bg-loss/10 text-loss"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums whitespace-nowrap",
        variant === "pill"
          ? cn("rounded-full px-2 py-0.5 text-xs font-medium", pill)
          : cn("text-sm font-medium", color),
        className
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden />
      {showValue && value != null && <span>{formatSigned(value)}</span>}
      {pct != null && <span>{formatPercent(pct)}</span>}
    </span>
  );
}
