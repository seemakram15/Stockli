import fs from "node:fs";
import { Redis } from "@upstash/redis";

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function parseInfo(infoText) {
  const map = {};
  for (const line of String(infoText).split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes(":")) continue;
    const [k, ...rest] = line.split(":");
    map[k.trim()] = rest.join(":").trim();
  }
  return map;
}

function fmtBytes(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = num;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]} (${num.toLocaleString()} bytes)`;
}

const env = loadEnv("/Users/tk-lpt-1153/Documents/Projects/stock-portfolio/.env.local");
const url = env.UPSTASH_REDIS_REST_URL;
const token = env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token || token === "[SENSITIVE]") {
  console.error("Missing Upstash credentials in Documents .env.local");
  process.exit(2);
}

const redis = new Redis({ url, token });

const report = {
  host: new URL(url).host,
  scannedAt: new Date().toISOString(),
};

try {
  report.ping = await redis.ping();
} catch (e) {
  report.pingError = e.message;
}

// INFO via REST: Upstash supports INFO as a command
let infoRaw = null;
try {
  infoRaw = await redis.info();
} catch (e) {
  try {
    // fallback: execute raw
    infoRaw = await redis.info("memory");
  } catch (e2) {
    report.infoError = e2.message || e.message;
  }
}

if (infoRaw != null) {
  const text = typeof infoRaw === "string" ? infoRaw : JSON.stringify(infoRaw);
  report.infoType = typeof infoRaw;
  // Upstash sometimes returns object already
  let mem = {};
  if (typeof infoRaw === "object" && infoRaw !== null && !Array.isArray(infoRaw)) {
    mem = infoRaw;
  } else {
    mem = parseInfo(text);
  }
  // If full info string, parse memory section keys
  const all = typeof infoRaw === "string" ? parseInfo(infoRaw) : mem;

  const used = Number(all.used_memory ?? all.used_memory_rss ?? NaN);
  const max = Number(all.maxmemory ?? all.max_memory ?? NaN);
  const peak = Number(all.used_memory_peak ?? NaN);
  const rss = Number(all.used_memory_rss ?? NaN);
  const frag = all.mem_fragmentation_ratio;

  report.memory = {
    used_memory: all.used_memory ?? null,
    used_memory_human: all.used_memory_human ?? (Number.isFinite(used) ? fmtBytes(used) : null),
    used_memory_rss: all.used_memory_rss ?? null,
    used_memory_rss_human: Number.isFinite(rss) ? fmtBytes(rss) : null,
    used_memory_peak: all.used_memory_peak ?? null,
    used_memory_peak_human: all.used_memory_peak_human ?? (Number.isFinite(peak) ? fmtBytes(peak) : null),
    maxmemory: all.maxmemory ?? null,
    maxmemory_human: Number.isFinite(max) && max > 0 ? fmtBytes(max) : all.maxmemory === "0" ? "unlimited / plan-managed" : null,
    maxmemory_policy: all.maxmemory_policy ?? null,
    mem_fragmentation_ratio: frag ?? null,
    total_system_memory: all.total_system_memory ?? null,
    remaining_bytes: Number.isFinite(used) && Number.isFinite(max) && max > 0 ? max - used : null,
    remaining_human:
      Number.isFinite(used) && Number.isFinite(max) && max > 0 ? fmtBytes(max - used) : null,
    used_pct:
      Number.isFinite(used) && Number.isFinite(max) && max > 0
        ? Number(((used / max) * 100).toFixed(2))
        : null,
  };

  report.stats = {
    connected_clients: all.connected_clients ?? null,
    instantaneous_ops_per_sec: all.instantaneous_ops_per_sec ?? null,
    keyspace_hits: all.keyspace_hits ?? null,
    keyspace_misses: all.keyspace_misses ?? null,
    expired_keys: all.expired_keys ?? null,
    evicted_keys: all.evicted_keys ?? null,
    total_commands_processed: all.total_commands_processed ?? null,
    uptime_in_seconds: all.uptime_in_seconds ?? null,
    uptime_in_days: all.uptime_in_days ?? null,
    redis_version: all.redis_version ?? null,
    role: all.role ?? null,
  };

  // DB key counts from keyspace lines like db0:keys=123,expires=...
  const keyspace = {};
  for (const [k, v] of Object.entries(all)) {
    if (/^db\d+$/.test(k)) keyspace[k] = v;
  }
  report.keyspace = keyspace;

  // Alarm heuristics
  const alarms = [];
  const usedPct = report.memory.used_pct;
  if (usedPct != null) {
    if (usedPct >= 90) alarms.push({ level: "critical", message: `Memory usage at ${usedPct}% of maxmemory` });
    else if (usedPct >= 80) alarms.push({ level: "warning", message: `Memory usage at ${usedPct}% of maxmemory` });
    else if (usedPct >= 70) alarms.push({ level: "watch", message: `Memory usage at ${usedPct}% of maxmemory` });
    else alarms.push({ level: "ok", message: `Memory usage healthy at ${usedPct}% of maxmemory` });
  } else if (Number.isFinite(used)) {
    alarms.push({
      level: "info",
      message: `Used ${fmtBytes(used)}; maxmemory not exposed via INFO (Upstash plan limit is console-side)`,
    });
  }
  const evicted = Number(all.evicted_keys ?? 0);
  if (evicted > 0) {
    alarms.push({ level: "warning", message: `Evicted keys observed: ${evicted} (maxmemory pressure / eviction policy active)` });
  }
  const fragN = Number(frag);
  if (Number.isFinite(fragN) && fragN > 2) {
    alarms.push({ level: "watch", message: `High fragmentation ratio: ${fragN}` });
  }
  report.alarms = alarms;
}

// Also try REST / DB size
try {
  report.dbsize = await redis.dbsize();
} catch (e) {
  report.dbsizeError = e.message;
}

// Sample keyspace size for fundamentals prefixes
async function countMatch(match) {
  let cursor = 0;
  let n = 0;
  do {
    const res = await redis.scan(cursor, { match, count: 500 });
    cursor = Number(res[0]);
    n += res[1].length;
  } while (cursor !== 0);
  return n;
}
try {
  report.prefixCounts = {
    "stock-fundamentals:v4:*": await countMatch("stock-fundamentals:v4:*"),
    "stock-fundamentals:incomplete:v1:*": await countMatch("stock-fundamentals:incomplete:v1:*"),
  };
} catch (e) {
  report.prefixCountsError = e.message;
}

console.log(JSON.stringify(report, null, 2));
