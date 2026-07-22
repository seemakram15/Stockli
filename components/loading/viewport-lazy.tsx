"use client";

import * as React from "react";
import { useInViewport, type UseInViewportOptions } from "@/lib/hooks/use-in-viewport";
import { cn } from "@/lib/utils";

type ViewportLazyProps = {
  children: React.ReactNode;
  /** Shown until the section is near the viewport (and optionally until ready). */
  fallback?: React.ReactNode;
  /** Keep rendering the fallback until this is true (e.g. data arrived). */
  ready?: boolean;
  className?: string;
  /** Min height so the layout does not jump while waiting. */
  minHeight?: string | number;
} & UseInViewportOptions;

/**
 * Defers mounting heavy children until the placeholder is near the viewport.
 * After the first reveal, children stay mounted (once=true by default).
 */
export function ViewportLazy({
  children,
  fallback = null,
  ready = true,
  className,
  minHeight,
  once = true,
  rootMargin = "240px 0px",
  threshold = 0.01,
  initialVisible = false,
}: ViewportLazyProps) {
  const { ref, visible } = useInViewport<HTMLDivElement>({
    once,
    rootMargin,
    threshold,
    initialVisible,
  });

  const showChildren = visible && ready;

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={minHeight != null ? { minHeight } : undefined}
      data-viewport-lazy={showChildren ? "active" : "pending"}
    >
      {showChildren ? children : fallback}
    </div>
  );
}

/** Gate network hooks: returns true after the sentinel enters the viewport. */
export function useViewportEnabled(options?: UseInViewportOptions) {
  return useInViewport<HTMLDivElement>(options);
}
