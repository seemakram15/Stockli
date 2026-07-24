import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { config, isSupabaseConfigured } from "@/lib/config";
import { formatBytes, monitorFetchJson } from "@/lib/services/control-panel/monitor-http";

export type SupabaseMonitorSnapshot = {
  scannedAt: string;
  configured: boolean;
  missing: string[];
  project: {
    ref: string;
    name: string;
    region: string | null;
    status: string | null;
    createdAt: string | null;
  } | null;
  users: {
    total: number | null;
  };
  storage: {
    bucketCount: number | null;
    buckets: Array<{ id: string; name: string; public: boolean }>;
  };
  requests: {
    window: string;
    series: Array<{
      t: string;
      auth: number;
      rest: number;
      realtime: number;
      storage: number;
      total: number;
    }>;
    totals: {
      auth: number;
      rest: number;
      realtime: number;
      storage: number;
      total: number;
    };
  };
  database: {
    sizeBytes: number | null;
    sizeLabel: string;
    note: string | null;
  };
  notes: string[];
};

type MgmtProject = {
  id?: string;
  name?: string;
  region?: string;
  status?: string;
  created_at?: string;
};

type ApiCountRow = {
  timestamp?: string;
  total_auth_requests?: number;
  total_rest_requests?: number;
  total_realtime_requests?: number;
  total_storage_requests?: number;
};

function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

export async function getSupabaseMonitorSnapshot(): Promise<SupabaseMonitorSnapshot> {
  const scannedAt = new Date().toISOString();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? "";
  const missing: string[] = [];
  if (!accessToken) missing.push("SUPABASE_ACCESS_TOKEN");
  if (!isSupabaseConfigured) missing.push("NEXT_PUBLIC_SUPABASE_URL");

  const ref =
    projectRefFromUrl(config.supabase.url) ??
    process.env.SUPABASE_PROJECT_REF?.trim() ??
    "";

  if (!accessToken || !ref) {
    return emptySnapshot(scannedAt, missing.length ? missing : ["SUPABASE_ACCESS_TOKEN"]);
  }

  const headers = { Authorization: `Bearer ${accessToken}` };
  const notes: string[] = [];

  const project = await monitorFetchJson<MgmtProject>(
    `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}`,
    { headers }
  );

  let apiRows: ApiCountRow[] = [];
  try {
    const apiCounts = await monitorFetchJson<{ result?: ApiCountRow[] }>(
      `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/analytics/endpoints/usage.api-counts?isoformat=now-24h`,
      { headers }
    );
    apiRows = Array.isArray(apiCounts.result) ? apiCounts.result : [];
  } catch (e) {
    notes.push(`API request analytics unavailable: ${e instanceof Error ? e.message : String(e)}`);
  }

  const series = apiRows.map((row) => {
    const auth = Number(row.total_auth_requests ?? 0);
    const rest = Number(row.total_rest_requests ?? 0);
    const realtime = Number(row.total_realtime_requests ?? 0);
    const storage = Number(row.total_storage_requests ?? 0);
    return {
      t: String(row.timestamp ?? ""),
      auth,
      rest,
      realtime,
      storage,
      total: auth + rest + realtime + storage,
    };
  });

  const totals = series.reduce(
    (acc, row) => ({
      auth: acc.auth + row.auth,
      rest: acc.rest + row.rest,
      realtime: acc.realtime + row.realtime,
      storage: acc.storage + row.storage,
      total: acc.total + row.total,
    }),
    { auth: 0, rest: 0, realtime: 0, storage: 0, total: 0 }
  );

  let usersTotal: number | null = null;
  let bucketCount: number | null = null;
  let buckets: Array<{ id: string; name: string; public: boolean }> = [];
  let dbSizeBytes: number | null = null;
  let dbNote: string | null = null;

  if (isSupabaseConfigured && config.supabase.serviceRoleKey) {
    try {
      const admin = createAdminClient();
      const [{ count }, { data: bucketData, error: bucketError }] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.storage.listBuckets(),
      ]);
      usersTotal = count ?? null;
      if (!bucketError && Array.isArray(bucketData)) {
        bucketCount = bucketData.length;
        buckets = bucketData.slice(0, 12).map((b) => ({
          id: b.id,
          name: b.name,
          public: Boolean(b.public),
        }));
      }
    } catch (e) {
      notes.push(`Service-role metrics unavailable: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const endpoint of [
    "usage.db-size",
    "database.disk_usage",
    "project.disk-size",
    "infra.db_size",
  ]) {
    try {
      const res = await monitorFetchJson<{
        result?: Array<{
          total_db_size_bytes?: number;
          disk_usage_bytes?: number;
          size_bytes?: number;
        }>;
      }>(
        `https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}/analytics/endpoints/${endpoint}?isoformat=now-24h`,
        { headers }
      );
      const last = Array.isArray(res.result) ? res.result[res.result.length - 1] : null;
      const bytes = last?.total_db_size_bytes ?? last?.disk_usage_bytes ?? last?.size_bytes ?? null;
      if (typeof bytes === "number") {
        dbSizeBytes = bytes;
        break;
      }
    } catch {
      // try next endpoint name
    }
  }

  if (dbSizeBytes == null) {
    dbNote = "Database size analytics endpoint is not available for this project.";
  }

  return {
    scannedAt,
    configured: true,
    missing: [],
    project: {
      ref,
      name: project.name ?? ref,
      region: project.region ?? null,
      status: project.status ?? null,
      createdAt: project.created_at ?? null,
    },
    users: { total: usersTotal },
    storage: { bucketCount, buckets },
    requests: {
      window: "last 24h",
      series,
      totals,
    },
    database: {
      sizeBytes: dbSizeBytes,
      sizeLabel: formatBytes(dbSizeBytes),
      note: dbNote,
    },
    notes,
  };
}

function emptySnapshot(scannedAt: string, missing: string[]): SupabaseMonitorSnapshot {
  return {
    scannedAt,
    configured: false,
    missing,
    project: null,
    users: { total: null },
    storage: { bucketCount: null, buckets: [] },
    requests: {
      window: "last 24h",
      series: [],
      totals: { auth: 0, rest: 0, realtime: 0, storage: 0, total: 0 },
    },
    database: { sizeBytes: null, sizeLabel: "—", note: null },
    notes: ["Add SUPABASE_ACCESS_TOKEN to enable Supabase monitoring."],
  };
}
