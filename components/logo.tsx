import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/**
 * Stockli wordmark + glyph. The glyph is ascending bars with an upward arrow,
 * in the brand green→blue gradient. Rendered as inline SVG so it stays crisp
 * and theme-independent at any size.
 */
export function Logo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5 font-semibold", className)}>
      <StockliGlyph className="size-7" />
      {showText && (
        <span className="text-lg leading-none tracking-tight">{APP_NAME}</span>
      )}
    </span>
  );
}

export function StockliGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient
          id="stockli-grad"
          x1="3"
          y1="29"
          x2="29"
          y2="5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#22c55e" />
          <stop offset="0.55" stopColor="#16b3c6" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {/* ascending bars */}
      <rect x="4" y="18" width="5" height="10" rx="1.4" fill="url(#stockli-grad)" opacity="0.38" />
      <rect x="13" y="13" width="5" height="15" rx="1.4" fill="url(#stockli-grad)" opacity="0.6" />
      <rect x="22" y="8" width="5" height="20" rx="1.4" fill="url(#stockli-grad)" opacity="0.82" />
      {/* upward trend arrow */}
      <path
        d="M4 23 L13 15 L19 19 L28 8.5"
        stroke="url(#stockli-grad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22.5 8.5 H28 V14"
        stroke="url(#stockli-grad)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
