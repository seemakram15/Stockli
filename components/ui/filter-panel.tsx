"use client";

import * as React from "react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterPanelProps = {
  title?: string;
  summary?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
};

export function FilterPanel({
  title = "Filters",
  summary,
  children,
  className,
  contentClassName,
  defaultOpen = false,
}: FilterPanelProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background/80 shadow-sm sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none",
        className
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left sm:hidden"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Filter className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {summary ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{summary}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          open ? "block" : "hidden",
          "border-t border-border p-3 sm:block sm:border-0 sm:p-0",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
