import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Wordmark + glyph. The glyph is a stylised upward candlestick. */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="relative flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M7 14l3-4 3 3 4-6" />
          <path d="M17 7h-3" opacity="0.5" />
        </svg>
      </span>
      {showText && (
        <span className="text-lg leading-none tracking-tight">{APP_NAME}</span>
      )}
    </span>
  );
}
