"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SymbolField } from "./symbol-field";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";
import { addHolding, sellHolding, type ActionState } from "@/lib/actions/portfolio";
import { PSX_TIMEZONE } from "@/lib/constants";
import type { Quote } from "@/lib/types";

export function AddTradeDialog({
  portfolioId,
  defaultSymbol,
  defaultTab = "buy",
  trigger,
}: {
  portfolioId: string;
  defaultSymbol?: string;
  defaultTab?: "buy" | "sell";
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> Add trade
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a trade</DialogTitle>
          <DialogDescription>
            Buys update your weighted-average cost; every trade is logged.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>
          <TabsContent value="buy">
            <TradeForm
              kind="buy"
              portfolioId={portfolioId}
              defaultSymbol={defaultSymbol}
              onDone={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="sell">
            <TradeForm
              kind="sell"
              portfolioId={portfolioId}
              defaultSymbol={defaultSymbol}
              onDone={() => setOpen(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function TradeForm({
  kind,
  portfolioId,
  defaultSymbol,
  onDone,
}: {
  kind: "buy" | "sell";
  portfolioId: string;
  defaultSymbol?: string;
  onDone: () => void;
}) {
  const today = React.useMemo(() => todayInPkt(), []);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    kind === "buy" ? addHolding : sellHolding,
    {}
  );
  const [price, setPrice] = React.useState("");
  const [priceLoading, setPriceLoading] = React.useState(false);
  const priceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved");
      markPortfolioMutated({ portfolioId });
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill the latest price when a symbol is chosen (still editable).
  const onSymbol = React.useCallback((sym: string) => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    const s = sym.trim().toUpperCase();
    if (s.length < 1) return;
    setPriceLoading(true);
    priceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/prices?symbols=${encodeURIComponent(s)}`);
        const data = await res.json();
        const q: Quote | undefined = data.quotes?.[0];
        if (q && q.symbol.toUpperCase() === s && q.price != null) {
          setPrice(String(q.price));
        }
      } catch {
        /* ignore */
      } finally {
        setPriceLoading(false);
      }
    }, 350);
  }, []);

  React.useEffect(() => {
    return () => {
      if (priceTimer.current) clearTimeout(priceTimer.current);
    };
  }, []);

  return (
    <form action={action} className="space-y-4 pt-4">
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <div className="space-y-1.5">
        <Label>Symbol</Label>
        <SymbolField defaultValue={defaultSymbol ?? ""} required onSymbolChange={onSymbol} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-qty`}>Quantity</Label>
          <Input id={`${kind}-qty`} name="quantity" type="number" min="1" step="1" placeholder="100" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-price`} className="flex items-center gap-1.5">
            Price (PKR)
            {priceLoading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </Label>
          <Input
            id={`${kind}-price`}
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="auto-filled"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${kind}-date`}>Date</Label>
        <Input id={`${kind}-date`} name="date" type="date" defaultValue={today} max={today} />
      </div>
      <p className="text-xs text-muted-foreground">
        Price auto-fills with the latest quote — edit it to match your fill.
      </p>
      <Button type="submit" className="w-full" disabled={pending} variant={kind === "sell" ? "destructive" : "default"}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {kind === "buy" ? "Buy" : "Sell"}
      </Button>
    </form>
  );
}

function todayInPkt(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PSX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
