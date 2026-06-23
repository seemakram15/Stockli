import { redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { isDemoMode } from "@/lib/config";
import { getSessionContext } from "@/lib/auth/roles";
import { Logo } from "@/components/logo";
import { NavLinks } from "@/components/shell/nav-links";
import { MobileNav } from "@/components/shell/mobile-nav";
import { GlobalSearch } from "@/components/shell/global-search";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationBell } from "@/components/shell/notification-bell";
import { UserMenu } from "@/components/shell/user-menu";
import { DemoBanner } from "@/components/shell/demo-banner";
import { DataDelayBadge } from "@/components/status-badges";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { RoutePrefetcher } from "@/components/shell/route-prefetcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role } = await getSessionContext();
  if (!user) redirect("/login");
  const showAdmin = role === "superadmin";

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
          <NavLinks showAdmin={showAdmin} />
        </div>
        <div className="space-y-3 border-t border-border px-5 py-4">
          <DataDelayBadge />
          <InstallAppButton size="sm" className="w-full justify-start" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Data sourced from{" "}
            <a
              href="https://dps.psx.com.pk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
            >
              PSX Data Portal <ExternalLink className="size-3" />
            </a>
            . For personal, non-commercial use.
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] min-w-0 items-center gap-1.5 border-b border-border bg-background/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:h-[calc(4rem+env(safe-area-inset-top))] sm:gap-2 sm:px-6 lg:h-16 lg:pt-0">
          <MobileNav showAdmin={showAdmin} />
          <div className="flex min-w-0 flex-1 items-center">
            <GlobalSearch />
          </div>
          <NotificationBell />
          <ThemeToggle />
          <UserMenu
            displayName={user.displayName}
            email={user.email}
            demo={isDemoMode}
          />
        </header>

        <RoutePrefetcher />

        {isDemoMode && <DemoBanner />}

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
