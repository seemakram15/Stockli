import { Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATA_DELAY_LABEL } from "@/lib/constants";
import type { MarketStatus } from "@/lib/psx/market-hours";

/** "Delayed ~10 min" pill — sets honest expectations about the free feed. */
export function DataDelayBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
      title="Free PSX data is delayed, not real-time. Cached ~10 minutes."
    >
      <Clock className="size-3" aria-hidden />
      {DATA_DELAY_LABEL}
    </span>
  );
}

const STATUS_STYLES: Record<MarketStatus, string> = {
  open: "text-gain",
  closed: "text-muted-foreground",
  "pre-open": "text-amber-600 dark:text-amber-400",
  settling: "text-sky-600 dark:text-sky-400",
  weekend: "text-muted-foreground",
  holiday: "text-muted-foreground",
};

const STATUS_WRAP: Record<MarketStatus, string> = {
  open: "border-gain/30 bg-gain/10",
  closed: "border-border bg-muted/40",
  "pre-open": "border-amber-500/30 bg-amber-500/10",
  settling: "border-sky-500/30 bg-sky-500/10",
  weekend: "border-border bg-muted/40",
  holiday: "border-border bg-muted/40",
};

export function MarketStatusBadge({
  status,
  label,
  className,
}: {
  status: MarketStatus;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        STATUS_WRAP[status],
        className
      )}
    >
      <Circle
        className={cn(
          "size-2 fill-current",
          STATUS_STYLES[status],
          (status === "open" || status === "settling") && "animate-pulse"
        )}
        aria-hidden
      />
      <span className={STATUS_STYLES[status]}>{label}</span>
    </span>
  );
}
