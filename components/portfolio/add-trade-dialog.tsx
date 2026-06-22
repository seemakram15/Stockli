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
import { addHolding, sellHolding, type ActionState } from "@/lib/actions/portfolio";

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
  const today = "2026-06-22";
  const [state, action, pending] = useActionState<ActionState, FormData>(
    kind === "buy" ? addHolding : sellHolding,
    {}
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={action} className="space-y-4 pt-4">
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <div className="space-y-1.5">
        <Label>Symbol</Label>
        <SymbolField defaultValue={defaultSymbol ?? ""} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-qty`}>Quantity</Label>
          <Input id={`${kind}-qty`} name="quantity" type="number" min="1" step="1" placeholder="100" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-price`}>Price (PKR)</Label>
          <Input id={`${kind}-price`} name="price" type="number" min="0" step="0.01" placeholder="150.25" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${kind}-date`}>Date</Label>
        <Input id={`${kind}-date`} name="date" type="date" defaultValue={today} max={today} />
      </div>
      <Button type="submit" className="w-full" disabled={pending} variant={kind === "sell" ? "destructive" : "default"}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {kind === "buy" ? "Add buy" : "Record sell"}
      </Button>
    </form>
  );
}
