"use client";

import { Database, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CacheStatusBadge({
  updatedAt,
  cachedAt,
  isFromDeviceCache,
  isRefreshing,
  className,
}: {
  updatedAt?: string | null;
  cachedAt?: string | null;
  isFromDeviceCache?: boolean;
  isRefreshing?: boolean;
  className?: string;
}) {
  const timestamp = updatedAt ?? cachedAt;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm",
        className
      )}
      title={timestamp ? `Updated ${formatDateTime(timestamp)}` : undefined}
    >
      {isRefreshing ? (
        <RefreshCw className="size-3 animate-spin text-primary" aria-hidden />
      ) : (
        <Database className="size-3" aria-hidden />
      )}
      <span>
        {isRefreshing
          ? "Refreshing..."
          : timestamp
            ? `Updated ${formatDateTime(timestamp)}`
            : "Cached data"}
      </span>
      {isFromDeviceCache ? <span className="text-primary">device cache</span> : null}
    </span>
  );
}
