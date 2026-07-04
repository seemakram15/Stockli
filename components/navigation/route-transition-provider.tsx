"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  PageLoadingState,
  type PageLoadingVariant,
} from "@/components/loading/page-loading-state";

type RouteTransitionContextValue = {
  beginNavigation: (href: string) => void;
  pendingPath: string | null;
};

const RouteTransitionContext = React.createContext<RouteTransitionContextValue | null>(null);

export function RouteTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);

  const beginNavigation = React.useCallback(
    (href: string) => {
      const nextPath = normalizeInternalPath(href);
      if (!nextPath || matchesPath(pathname, nextPath)) return;
      setPendingPath(nextPath);
    },
    [pathname]
  );

  React.useEffect(() => {
    if (!pendingPath) return;
    if (matchesPath(pathname, pendingPath)) {
      setPendingPath(null);
    }
  }, [pathname, pendingPath]);

  React.useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const nextPath = normalizeInternalPath(anchor.href);
      if (!nextPath || matchesPath(pathname, nextPath)) return;
      setPendingPath(nextPath);
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [pathname]);

  const contextValue = React.useMemo(
    () => ({ beginNavigation, pendingPath }),
    [beginNavigation, pendingPath]
  );

  return (
    <RouteTransitionContext.Provider value={contextValue}>
      {children}
    </RouteTransitionContext.Provider>
  );
}

export function useRouteTransition() {
  const context = React.useContext(RouteTransitionContext);
  if (!context) {
    throw new Error("useRouteTransition must be used within RouteTransitionProvider.");
  }
  return context;
}

export function RouteTransitionViewport({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pendingPath } = useRouteTransition();
  const loadingState = pendingPath ? getLoadingStateForPath(pendingPath) : null;

  if (loadingState) {
    return (
      <PageLoadingState
        message={loadingState.message}
        variant={loadingState.variant}
      />
    );
  }

  return <>{children}</>;
}

function normalizeInternalPath(href: string) {
  if (!href) return null;

  if (href.startsWith("/")) {
    return stripQueryAndHash(href);
  }

  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return stripQueryAndHash(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}

function stripQueryAndHash(href: string) {
  const [path] = href.split(/[?#]/, 1);
  return path || "/";
}

function matchesPath(currentPath: string, targetPath: string) {
  if (currentPath === targetPath) return true;
  if (targetPath === "/") return currentPath === targetPath;
  return currentPath.startsWith(`${targetPath}/`);
}

function getLoadingStateForPath(pathname: string): {
  message: string;
  variant: PageLoadingVariant;
} {
  if (pathname === "/dashboard") {
    return { message: "Loading dashboard...", variant: "dashboard" };
  }

  if (pathname === "/portfolios") {
    return { message: "Loading portfolios...", variant: "portfolio" };
  }

  if (pathname.startsWith("/portfolios/")) {
    return {
      message: "Loading portfolio details...",
      variant: "portfolio-detail",
    };
  }

  if (pathname === "/market") {
    return { message: "Loading market overview...", variant: "market" };
  }

  if (pathname === "/market/strategy") {
    return {
      message: "Loading funds daily returns report...",
      variant: "strategy",
    };
  }

  if (pathname === "/market/sectors") {
    return {
      message: "Loading sector performance...",
      variant: "sector-list",
    };
  }

  if (pathname.startsWith("/market/sectors/")) {
    return { message: "Loading sector details...", variant: "sector-detail" };
  }

  if (
    pathname === "/market/us" ||
    pathname === "/market/india" ||
    pathname === "/market/world" ||
    pathname === "/market/oil" ||
    pathname === "/market/commodities" ||
    pathname === "/market/crypto"
  ) {
    return { message: "Loading market board...", variant: "global-market" };
  }

  if (pathname === "/market/mutual-funds" || pathname === "/market/etfs") {
    return { message: "Loading market list...", variant: "list" };
  }

  if (
    pathname.startsWith("/market/mutual-funds/") ||
    pathname.startsWith("/market/etfs/")
  ) {
    return { message: "Loading fund profile...", variant: "fund-detail" };
  }

  if (pathname.startsWith("/market/")) {
    return { message: "Loading market board...", variant: "list" };
  }

  if (pathname === "/analysis/fundamentals") {
    return { message: "Loading fundamentals...", variant: "fundamentals" };
  }

  if (pathname.startsWith("/analysis/")) {
    return { message: "Loading analysis tools...", variant: "list" };
  }

  if (pathname === "/watchlist") {
    return { message: "Loading watchlist...", variant: "list" };
  }

  if (pathname === "/alerts") {
    return { message: "Loading alerts...", variant: "list" };
  }

  if (pathname === "/admin") {
    return { message: "Loading admin dashboard...", variant: "admin" };
  }

  if (pathname.startsWith("/admin/users/")) {
    return { message: "Loading user account...", variant: "admin-user" };
  }

  if (pathname.startsWith("/stock/")) {
    return { message: "Loading stock details...", variant: "stock" };
  }

  if (pathname === "/explore/world-monitor") {
    return { message: "Loading world monitor...", variant: "global-market" };
  }

  if (pathname.startsWith("/explore/") || pathname === "/youtubers") {
    return { message: "Loading page...", variant: "list" };
  }

  return { message: "Loading workspace...", variant: "default" };
}
