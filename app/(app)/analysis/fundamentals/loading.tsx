import { Loader2 } from "lucide-react";

export default function StockFundamentalsLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-primary" />
      Loading fundamentals...
    </div>
  );
}
