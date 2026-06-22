import type * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function MarketAccordion({
  title,
  meta,
  defaultOpen = true,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-xl border border-border bg-background/70 p-3 shadow-sm",
        "open:bg-background"
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
          {meta && <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>}
        </div>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
