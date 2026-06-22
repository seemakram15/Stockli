"use client";

import type * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function SmartBackLink({
  fallbackHref,
  label = "Back",
  className = "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined") return;
    const referrer = document.referrer;
    const cameFromThisApp =
      referrer && new URL(referrer).origin === window.location.origin;
    if (cameFromThisApp && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link href={fallbackHref} onClick={onClick} className={className}>
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
