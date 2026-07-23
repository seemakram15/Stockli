import { redirect } from "next/navigation";
import Link from "next/link";
import { isDemoMode } from "@/lib/config";
import { getSessionContext } from "@/lib/auth/roles";
import { Logo } from "@/components/logo";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { DesktopNav } from "@/components/shell/desktop-nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationBell } from "@/components/shell/notification-bell";
import { UserMenu } from "@/components/shell/user-menu";
import { DemoBanner } from "@/components/shell/demo-banner";
import { BackgroundCacheWarmup } from "@/components/background-cache-warmup";
import { PsxCacheLifecycle } from "@/components/cache/psx-cache-lifecycle";
import { PrivateCacheLifecycle } from "@/components/cache/private-cache-lifecycle";
import { AccountWarmup } from "@/components/auth/account-warmup";
import { ConsentManager } from "@/components/notifications/consent-manager";
import { GuestSignupNudge } from "@/components/guest/guest-signup-nudge";
import {
  RouteTransitionProvider,
  RouteTransitionViewport,
} from "@/components/navigation/route-transition-provider";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, consent, isGuest, guestPageAccess, guestPopupEnabled } =
    await getSessionContext();
  if (!user) redirect("/login");
  const showAdmin = role === "superadmin";

  return (
    <RouteTransitionProvider>
      {/*
        Shell breakpoints (Tailwind defaults):
        - < lg (1024): mobile sheet via hamburger; no persistent sidebar
        - lg–2xl (1024–1535): left sidebar (toggleable; open by default); content flexes beside it
        - ≥ 2xl (1536): top horizontal primary nav; sidebar + toggle hidden
      */}
      <div className="min-h-screen bg-background">
        <BackgroundCacheWarmup />
        <PsxCacheLifecycle />
        <PrivateCacheLifecycle userId={user.id} />
        <AccountWarmup userId={user.id} demo={isDemoMode} />
        <ConsentManager
          userId={user.id}
          initialVapidPublicKey={consent.vapidPublicKey}
          initialNotificationStatus={consent.notificationStatus}
        />
        <div className="flex min-h-screen min-w-0">
          <AppSidebar
            showAdmin={showAdmin}
            isGuest={isGuest}
            guestPageAccess={guestPageAccess}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Avoid overflow-x-clip on header — CSS also clips Y, hiding absolute nav menus. */}
            <header className="relative sticky top-0 z-[100] flex h-[calc(3.5rem+env(safe-area-inset-top))] min-w-0 items-center gap-1.5 border-b border-border bg-background/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent before:content-[''] sm:h-[calc(4rem+env(safe-area-inset-top))] sm:gap-2 sm:px-6 lg:h-16 lg:gap-2 lg:px-4 lg:pt-0 2xl:gap-3 2xl:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:gap-2">
                <MobileNav
                  showAdmin={showAdmin}
                  isGuest={isGuest}
                  guestPageAccess={guestPageAccess}
                />
                <Link href="/dashboard" className="hidden shrink-0 lg:flex">
                  <Logo surface="desktop" beta />
                </Link>
                <div className="hidden h-8 w-px shrink-0 bg-border 2xl:block" />
                <DesktopNav
                  showAdmin={showAdmin}
                  isGuest={isGuest}
                  guestPageAccess={guestPageAccess}
                />
                <div className="flex min-w-0 flex-1 items-center overflow-x-clip lg:hidden">
                  <GlobalSearch mode="mobile" />
                </div>
                <div className="hidden min-w-0 flex-1 lg:block" />
              </div>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <GlobalSearch mode="desktop" />
                <NotificationBell userId={user.id} />
                <ThemeToggle />
                <UserMenu
                  displayName={user.displayName}
                  email={user.email}
                  avatarUrl={user.avatarUrl}
                  demo={isDemoMode}
                />
              </div>
            </header>

            {isDemoMode && <DemoBanner variant="demo" />}
            {!isDemoMode && isGuest && <DemoBanner variant="guest" />}
            {isGuest && guestPopupEnabled && <GuestSignupNudge />}

            <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
              <RouteTransitionViewport>{children}</RouteTransitionViewport>
            </main>
          </div>
        </div>
      </div>
    </RouteTransitionProvider>
  );
}
