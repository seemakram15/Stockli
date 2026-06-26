import { redirect } from "next/navigation";
import Link from "next/link";
import { isDemoMode } from "@/lib/config";
import { getSessionContext } from "@/lib/auth/roles";
import { Logo } from "@/components/logo";
import { DesktopNav } from "@/components/shell/desktop-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationBell } from "@/components/shell/notification-bell";
import { UserMenu } from "@/components/shell/user-menu";
import { DemoBanner } from "@/components/shell/demo-banner";
import { DataDelayBadge } from "@/components/status-badges";
import { BackgroundCacheWarmup } from "@/components/background-cache-warmup";
import { ConsentManager } from "@/components/notifications/consent-manager";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getSessionContext();
  if (!user) redirect("/login");
  const showAdmin = role === "superadmin";

  return (
    <div className="min-h-screen bg-background">
      <BackgroundCacheWarmup />
      <ConsentManager />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[100] flex h-[calc(3.5rem+env(safe-area-inset-top))] min-w-0 items-center gap-1.5 border-b border-border bg-background/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:h-[calc(4rem+env(safe-area-inset-top))] sm:gap-2 sm:px-6 lg:h-16 lg:gap-3 lg:px-8 lg:pt-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <MobileNav showAdmin={showAdmin} />
            <Link href="/dashboard" className="hidden shrink-0 lg:flex">
              <Logo />
            </Link>
            <div className="hidden h-8 w-px shrink-0 bg-border lg:block" />
            <DesktopNav showAdmin={showAdmin} />
            <div className="flex min-w-0 flex-1 items-center lg:hidden">
              <GlobalSearch mode="mobile" />
            </div>
            <div className="hidden min-w-0 flex-1 lg:block" />
          </div>
          <DataDelayBadge className="hidden xl:inline-flex" />
          <GlobalSearch mode="desktop" />
          <NotificationBell userId={user.id} />
          <ThemeToggle />
          <UserMenu
            displayName={user.displayName}
            email={user.email}
            demo={isDemoMode}
          />
        </header>

        {isDemoMode && <DemoBanner />}

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
