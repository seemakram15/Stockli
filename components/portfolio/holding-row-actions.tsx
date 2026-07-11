"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, ArrowLeftRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { AddTradeDialog } from "./add-trade-dialog";
import { removeHolding } from "@/lib/actions/portfolio";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";

export function HoldingRowActions({
  portfolioId,
  holdingId,
  symbol,
  quantity,
  demo,
  userId,
}: {
  portfolioId: string;
  holdingId: string;
  symbol: string;
  quantity?: number;
  demo?: boolean;
  userId?: string | null;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <AddTradeDialog
        portfolioId={portfolioId}
        defaultSymbol={symbol}
        userId={userId}
        holdingsBySymbol={quantity != null ? { [symbol]: quantity } : undefined}
        trigger={
          <Button variant="ghost" size="icon" className="size-8" aria-label="Trade">
            <ArrowLeftRight className="size-4" />
          </Button>
        }
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label="More">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/stock/${symbol}`}>
              <ExternalLink className="size-4" /> View detail
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <RemoveItem
            portfolioId={portfolioId}
            holdingId={holdingId}
            symbol={symbol}
            demo={demo}
            userId={userId}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RemoveItem({
  portfolioId,
  holdingId,
  symbol,
  demo,
  userId,
}: {
  portfolioId: string;
  holdingId: string;
  symbol: string;
  demo?: boolean;
  userId?: string | null;
}) {
  const router = useRouter();

  async function handleRemove(formData: FormData) {
    const result = await removeHolding(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${symbol} position removed.`);
      markPortfolioMutated({ portfolioId, userId });
      router.refresh();
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          variant="destructive"
          onSelect={(e) => e.preventDefault()}
        >
          <Trash2 className="size-4" /> Remove position
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {symbol}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the position from this portfolio. Transaction history is kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {demo ? (
            <AlertDialogAction
              onClick={() =>
                toast.error("Demo mode — add Supabase keys to remove positions.")
              }
            >
              Remove
            </AlertDialogAction>
          ) : (
            <form action={handleRemove}>
              <input type="hidden" name="holdingId" value={holdingId} />
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <input type="hidden" name="symbol" value={symbol} />
              <AlertDialogAction type="submit">Remove</AlertDialogAction>
            </form>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
