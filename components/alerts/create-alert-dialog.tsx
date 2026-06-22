"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SymbolField } from "@/components/portfolio/symbol-field";
import { createAlert, type AlertActionState } from "@/lib/actions/alerts";
import { effectiveQuotePrice } from "@/lib/services/metrics";
import type { Quote } from "@/lib/types";

export function CreateAlertDialog({
  defaultSymbol,
  trigger,
}: {
  defaultSymbol?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<AlertActionState, FormData>(
    createAlert,
    {}
  );
  const [targetPrice, setTargetPrice] = React.useState("");
  const [priceLoading, setPriceLoading] = React.useState(false);
  const priceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceRequestId = React.useRef(0);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Alert created");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  const onSymbol = React.useCallback((sym: string) => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    const s = sym.trim().toUpperCase();
    const requestId = priceRequestId.current + 1;
    priceRequestId.current = requestId;
    if (s.length < 1) {
      setPriceLoading(false);
      return;
    }

    setPriceLoading(true);
    priceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/prices?symbols=${encodeURIComponent(s)}`);
        const data = await res.json();
        const q: Quote | undefined = data.quotes?.[0];
        const latest = q && q.symbol.toUpperCase() === s ? effectiveQuotePrice(q) : null;
        if (latest != null && priceRequestId.current === requestId) {
          setTargetPrice(String(latest));
        }
      } catch {
        /* ignore */
      } finally {
        if (priceRequestId.current === requestId) setPriceLoading(false);
      }
    }, 350);
  }, []);

  React.useEffect(() => {
    return () => {
      if (priceTimer.current) clearTimeout(priceTimer.current);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Bell className="size-4" /> Set alert
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>New price alert</DialogTitle>
            <DialogDescription>
              Evaluated on each price refresh (~15 min) while the market is open.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Symbol</Label>
              <SymbolField defaultValue={defaultSymbol ?? ""} required onSymbolChange={onSymbol} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <Select name="condition" defaultValue="ABOVE">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABOVE">Rises above</SelectItem>
                    <SelectItem value="BELOW">Falls below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target" className="flex items-center gap-1.5">
                  Target (PKR)
                  {priceLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                </Label>
                <Input
                  id="target"
                  name="target_price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="auto-filled"
                  value={targetPrice}
                  onChange={(event) => setTargetPrice(event.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
