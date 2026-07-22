"use client";

import * as React from "react";

export type UseInViewportOptions = {
  /** Stay true after the first intersection (default true). */
  once?: boolean;
  /** Root margin for early prefetch (default "200px 0px"). */
  rootMargin?: string;
  /** Intersection ratio required (default 0.01). */
  threshold?: number | number[];
  /** Start as visible immediately (useful for SSR/tests). */
  initialVisible?: boolean;
};

/**
 * True once the element enters (or is near) the viewport.
 * Designed for deferring network work until the user scrolls near a section.
 */
export function useInViewport<T extends Element = HTMLDivElement>(
  options: UseInViewportOptions = {}
) {
  const {
    once = true,
    rootMargin = "240px 0px",
    threshold = 0.01,
    initialVisible = false,
  } = options;

  const ref = React.useRef<T | null>(null);
  const [visible, setVisible] = React.useState(initialVisible);

  React.useEffect(() => {
    if (visible && once) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setVisible(true);
        if (once) observer.disconnect();
      },
      { root: null, rootMargin, threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold, visible]);

  return { ref, visible } as const;
}
