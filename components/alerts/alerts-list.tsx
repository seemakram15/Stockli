"use client";

import Link from "next/link";
import { Bell, BellOff, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePrices } from "@/lib/hooks/use-prices";
import { formatPKR, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteAlert, toggleAlert } from "@/lib/actions/alerts";
import type { Alert } from "@/lib/types";

export function AlertsList({ alerts, demo }: { alerts: Alert[]; demo?: boolean }) {
  const symbols = alerts.map((a) => a.symbol);
  const { quotes } = usePrices(symbols);

  return (
    <ul className="divide-y divide-border">
      {alerts.map((a) => {
        const q = quotes.get(a.symbol.toUpperCase());
        const price = q?.price ?? null;
        const distance =
          price != null ? ((a.target_price - price) / price) * 100 : null;
        const triggered = !a.is_active && a.last_triggered_at != null;

        return (
          <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-lg",
                a.condition === "ABOVE" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
              )}
            >
              {a.condition === "ABOVE" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </span>

            <div className="min-w-32 flex-1">
              <Link href={`/stock/${a.symbol}`} className="font-semibold hover:text-primary">
                {a.symbol}
              </Link>
              <p className="text-sm text-muted-foreground">
                {a.condition === "ABOVE" ? "Rises above" : "Falls below"}{" "}
                <span className="font-medium text-foreground">{formatPKR(a.target_price)}</span>
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm tabular-nums">{formatPKR(price)}</p>
              {distance != null && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {formatPercent(distance)} to target
                </p>
              )}
            </div>

            <StatusBadge active={a.is_active} triggered={triggered} />

            <div className="flex items-center gap-1">
              <ActionButton
                demo={demo}
                action={toggleAlert}
                fields={{ id: a.id, active: String(a.is_active) }}
                label={a.is_active ? "Pause" : "Resume"}
                icon={a.is_active ? <BellOff className="size-4" /> : <Bell className="size-4" />}
              />
              <ActionButton
                demo={demo}
                action={deleteAlert}
                fields={{ id: a.id }}
                label="Delete"
                destructive
                icon={<Trash2 className="size-4" />}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({ active, triggered }: { active: boolean; triggered: boolean }) {
  const label = triggered ? "Triggered" : active ? "Active" : "Paused";
  const cls = triggered
    ? "bg-chart-3/15 text-chart-3"
    : active
      ? "bg-gain/10 text-gain"
      : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", cls)}>{label}</span>;
}

function ActionButton({
  action,
  fields,
  label,
  icon,
  destructive,
  demo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  demo?: boolean;
}) {
  if (demo) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("size-8", destructive && "text-loss hover:text-loss")}
        aria-label={label}
        onClick={() => toast.error("Demo mode — add Supabase keys to manage alerts.")}
      >
        {icon}
      </Button>
    );
  }
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className={cn("size-8", destructive && "text-loss hover:text-loss")}
        aria-label={label}
      >
        {icon}
      </Button>
    </form>
  );
}
