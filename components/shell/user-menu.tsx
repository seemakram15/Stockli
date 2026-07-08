"use client";

import { Bell, LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { clearPrivateResourceCaches } from "@/lib/hooks/use-persistent-resource";

function initials(name: string | null, email: string | null): string {
  const base = name || email || "U";
  const parts = base.split(/[ @.]/).filter(Boolean);
  return (parts[0]?.[0] ?? "U").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export function UserMenu({
  displayName,
  email,
  avatarUrl,
  demo,
}: {
  displayName: string | null;
  email: string | null;
  avatarUrl?: string | null;
  demo?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:pr-3">
          <Avatar className="size-7">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName ?? email ?? "Account"} /> : null}
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials(displayName, email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
            {displayName ?? email ?? "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={12} className="z-[150] w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{displayName ?? "Account"}</span>
          {email && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          )}
          {demo && (
            <span className="mt-1 w-fit rounded bg-chart-3/15 px-1.5 py-0.5 text-[10px] font-medium text-chart-3">
              DEMO MODE
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/portfolios">
            <UserIcon className="size-4" /> Portfolios
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/alerts">
            <Bell className="size-4" /> Alerts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account">
            <ShieldCheck className="size-4" /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form
          action={signOut}
          onSubmit={() => {
            void clearPrivateResourceCaches({ includeLegacyDeviceCache: true });
          }}
        >
          <button type="submit" className="w-full">
            <DropdownMenuItem variant="destructive" asChild>
              <span className="cursor-pointer">
                <LogOut className="size-4" /> {demo ? "Exit to sign-in" : "Sign out"}
              </span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
