"use client";

import Link from "next/link";
import { Bell, BellOff, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
          <li key={a.id} className="py-3">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  a.condition === "ABOVE" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
                )}
              >
                {a.condition === "ABOVE" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/stock/${a.symbol}`} className="font-semibold hover:text-primary">
                    {a.symbol}
                  </Link>
                  <StatusBadge active={a.is_active} triggered={triggered} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {a.condition === "ABOVE" ? "Rises above" : "Falls below"}{" "}
                  <span className="font-medium text-foreground">{formatPKR(a.target_price)}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="text-sm tabular-nums">{formatPKR(price)}</p>
                    {distance != null && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatPercent(distance)} to target
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <ToggleActionButton
                      demo={demo}
                      id={a.id}
                      active={a.is_active}
                    />
                    <DeleteActionButton
                      demo={demo}
                      id={a.id}
                      symbol={a.symbol}
                    />
                  </div>
                </div>
              </div>
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

function ToggleActionButton({
  id,
  active,
  demo,
}: {
  id: string;
  active: boolean;
  demo?: boolean;
}) {
  const label = active ? "Pause" : "Resume";
  if (demo) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={label}
        onClick={() => toast.error("Demo mode — add Supabase keys to manage alerts.")}
      >
        {active ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      </Button>
    );
  }
  return (
    <form
      action={async (formData) => {
        await toggleAlert(formData);
        toast.success(active ? "Alert paused." : "Alert resumed.");
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(active)} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={label}
      >
        {active ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      </Button>
    </form>
  );
}

function DeleteActionButton({
  id,
  symbol,
  demo,
}: {
  id: string;
  symbol: string;
  demo?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-loss hover:text-loss"
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {symbol} alert?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the alert permanently. You can create a new alert for
            this symbol any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {demo ? (
            <AlertDialogAction onClick={() => toast.error("Demo mode — add Supabase keys to manage alerts.")}>
              Delete
            </AlertDialogAction>
          ) : (
            <form
              action={async (formData) => {
                await deleteAlert(formData);
                toast.success("Alert deleted.");
              }}
            >
              <input type="hidden" name="id" value={id} />
              <AlertDialogAction type="submit">Delete</AlertDialogAction>
            </form>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
