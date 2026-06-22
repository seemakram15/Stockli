"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Global top loading bar. Starts on any internal link click and completes when
 * the route (pathname) changes — giving immediate feedback during the
 * server-component fetch, on top of per-route skeletons.
 */
export function TopProgress() {
  const pathname = usePathname();
  const [width, setWidth] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const trickle = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = React.useCallback(() => {
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    setWidth(100);
    hide.current = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 280);
  }, []);

  const start = React.useCallback(() => {
    if (hide.current) clearTimeout(hide.current);
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    setVisible(true);
    setWidth(8);
    trickle.current = setInterval(() => {
      setWidth((w) => (w < 90 ? w + Math.max(0.5, (90 - w) * 0.08) : w));
    }, 200);
    // Auto-finish if navigation is a no-op or stalls.
    safety.current = setTimeout(() => finish(), 8000);
  }, [finish]);

  // Complete on route change.
  React.useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Start on internal link clicks.
  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank") return;
      if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      // Ignore navigations to the current path (no transition → no completion).
      const dest = href.split("?")[0].split("#")[0];
      if (dest === pathname) return;
      start();
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, start]);

  React.useEffect(() => {
    return () => {
      if (trickle.current) clearInterval(trickle.current);
      if (hide.current) clearTimeout(hide.current);
      if (safety.current) clearTimeout(safety.current);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-gradient-to-r from-[#22c55e] via-[#16b3c6] to-[#2563eb] shadow-[0_0_8px] shadow-primary/50 transition-[width] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: width >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
