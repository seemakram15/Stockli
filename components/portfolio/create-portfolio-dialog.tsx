"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";
import { createPortfolio, type ActionState } from "@/lib/actions/portfolio";

export function CreatePortfolioDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createPortfolio,
    {}
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Created");
      markPortfolioMutated();
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> New portfolio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <DialogHeader>
            <DialogTitle>New portfolio</DialogTitle>
            <DialogDescription>Group related positions together.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Long-Term Core" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" placeholder="Blue-chip buy-and-hold" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create portfolio
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
