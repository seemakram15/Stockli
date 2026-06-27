import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function MarketAccordion({
  title,
  meta,
  open,
  defaultOpen = true,
  onOpenChange,
  className,
  summaryClassName,
  contentClassName,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : uncontrolledOpen;

  return (
    <details
      open={actualOpen}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (!isControlled) {
          setUncontrolledOpen(next);
        }
        onOpenChange?.(next);
      }}
      className={cn(
        "group overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        "open:bg-card",
        className
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border/70 px-4 py-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
          summaryClassName
        )}
      >
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
          {meta && <div className="mt-1 text-xs text-muted-foreground">{meta}</div>}
        </div>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className={cn("px-4 py-4", contentClassName)}>{children}</div>
    </details>
  );
}
