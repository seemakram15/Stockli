import "server-only";
import { config } from "@/lib/config";
import {
  formatBytes,
  lastSeriesValue,
  monitorFetchJson,
  normalizeSeries,
  type MonitorSeriesPoint,
} from "@/lib/services/control-panel/monitor-http";

export type RedisMonitorSnapshot = {
  scannedAt: string;
  configured: boolean;
  missing: string[];
  database: {
    id: string;
    name: string;
    type: string | null;
    plan: string | null;
    region: string | null;
    primaryRegion: string | null;
    endpoint: string | null;
    state: string | null;
    eviction: boolean | null;
    budgetUsd: number | null;
  } | null;
  limits: {
    memoryBytes: number | null;
    memoryLabel: string;
    diskBytes: number | null;
    diskLabel: string;
    maxCommandsPerSecond: number | null;
    maxBandwidthBytes: number | null;
    maxBandwidthLabel: string;
  };
  live: {
    usedMemoryBytes: number | null;
    usedMemoryLabel: string;
    maxMemoryBytes: number | null;
    maxMemoryLabel: string;
    memoryPct: number | null;
    keys: number | null;
    evictedKeys: number | null;
    keyspaceHits: number | null;
    keyspaceMisses: number | null;
  };
  usage: {
    dailyNetCommands: number | null;
    dailyBandwidthBytes: number | null;
    dailyBandwidthLabel: string;
    totalMonthlyRequests: number | null;
    totalMonthlyBandwidthBytes: number | null;
    totalMonthlyBandwidthLabel: string;
    latestDailyCostUsd: number | null;
  };
  series: {
    commands: MonitorSeriesPoint[];
    bandwidth: MonitorSeriesPoint[];
    throughput: MonitorSeriesPoint[];
    latencyMean: MonitorSeriesPoint[];
    hits: MonitorSeriesPoint[];
    misses: MonitorSeriesPoint[];
    diskUsage: MonitorSeriesPoint[];
    keyspace: MonitorSeriesPoint[];
    billing: MonitorSeriesPoint[];
  };
  notes: string[];
};

type UpstashDb = {
  database_id?: string;
  database_name?: string;
  database_type?: string;
  type?: string;
  region?: string;
  primary_region?: string;
  endpoint?: string;
  state?: string;
  eviction?: boolean;
  budget?: number;
  db_memory_threshold?: number;
  db_disk_threshold?: number;
  db_max_commands_per_second?: number;
  db_max_bandwidth?: number;
};

type UpstashStats = {
  daily_net_commands?: number;
  dailybandwidth?: number;
  total_monthly_requests?: number;
  total_monthly_bandwidth?: number;
  dailybilling?: Array<{ x?: string; y?: number }>;
  daily_read_requests?: Array<{ x?: string; y?: number }> | number;
  daily_write_requests?: Array<{ x?: string; y?: number }> | number;
  throughput?: Array<{ x?: string; y?: number }>;
  latencymean?: Array<{ x?: string; y?: number }>;
  hits?: Array<{ x?: string; y?: number }>;
  misses?: Array<{ x?: string; y?: number }>;
  diskusage?: Array<{ x?: string; y?: number }>;
  keyspace?: Array<{ x?: string; y?: number }>;
  bandwidths?: Array<{ x?: string; y?: number }>;
};

function parseInfoMemory(info: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of info.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes(":")) continue;
    const [k, ...rest] = line.split(":");
    out[k.trim()] = rest.join(":").trim();
  }
  return out;
}

export async function getRedisMonitorSnapshot(): Promise<RedisMonitorSnapshot> {
  const scannedAt = new Date().toISOString();
  const email = process.env.UPSTASH_EMAIL?.trim() ?? "";
  const apiKey =
    process.env.UPSTASH_DEVELOPER_KEY?.trim() || process.env.UPSTASH_API_KEY?.trim() || "";
  const redisUrl = config.upstash.url;
  const redisToken = config.upstash.token;
  const missing: string[] = [];
  if (!email) missing.push("UPSTASH_EMAIL");
  if (!apiKey) missing.push("UPSTASH_DEVELOPER_KEY");
  if (!redisUrl) missing.push("UPSTASH_REDIS_REST_URL");
  if (!redisToken) missing.push("UPSTASH_REDIS_REST_TOKEN");

  if (!email || !apiKey) {
    return emptySnapshot(scannedAt, missing);
  }

  const basic = Buffer.from(`${email}:${apiKey}`).toString("base64");
  const headers = { Authorization: `Basic ${basic}` };
  const notes: string[] = [];

  const databases = await monitorFetchJson<UpstashDb[]>("https://api.upstash.com/v2/redis/databases", {
    headers,
  });
  const host = (() => {
    try {
      return redisUrl ? new URL(redisUrl).hostname : "";
    } catch {
      return "";
    }
  })();
  const db =
    databases.find((d) => host && (d.endpoint ?? "").includes(host.split(".")[0] ?? "")) ??
    databases[0] ??
    null;

  if (!db?.database_id) {
    return emptySnapshot(scannedAt, missing, ["No Upstash Redis database found for this account."]);
  }

  const stats = await monitorFetchJson<UpstashStats>(
    `https://api.upstash.com/v2/redis/stats/${encodeURIComponent(db.database_id)}`,
    { headers }
  );

  let usedMemoryBytes: number | null = null;
  let maxMemoryBytes: number | null = null;
  let keys: number | null = null;
  let evictedKeys: number | null = null;
  let keyspaceHits: number | null = null;
  let keyspaceMisses: number | null = null;

  if (redisUrl && redisToken) {
    try {
      const infoRes = await monitorFetchJson<{ result?: string }>(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["INFO", "memory"]),
      });
      const mem = parseInfoMemory(String(infoRes.result ?? ""));
      usedMemoryBytes = mem.used_memory ? Number(mem.used_memory) : null;
      maxMemoryBytes = mem.maxmemory ? Number(mem.maxmemory) : null;
      if (maxMemoryBytes === 0) maxMemoryBytes = db.db_memory_threshold ?? null;

      const keyRes = await monitorFetchJson<{ result?: string }>(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["INFO", "keyspace"]),
      });
      const keyspace = String(keyRes.result ?? "");
      const match = keyspace.match(/keys=(\d+)/);
      keys = match ? Number(match[1]) : lastSeriesValue(stats.keyspace);

      const statsRes = await monitorFetchJson<{ result?: string }>(redisUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(["INFO", "stats"]),
      });
      const s = parseInfoMemory(String(statsRes.result ?? ""));
      evictedKeys = s.evicted_keys ? Number(s.evicted_keys) : null;
      keyspaceHits = s.keyspace_hits ? Number(s.keyspace_hits) : null;
      keyspaceMisses = s.keyspace_misses ? Number(s.keyspace_misses) : null;
    } catch (e) {
      notes.push(`Redis REST INFO unavailable: ${e instanceof Error ? e.message : String(e)}`);
      keys = lastSeriesValue(stats.keyspace);
    }
  }

  const memoryLimit = maxMemoryBytes ?? db.db_memory_threshold ?? null;
  const memoryPct =
    usedMemoryBytes != null && memoryLimit && memoryLimit > 0
      ? (usedMemoryBytes / memoryLimit) * 100
      : null;

  const bandwidthSeries = normalizeSeries(stats.bandwidths);
  const commandsSeries = (() => {
    // Prefer read+write daily request series if present as points; else empty.
    const reads = Array.isArray(stats.daily_read_requests)
      ? normalizeSeries(stats.daily_read_requests)
      : [];
    const writes = Array.isArray(stats.daily_write_requests)
      ? normalizeSeries(stats.daily_write_requests)
      : [];
    if (reads.length || writes.length) {
      const map = new Map<string, number>();
      for (const p of reads) map.set(p.t, (map.get(p.t) ?? 0) + p.v);
      for (const p of writes) map.set(p.t, (map.get(p.t) ?? 0) + p.v);
      return [...map.entries()].map(([t, v]) => ({ t, v }));
    }
    return normalizeSeries(stats.throughput);
  })();

  return {
    scannedAt,
    configured: true,
    missing: [],
    database: {
      id: db.database_id,
      name: db.database_name ?? "redis",
      type: db.type ?? null,
      plan: db.database_type ?? null,
      region: db.region ?? null,
      primaryRegion: db.primary_region ?? null,
      endpoint: db.endpoint ?? null,
      state: db.state ?? null,
      eviction: db.eviction ?? null,
      budgetUsd: db.budget ?? null,
    },
    limits: {
      memoryBytes: db.db_memory_threshold ?? null,
      memoryLabel: formatBytes(db.db_memory_threshold),
      diskBytes: db.db_disk_threshold ?? null,
      diskLabel: formatBytes(db.db_disk_threshold),
      maxCommandsPerSecond: db.db_max_commands_per_second ?? null,
      maxBandwidthBytes: db.db_max_bandwidth ?? null,
      maxBandwidthLabel: formatBytes(db.db_max_bandwidth),
    },
    live: {
      usedMemoryBytes,
      usedMemoryLabel: formatBytes(usedMemoryBytes),
      maxMemoryBytes: memoryLimit,
      maxMemoryLabel: formatBytes(memoryLimit),
      memoryPct,
      keys,
      evictedKeys,
      keyspaceHits,
      keyspaceMisses,
    },
    usage: {
      dailyNetCommands:
        typeof stats.daily_net_commands === "number" ? stats.daily_net_commands : null,
      dailyBandwidthBytes: typeof stats.dailybandwidth === "number" ? stats.dailybandwidth : null,
      dailyBandwidthLabel: formatBytes(
        typeof stats.dailybandwidth === "number" ? stats.dailybandwidth : null
      ),
      totalMonthlyRequests:
        typeof stats.total_monthly_requests === "number" ? stats.total_monthly_requests : null,
      totalMonthlyBandwidthBytes:
        typeof stats.total_monthly_bandwidth === "number" ? stats.total_monthly_bandwidth : null,
      totalMonthlyBandwidthLabel: formatBytes(
        typeof stats.total_monthly_bandwidth === "number" ? stats.total_monthly_bandwidth : null
      ),
      latestDailyCostUsd: lastSeriesValue(stats.dailybilling),
    },
    series: {
      commands: commandsSeries,
      bandwidth: bandwidthSeries,
      throughput: normalizeSeries(stats.throughput),
      latencyMean: normalizeSeries(stats.latencymean),
      hits: normalizeSeries(stats.hits),
      misses: normalizeSeries(stats.misses),
      diskUsage: normalizeSeries(stats.diskusage),
      keyspace: normalizeSeries(stats.keyspace),
      billing: normalizeSeries(stats.dailybilling, 30),
    },
    notes,
  };
}

function emptySnapshot(
  scannedAt: string,
  missing: string[],
  notes: string[] = ["Add Upstash Management credentials to enable Redis monitoring."]
): RedisMonitorSnapshot {
  return {
    scannedAt,
    configured: false,
    missing,
    database: null,
    limits: {
      memoryBytes: null,
      memoryLabel: "—",
      diskBytes: null,
      diskLabel: "—",
      maxCommandsPerSecond: null,
      maxBandwidthBytes: null,
      maxBandwidthLabel: "—",
    },
    live: {
      usedMemoryBytes: null,
      usedMemoryLabel: "—",
      maxMemoryBytes: null,
      maxMemoryLabel: "—",
      memoryPct: null,
      keys: null,
      evictedKeys: null,
      keyspaceHits: null,
      keyspaceMisses: null,
    },
    usage: {
      dailyNetCommands: null,
      dailyBandwidthBytes: null,
      dailyBandwidthLabel: "—",
      totalMonthlyRequests: null,
      totalMonthlyBandwidthBytes: null,
      totalMonthlyBandwidthLabel: "—",
      latestDailyCostUsd: null,
    },
    series: {
      commands: [],
      bandwidth: [],
      throughput: [],
      latencyMean: [],
      hits: [],
      misses: [],
      diskUsage: [],
      keyspace: [],
      billing: [],
    },
    notes,
  };
}
