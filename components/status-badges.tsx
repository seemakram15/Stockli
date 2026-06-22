import { Clock, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATA_DELAY_LABEL } from "@/lib/constants";
import type { MarketStatus } from "@/lib/psx/market-hours";

/** "Delayed ~15 min" pill — sets honest expectations about the free feed. */
export function DataDelayBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
      title="Free PSX data is delayed, not real-time. Cached ~15 minutes."
    >
      <Clock className="size-3" aria-hidden />
      {DATA_DELAY_LABEL}
    </span>
  );
}

const STATUS_STYLES: Record<MarketStatus, string> = {
  open: "text-gain",
  closed: "text-muted-foreground",
  "pre-open": "text-chart-3",
  weekend: "text-muted-foreground",
  holiday: "text-muted-foreground",
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
        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium",
        className
      )}
    >
      <Circle
        className={cn(
          "size-2 fill-current",
          STATUS_STYLES[status],
          status === "open" && "animate-pulse"
        )}
        aria-hidden
      />
      <span className={STATUS_STYLES[status]}>{label}</span>
    </span>
  );
}
