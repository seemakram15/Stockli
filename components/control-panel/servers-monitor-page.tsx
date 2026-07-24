"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MonitorSparkline, MonitorStat } from "@/components/control-panel/monitor-ui";
import type { VercelMonitorSnapshot } from "@/lib/services/control-panel/vercel-monitor";
import type { SupabaseMonitorSnapshot } from "@/lib/services/control-panel/supabase-monitor";
import type { RedisMonitorSnapshot } from "@/lib/services/control-panel/upstash-monitor";

type Provider = "vercel" | "supabase" | "redis";

const SECTIONS: Array<{
  id: Provider;
  title: string;
  subtitle: string;
  endpoint: string;
}> = [
  {
    id: "vercel",
    title: "Vercel",
    subtitle: "Project health, deployments, crons, and plan.",
    endpoint: "/api/private/control-panel/servers/vercel",
  },
  {
    id: "supabase",
    title: "Supabase",
    subtitle: "Users, storage, API request volume, and database footprint.",
    endpoint: "/api/private/control-panel/servers/supabase",
  },
  {
    id: "redis",
    title: "Upstash Redis",
    subtitle: "Memory, commands, bandwidth, latency, and hit rate.",
    endpoint: "/api/private/control-panel/servers/redis",
  },
];

export function ServersMonitorPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        icon={<Server />}
        accent="sky"
        eyebrow="Control Panel"
        title="Servers"
        description="Read-only live monitoring for Vercel, Supabase, and Upstash Redis. Each section loads only when you activate it."
      />

      {SECTIONS.map((section) => (
        <MonitorSection key={section.id} section={section} />
      ))}
    </div>
  );
}

function MonitorSection({
  section,
}: {
  section: (typeof SECTIONS)[number];
}) {
  const [active, setActive] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<unknown>(null);
  const rootRef = React.useRef<HTMLElement | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(section.endpoint, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json?.error === "string" ? json.error : `Request failed (${res.status})`
        );
      }
      setData(json);
      setActive(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setActive(true);
    } finally {
      setLoading(false);
    }
  }, [section.endpoint]);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el || active) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void load();
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px", threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [active, load]);

  return (
    <section ref={rootRef} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{section.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {!active ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Activate
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {!active && !loading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          Scroll into view or press Activate to load live metrics.
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-xl border border-border px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading {section.title} metrics…
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-foreground">Could not load {section.title}</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      {data && section.id === "vercel" ? <VercelPanel data={data as VercelMonitorSnapshot} /> : null}
      {data && section.id === "supabase" ? (
        <SupabasePanel data={data as SupabaseMonitorSnapshot} />
      ) : null}
      {data && section.id === "redis" ? <RedisPanel data={data as RedisMonitorSnapshot} /> : null}
    </section>
  );
}

function MetaLine({ scannedAt }: { scannedAt?: string }) {
  if (!scannedAt) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Updated {formatDateTime(scannedAt)}
    </p>
  );
}

function Notes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {notes.map((note) => (
        <li key={note}>• {note}</li>
      ))}
    </ul>
  );
}

function VercelPanel({ data }: { data: VercelMonitorSnapshot }) {
  if (!data.configured) {
    return (
      <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Missing: {data.missing.join(", ") || "credentials"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MonitorStat label="Project" value={data.project?.name ?? "—"} sub={data.project?.id} />
        <MonitorStat
          label="Plan"
          value={data.team?.plan ?? "—"}
          sub={data.team ? `${data.team.name} · ${data.team.billingStatus ?? "—"}` : undefined}
        />
        <MonitorStat
          label="Runtime"
          value={data.project?.nodeVersion ?? "—"}
          sub={`${data.project?.framework ?? "—"} · ${data.project?.region ?? "—"}`}
        />
        <MonitorStat
          label="Latest deploy"
          value={data.latestDeployment?.state ?? "—"}
          sub={data.latestDeployment?.url ?? undefined}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Recent deployments</h3>
            <Badge variant="secondary">{data.deployments.length}</Badge>
          </div>
          <div className="space-y-2">
            {data.deployments.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.url ?? d.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.target ?? "preview"} · {d.createdAt ? formatDateTime(d.createdAt) : "—"}
                  </p>
                </div>
                <Badge variant={d.state === "READY" ? "success" : "secondary"}>{d.state ?? "—"}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Crons</h3>
            <Badge variant="secondary">{data.crons.length}</Badge>
          </div>
          <div className="space-y-2">
            {data.crons.map((c) => (
              <div key={`${c.schedule}-${c.path}`} className="text-sm">
                <p className="font-medium tabular-nums">{c.schedule}</p>
                <p className="truncate text-xs text-muted-foreground">{c.path}</p>
              </div>
            ))}
            {!data.crons.length ? (
              <p className="text-sm text-muted-foreground">No cron definitions.</p>
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <p>Env vars: {data.envVarCount}</p>
            <p>Speed Insights: {data.speedInsightsEnabled ? "on" : "off"}</p>
          </div>
        </div>
      </div>

      <MetaLine scannedAt={data.scannedAt} />
      <Notes notes={data.notes} />
    </div>
  );
}

function SupabasePanel({ data }: { data: SupabaseMonitorSnapshot }) {
  if (!data.configured) {
    return (
      <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Missing: {data.missing.join(", ") || "credentials"}
      </div>
    );
  }

  const requestSeries = data.requests.series.map((row) => ({ t: row.t, v: row.total }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MonitorStat
          label="Project"
          value={data.project?.name ?? "—"}
          sub={`${data.project?.ref ?? "—"} · ${data.project?.region ?? "—"}`}
        />
        <MonitorStat
          label="Active users"
          value={data.users.total != null ? formatNumber(data.users.total, 0) : "—"}
          sub="profiles count"
        />
        <MonitorStat
          label="Storage buckets"
          value={data.storage.bucketCount != null ? formatNumber(data.storage.bucketCount, 0) : "—"}
        />
        <MonitorStat
          label="DB size"
          value={data.database.sizeLabel}
          sub={data.database.note ?? undefined}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MonitorStat label="Requests (24h)" value={formatNumber(data.requests.totals.total, 0)} />
        <MonitorStat label="Auth" value={formatNumber(data.requests.totals.auth, 0)} />
        <MonitorStat label="REST" value={formatNumber(data.requests.totals.rest, 0)} />
        <MonitorStat label="Realtime" value={formatNumber(data.requests.totals.realtime, 0)} />
        <MonitorStat label="Storage API" value={formatNumber(data.requests.totals.storage, 0)} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold">API requests · last 24h</h3>
        <MonitorSparkline data={requestSeries} color="var(--chart-2)" />
      </div>

      {data.storage.buckets.length ? (
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold">Buckets</h3>
          <div className="flex flex-wrap gap-2">
            {data.storage.buckets.map((b) => (
              <Badge key={b.id} variant={b.public ? "info" : "secondary"}>
                {b.name}
                {b.public ? " · public" : ""}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <MetaLine scannedAt={data.scannedAt} />
      <Notes notes={data.notes} />
    </div>
  );
}

function RedisPanel({ data }: { data: RedisMonitorSnapshot }) {
  if (!data.configured) {
    return (
      <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Missing: {data.missing.join(", ") || "credentials"}
      </div>
    );
  }

  const hitRate =
    data.live.keyspaceHits != null &&
    data.live.keyspaceMisses != null &&
    data.live.keyspaceHits + data.live.keyspaceMisses > 0
      ? (data.live.keyspaceHits / (data.live.keyspaceHits + data.live.keyspaceMisses)) * 100
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MonitorStat
          label="Database"
          value={data.database?.name ?? "—"}
          sub={`${data.database?.plan ?? "—"} · ${data.database?.primaryRegion ?? data.database?.region ?? "—"}`}
        />
        <MonitorStat
          label="Memory used"
          value={data.live.usedMemoryLabel}
          sub={
            data.live.memoryPct != null
              ? `${formatNumber(data.live.memoryPct, 2)}% of ${data.live.maxMemoryLabel}`
              : `Limit ${data.live.maxMemoryLabel}`
          }
        />
        <MonitorStat
          label="Commands today"
          value={
            data.usage.dailyNetCommands != null
              ? formatNumber(data.usage.dailyNetCommands, 0)
              : "—"
          }
          sub={`Monthly ${data.usage.totalMonthlyRequests != null ? formatNumber(data.usage.totalMonthlyRequests, 0) : "—"}`}
        />
        <MonitorStat
          label="Bandwidth today"
          value={data.usage.dailyBandwidthLabel}
          sub={`Monthly ${data.usage.totalMonthlyBandwidthLabel}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MonitorStat label="Keys" value={data.live.keys != null ? formatNumber(data.live.keys, 0) : "—"} />
        <MonitorStat
          label="Hit rate"
          value={hitRate != null ? `${formatNumber(hitRate, 1)}%` : "—"}
          sub={
            data.live.keyspaceHits != null
              ? `${formatNumber(data.live.keyspaceHits, 0)} hits / ${formatNumber(data.live.keyspaceMisses ?? 0, 0)} misses`
              : undefined
          }
        />
        <MonitorStat
          label="Daily cost"
          value={
            data.usage.latestDailyCostUsd != null
              ? `$${formatNumber(data.usage.latestDailyCostUsd, 3)}`
              : "—"
          }
          sub={data.database?.budgetUsd != null ? `Budget $${data.database.budgetUsd}` : undefined}
        />
        <MonitorStat
          label="Limits"
          value={data.limits.memoryLabel}
          sub={`Disk ${data.limits.diskLabel} · ${data.limits.maxCommandsPerSecond ?? "—"} cmd/s`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Throughput" data={data.series.throughput} color="var(--chart-1)" />
        <ChartCard title="Latency mean" data={data.series.latencyMean} color="var(--chart-3)" />
        <ChartCard title="Hits" data={data.series.hits} color="var(--chart-2)" />
        <ChartCard title="Misses" data={data.series.misses} color="var(--chart-5)" />
        <ChartCard title="Disk usage" data={data.series.diskUsage} color="var(--chart-4)" />
        <ChartCard title="Keyspace" data={data.series.keyspace} color="var(--chart-1)" />
        <ChartCard title="Bandwidth" data={data.series.bandwidth} color="var(--chart-2)" />
        <ChartCard title="Daily billing (USD)" data={data.series.billing} color="var(--chart-3)" />
      </div>

      <MetaLine scannedAt={data.scannedAt} />
      <Notes notes={data.notes} />
    </div>
  );
}

function ChartCard({
  title,
  data,
  color,
}: {
  title: string;
  data: Array<{ t: string; v: number }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <MonitorSparkline data={data} color={color} height={140} />
    </div>
  );
}
