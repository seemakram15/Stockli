"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { toast } from "sonner";
import { Settings, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePortfolio, deletePortfolio, type ActionState } from "@/lib/actions/portfolio";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";

export function PortfolioSettings({
  id,
  name,
  description,
  demo,
}: {
  id: string;
  name: string;
  description: string | null;
  demo?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updatePortfolio,
    {}
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved");
      markPortfolioMutated({ portfolioId: id });
      router.refresh();
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, id, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="size-4" /> Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <DialogHeader>
            <DialogTitle>Portfolio settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="pf-name">Name</Label>
              <Input id="pf-name" name="name" defaultValue={name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-desc">Description</Label>
              <Input id="pf-desc" name="description" defaultValue={description ?? ""} />
            </div>
          </div>
          <DialogFooter className="justify-between sm:justify-between">
            <DeleteButton id={id} name={name} demo={demo} onDeleted={() => setOpen(false)} />
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({
  id,
  name,
  demo,
  onDeleted,
}: {
  id: string;
  name: string;
  demo?: boolean;
  onDeleted: () => void;
}) {
  const router = useRouter();

  function afterDelete() {
    markPortfolioMutated({ portfolioId: id });
    onDeleted();
    router.push("/portfolios");
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className="text-loss hover:text-loss">
          <Trash2 className="size-4" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the portfolio and all its holdings and
            transactions. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {demo ? (
            <AlertDialogAction
              onClick={() => toast.error("Demo mode — add Supabase keys to delete.")}
            >
              Delete
            </AlertDialogAction>
          ) : (
            <form
              action={async (formData) => {
                await deletePortfolio(formData);
                afterDelete();
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
