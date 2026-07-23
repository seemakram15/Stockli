import * as React from "react";
import Link from "next/link";
import { Logo, type LogoSurface } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { IconChip, type Accent } from "@/components/ui/accent";
import { APP_NAME } from "@/lib/constants";

/**
 * Presentational chrome shared by all auth routes (login / signup /
 * forgot-password / reset-password). Renders the brand glyph + wordmark, a
 * colourful gradient icon chip, the heading copy and a glass `feature` card
 * around whatever form is passed in. Logic-free.
 */
export function AuthCardShell({
  icon,
  accent = "primary",
  title,
  description,
  children,
  footer,
  brandSurface = "auth",
}: {
  icon: React.ReactNode;
  accent?: Accent;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** login/signup → auth (green); reset-password → auth-reset (gold) */
  brandSurface?: Extract<LogoSurface, "auth" | "auth-reset" | "mobile">;
}) {
  return (
    <div>
      <Link
        href="/"
        aria-label={`${APP_NAME} home`}
        className="mb-6 inline-flex items-center gap-2.5 font-semibold lg:hidden"
      >
        <Logo surface={brandSurface} />
      </Link>

      <Card variant="feature" className="p-6 sm:p-7">
        <div className="mb-6">
          <IconChip accent={accent} variant="gradient" size="lg">
            {icon}
          </IconChip>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children}
      </Card>

      {footer && (
        <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
      )}
    </div>
  );
}
