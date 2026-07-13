import { NextResponse } from "next/server";
import { getPortfolioPerformance } from "@/lib/services/performance";
import { getDashboard, getSessionUser } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { holdings, portfolios } = await getDashboard();

  const performancePortfolios = portfolios
    .map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      positions: holdings
        .filter((holding) => holding.portfolio_id === portfolio.id)
        .map((holding) => ({ symbol: holding.symbol, quantity: holding.quantity })),
    }))
    .filter((portfolio) => portfolio.positions.length > 0);

  const performance = await getPortfolioPerformance(performancePortfolios);

  return NextResponse.json(
    { data: performance },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
