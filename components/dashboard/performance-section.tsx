import { getPortfolioPerformance } from "@/lib/services/performance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Async server component for the (slow) performance chart. Rendered inside a
 * <Suspense> boundary so the rest of the dashboard paints immediately and this
 * streams in once the EOD history is ready.
 */
export async function PerformanceSection({
  positions,
}: {
  positions: { symbol: string; quantity: number }[];
}) {
  const performance = await getPortfolioPerformance(positions, 120);
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Performance vs KSE-100</CardTitle>
        <span className="text-xs text-muted-foreground">Last 120 trading days</span>
      </CardHeader>
      <CardContent>
        <PerformanceChart data={performance} />
      </CardContent>
    </Card>
  );
}

export function PerformanceSkeleton() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Performance vs KSE-100</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-[280px] items-end gap-1.5">
          {Array.from({ length: 28 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${30 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
