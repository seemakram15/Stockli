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

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Alert created");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

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
              <SymbolField defaultValue={defaultSymbol ?? ""} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label htmlFor="target">Target (PKR)</Label>
                <Input id="target" name="target_price" type="number" min="0" step="0.01" placeholder="200" required />
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
