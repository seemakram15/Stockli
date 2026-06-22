import "server-only";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/auth/roles";
import {
  enrichHoldings,
} from "@/lib/services/portfolio";
import {
  allocationBySector,
  computeRealizedPL,
  computeSummary,
} from "@/lib/services/metrics";
import {
  DEMO_ALERTS,
  DEMO_HOLDINGS,
  DEMO_PORTFOLIOS,
  DEMO_TRANSACTIONS,
  DEMO_USER,
  DEMO_WATCHLIST_ITEMS,
} from "@/lib/demo/data";
import type {
  Alert,
  HoldingWithMetrics,
  Portfolio,
  Transaction,
} from "@/lib/types";
import type { Role } from "@/lib/auth/roles";

/**
 * Admin service. EVERY function re-verifies the caller is a superadmin
 * (defense-in-depth on top of the page-level guard) before touching the
 * service-role client, which bypasses RLS. The service-role client is
 * server-only and never reaches the browser.
 */
async function assertSuperadmin() {
  if (!(await isSuperadmin())) {
    throw new Error("Forbidden: superadmin only");
  }
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  createdAt: string;
  portfolioCount: number;
  holdingCount: number;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  await assertSuperadmin();

  if (isDemoMode) {
    return [
      {
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        displayName: DEMO_USER.displayName,
        role: "superadmin",
        createdAt: "2025-09-01T09:00:00.000Z",
        portfolioCount: DEMO_PORTFOLIOS.length,
        holdingCount: DEMO_HOLDINGS.length,
      },
    ];
  }

  const admin = createAdminClient();
  const [{ data: authData }, { data: profiles }, { data: portfolios }, { data: holdings }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("id, display_name, role, created_at"),
      admin.from("portfolios").select("id, user_id"),
      admin.from("holdings").select("id, portfolio_id"),
    ]);

  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const pfByUser = new Map<string, number>();
  const pfToUser = new Map<string, string>();
  for (const p of (portfolios as { id: string; user_id: string }[] | null) ?? []) {
    pfToUser.set(p.id, p.user_id);
    pfByUser.set(p.user_id, (pfByUser.get(p.user_id) ?? 0) + 1);
  }
  const holdingsByUser = new Map<string, number>();
  for (const h of (holdings as { id: string; portfolio_id: string }[] | null) ?? []) {
    const uid = pfToUser.get(h.portfolio_id);
    if (uid) holdingsByUser.set(uid, (holdingsByUser.get(uid) ?? 0) + 1);
  }

  return (
    (profiles as { id: string; display_name: string | null; role: string; created_at: string }[] | null) ??
    []
  )
    .map((p) => ({
      id: p.id,
      email: emailById.get(p.id) ?? null,
      displayName: p.display_name,
      role: (p.role === "superadmin" ? "superadmin" : "user") as Role,
      createdAt: p.created_at,
      portfolioCount: pfByUser.get(p.id) ?? 0,
      holdingCount: holdingsByUser.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface PlatformStats {
  userCount: number;
  portfolioCount: number;
  holdingCount: number;
  superadminCount: number;
  totalValue: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  await assertSuperadmin();

  if (isDemoMode) {
    const enriched = await enrichHoldings(DEMO_HOLDINGS);
    return {
      userCount: 1,
      portfolioCount: DEMO_PORTFOLIOS.length,
      holdingCount: DEMO_HOLDINGS.length,
      superadminCount: 1,
      totalValue: computeSummary(enriched).totalValue,
    };
  }

  const admin = createAdminClient();
  const [{ data: profiles }, { data: portfolios }, { data: holdings }] = await Promise.all([
    admin.from("profiles").select("id, role"),
    admin.from("portfolios").select("id"),
    admin.from("holdings").select("*"),
  ]);

  const enriched = await enrichHoldings((holdings as never) ?? []);
  return {
    userCount: profiles?.length ?? 0,
    portfolioCount: portfolios?.length ?? 0,
    holdingCount: holdings?.length ?? 0,
    superadminCount:
      (profiles as { role: string }[] | null)?.filter((p) => p.role === "superadmin").length ?? 0,
    totalValue: computeSummary(enriched).totalValue,
  };
}

export interface UserOverview {
  profile: { id: string; displayName: string | null; role: Role; createdAt: string };
  email: string | null;
  portfolios: Portfolio[];
  holdings: HoldingWithMetrics[];
  summary: ReturnType<typeof computeSummary>;
  sectorAllocation: ReturnType<typeof allocationBySector>;
  transactions: Transaction[];
  watchlistSymbols: string[];
  alerts: Alert[];
}

export async function getUserOverview(userId: string): Promise<UserOverview | null> {
  await assertSuperadmin();

  if (isDemoMode) {
    const enriched = await enrichHoldings(DEMO_HOLDINGS);
    return {
      profile: {
        id: DEMO_USER.id,
        displayName: DEMO_USER.displayName,
        role: "superadmin",
        createdAt: "2025-09-01T09:00:00.000Z",
      },
      email: DEMO_USER.email,
      portfolios: DEMO_PORTFOLIOS,
      holdings: enriched,
      summary: computeSummary(enriched, computeRealizedPL(DEMO_TRANSACTIONS)),
      sectorAllocation: allocationBySector(enriched),
      transactions: [...DEMO_TRANSACTIONS].sort((a, b) =>
        b.transacted_at.localeCompare(a.transacted_at)
      ),
      watchlistSymbols: DEMO_WATCHLIST_ITEMS.map((i) => i.symbol),
      alerts: DEMO_ALERTS,
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, role, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const { data: portfolios } = await admin
    .from("portfolios")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const pfIds = ((portfolios as Portfolio[] | null) ?? []).map((p) => p.id);

  const [holdingsRes, txRes, wlRes, alertsRes] = await Promise.all([
    pfIds.length ? admin.from("holdings").select("*").in("portfolio_id", pfIds) : empty(),
    pfIds.length
      ? admin.from("transactions").select("*").in("portfolio_id", pfIds).order("transacted_at", { ascending: false })
      : empty(),
    admin.from("watchlists").select("id").eq("user_id", userId),
    admin.from("alerts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  const enriched = await enrichHoldings((holdingsRes.data as never) ?? []);
  const transactions = (txRes.data as Transaction[] | null) ?? [];

  const wlIds = ((wlRes.data as { id: string }[] | null) ?? []).map((w) => w.id);
  let watchlistSymbols: string[] = [];
  if (wlIds.length) {
    const { data: items } = await admin
      .from("watchlist_items")
      .select("symbol")
      .in("watchlist_id", wlIds);
    watchlistSymbols = ((items as { symbol: string }[] | null) ?? []).map((i) => i.symbol);
  }

  const p = profile as { id: string; display_name: string | null; role: string; created_at: string };
  return {
    profile: {
      id: p.id,
      displayName: p.display_name,
      role: p.role === "superadmin" ? "superadmin" : "user",
      createdAt: p.created_at,
    },
    email: authUser?.user?.email ?? null,
    portfolios: (portfolios as Portfolio[] | null) ?? [],
    holdings: enriched,
    summary: computeSummary(enriched, computeRealizedPL(transactions)),
    sectorAllocation: allocationBySector(enriched),
    transactions,
    watchlistSymbols,
    alerts: (alertsRes.data as Alert[] | null) ?? [],
  };
}

/** A resolved empty Supabase-style result for conditional queries. */
function empty(): Promise<{ data: never[] }> {
  return Promise.resolve({ data: [] as never[] });
}
