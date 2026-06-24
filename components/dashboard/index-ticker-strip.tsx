import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { formatNumber, formatPercent, formatSigned, plColorClass } from "@/lib/format";

export interface DashboardTickerItem {
  symbol: string;
  label?: string;
  current: number;
  change: number;
  changePct: number;
}

export function IndexTickerStrip({
  headline,
  items,
}: {
  headline: DashboardTickerItem | null;
  items: DashboardTickerItem[];
}) {
  const rows = items.filter((item) => Number.isFinite(item.current));
  if (!headline && rows.length === 0) return null;

  const mobileRows = headline ? [headline, ...rows] : rows;
  const desktopRows = rows;
  const mobileLoop = [...mobileRows, ...mobileRows];
  const desktopLoop = [...desktopRows, ...desktopRows];

  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {headline && (
        <div className="z-20 hidden shrink-0 items-center border-r border-border bg-card px-3 py-2 sm:px-4 md:flex">
          <TickerItem item={headline} featured />
        </div>
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent" />
        <div className="flex w-max gap-2 py-2 [animation:stockli-index-marquee_40s_linear_infinite] hover:[animation-play-state:paused] md:hidden">
          {mobileLoop.map((item, idx) => (
            <TickerItem
              key={`mobile-${item.symbol}-${idx}`}
              item={item}
              ariaHidden={idx >= mobileRows.length}
            />
          ))}
        </div>
        <div className="hidden w-max gap-2 py-2 [animation:stockli-index-marquee_40s_linear_infinite] hover:[animation-play-state:paused] md:flex">
          {desktopLoop.map((item, idx) => (
            <TickerItem
              key={`desktop-${item.symbol}-${idx}`}
              item={item}
              ariaHidden={idx >= desktopRows.length}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes stockli-index-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function TickerItem({
  item,
  ariaHidden = false,
  featured = false,
}: {
  item: DashboardTickerItem;
  ariaHidden?: boolean;
  featured?: boolean;
}) {
  const isUp = item.change > 0;
  const isDown = item.change < 0;
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
  const tone = plColorClass(item.change);

  return (
    <div
      aria-hidden={ariaHidden}
      className={
        featured
          ? "flex min-w-[12.5rem] items-center gap-3"
          : "flex min-w-[14rem] items-center gap-3 rounded-lg border border-border bg-background px-4 py-2 shadow-xs"
      }
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{item.label ?? item.symbol}</p>
      </div>
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(item.current, 2)}
      </span>
      <span className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${tone}`}>
        <Icon className="size-3.5" />
        {formatSigned(item.change, 2)}
        <span className="hidden text-xs sm:inline">{formatPercent(item.changePct)}</span>
      </span>
    </div>
  );
}
