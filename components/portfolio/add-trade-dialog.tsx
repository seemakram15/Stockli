"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { calcBrokerFee, calcCGT } from "@/lib/services/tax";
import { PSX_TIMEZONE } from "@/lib/constants";
import type { Quote, TaxSettings } from "@/lib/types";

export function AddTradeDialog({
  portfolioId,
  defaultSymbol,
  defaultTab = "buy",
  trigger,
  userId,
  holdingsBySymbol,
  avgBuyPriceBySymbol,
  taxSettings,
}: {
  portfolioId: string;
  defaultSymbol?: string;
  defaultTab?: "buy" | "sell";
  trigger?: React.ReactNode;
  userId?: string | null;
  holdingsBySymbol?: Record<string, number>;
  avgBuyPriceBySymbol?: Record<string, number>;
  taxSettings?: TaxSettings;
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
              userId={userId}
              holdingsBySymbol={holdingsBySymbol}
              taxSettings={taxSettings}
              onDone={() => setOpen(false)}
            />
          </TabsContent>
          <TabsContent value="sell">
            <TradeForm
              kind="sell"
              portfolioId={portfolioId}
              defaultSymbol={defaultSymbol}
              userId={userId}
              holdingsBySymbol={holdingsBySymbol}
              avgBuyPriceBySymbol={avgBuyPriceBySymbol}
              taxSettings={taxSettings}
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
  userId,
  holdingsBySymbol,
  avgBuyPriceBySymbol,
  taxSettings,
  onDone,
}: {
  kind: "buy" | "sell";
  portfolioId: string;
  defaultSymbol?: string;
  userId?: string | null;
  holdingsBySymbol?: Record<string, number>;
  avgBuyPriceBySymbol?: Record<string, number>;
  taxSettings?: TaxSettings;
  onDone: () => void;
}) {
  const router = useRouter();
  const today = React.useMemo(() => todayInPkt(), []);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    kind === "buy" ? addHolding : sellHolding,
    {}
  );
  const [price, setPrice] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [fees, setFees] = React.useState("");
  const [priceLoading, setPriceLoading] = React.useState(false);
  const [selectedSymbol, setSelectedSymbol] = React.useState(defaultSymbol?.toUpperCase() ?? "");
  const priceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved");
      markPortfolioMutated({ portfolioId, userId });
      router.refresh();
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, portfolioId, router, onDone, userId]);

  // Auto-fill the latest price when a symbol is chosen (still editable).
  const onSymbol = React.useCallback((sym: string) => {
    const s = sym.trim().toUpperCase();
    setSelectedSymbol(s);
    if (priceTimer.current) clearTimeout(priceTimer.current);
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

  // Auto-compute broker fee when qty or price changes
  React.useEffect(() => {
    if (!taxSettings) return;
    const q = parseFloat(qty);
    const p = parseFloat(price);
    if (Number.isFinite(q) && Number.isFinite(p) && q > 0 && p > 0) {
      const computed = calcBrokerFee(q * p, taxSettings.brokerFeePct);
      setFees(computed.toFixed(2));
    }
  }, [qty, price, taxSettings]);

  const currentHolding =
    kind === "sell" && selectedSymbol && holdingsBySymbol
      ? (holdingsBySymbol[selectedSymbol] ?? null)
      : null;

  const avgBuyPrice =
    kind === "sell" && selectedSymbol && avgBuyPriceBySymbol
      ? (avgBuyPriceBySymbol[selectedSymbol] ?? null)
      : null;

  const estCGT = React.useMemo(() => {
    if (kind !== "sell" || !taxSettings || !avgBuyPrice) return null;
    const q = parseFloat(qty);
    const p = parseFloat(price);
    if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0 || p <= 0) return null;
    const proceeds = q * p - parseFloat(fees || "0");
    const costBasis = q * avgBuyPrice;
    const pl = proceeds - costBasis;
    return calcCGT(pl, taxSettings);
  }, [kind, taxSettings, avgBuyPrice, qty, price, fees]);

  return (
    <form action={action} className="space-y-4 pt-4">
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <div className="space-y-1.5">
        <Label>Symbol</Label>
        <SymbolField defaultValue={defaultSymbol ?? ""} required onSymbolChange={onSymbol} />
        {currentHolding != null && (
          <p className="text-xs text-muted-foreground">
            Currently holding: <span className="font-medium tabular-nums">{currentHolding}</span> shares
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-qty`}>Quantity</Label>
          <Input
            id={`${kind}-qty`}
            name="quantity"
            type="number"
            min="1"
            step="1"
            placeholder="100"
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-fees`}>Broker fee (PKR)</Label>
          <Input
            id={`${kind}-fees`}
            name="fees"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-date`}>Date</Label>
          <Input id={`${kind}-date`} name="date" type="date" defaultValue={today} max={today} />
        </div>
      </div>
      {kind === "sell" && estCGT !== null && estCGT > 0 && (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Est. CGT: <span className="font-medium tabular-nums text-foreground">PKR {estCGT.toLocaleString("en-PK", { maximumFractionDigits: 0 })}</span>{" "}
          ({taxSettings?.taxFiler ? "15% filer" : "30% non-filer"}) — estimate only
        </div>
      )}
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
