"use client";

import * as React from "react";
import { useActionState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleWatchlist, type ToggleState } from "@/lib/actions/watchlist";

export function WatchButton({
  symbol,
  initialWatching = false,
}: {
  symbol: string;
  initialWatching?: boolean;
}) {
  const [watching, setWatching] = React.useState(initialWatching);
  const [state, action, pending] = useActionState<ToggleState, FormData>(
    toggleWatchlist,
    {}
  );

  React.useEffect(() => {
    if (state.watching !== undefined) {
      setWatching(state.watching);
      toast.success(state.watching ? "Added to watchlist" : "Removed from watchlist");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="symbol" value={symbol} />
      <input type="hidden" name="watching" value={String(watching)} />
      <Button type="submit" variant={watching ? "secondary" : "outline"} disabled={pending}>
        <Star className={cn("size-4", watching && "fill-chart-3 text-chart-3")} />
        {watching ? "Watching" : "Watch"}
      </Button>
    </form>
  );
}
