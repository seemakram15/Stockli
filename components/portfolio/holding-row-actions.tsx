"use client";

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
import * as React from "react";

export function HoldingRowActions({
  portfolioId,
  holdingId,
  symbol,
  demo,
}: {
  portfolioId: string;
  holdingId: string;
  symbol: string;
  demo?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <AddTradeDialog
        portfolioId={portfolioId}
        defaultSymbol={symbol}
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
}: {
  portfolioId: string;
  holdingId: string;
  symbol: string;
  demo?: boolean;
}) {
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
            This deletes the position from this portfolio. Your transaction
            history is kept for the audit log.
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
            <form action={removeHolding}>
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
