import * as React from "react";
import { cn } from "@/lib/utils";
import { AccentPill, IconChip, type Accent } from "@/components/ui/accent";

export function PageHeader({
  title,
  description,
  actions,
  icon,
  eyebrow,
  accent = "primary",
  gradientTitle = false,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional glyph shown in a colourful gradient chip beside the title. */
  icon?: React.ReactNode;
  /** Optional small label pill above the title. */
  eyebrow?: React.ReactNode;
  /** Colour family for the icon chip + eyebrow. */
  accent?: Accent;
  /** Render the title with the emerald→sky brand gradient. */
  gradientTitle?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        {icon && (
          <IconChip accent={accent} variant="gradient" size="lg" className="mt-0.5">
            {icon}
          </IconChip>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <AccentPill accent={accent} className="mb-2">
              {eyebrow}
            </AccentPill>
          )}
          <h1
            className={cn(
              "text-balance text-2xl font-bold tracking-tight sm:truncate",
              gradientTitle && "text-gradient-emerald w-fit"
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
