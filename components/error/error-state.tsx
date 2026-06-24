"use client";

import Link from "next/link";
import { AlertTriangle, Home, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  reset?: () => void;
  homeHref?: string;
  className?: string;
  digest?: string;
}

const SUPPORT_EMAIL = "seemakram15@gmail.com";

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this screen correctly. Please try again, and if it keeps happening contact support so we can fix it quickly.",
  reset,
  homeHref = "/dashboard",
  className,
  digest,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-10",
        className
      )}
    >
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-loss/10 text-loss">
          <AlertTriangle className="size-7" />
        </div>

        <div className="mt-5 flex justify-center">
          <Logo />
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-left">
          <p className="text-sm font-semibold text-foreground">Contact support</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Mail className="size-4" />
            {SUPPORT_EMAIL}
          </a>
          {digest ? (
            <p className="mt-3 break-all text-xs text-muted-foreground">
              Error reference: {digest}
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {reset ? (
            <Button type="button" onClick={reset}>
              <RefreshCw className="size-4" />
              Try again
            </Button>
          ) : null}
          <Button asChild variant={reset ? "outline" : "default"}>
            <Link href={homeHref}>
              <Home className="size-4" />
              Go back home
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
