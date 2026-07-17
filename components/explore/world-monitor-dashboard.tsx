"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Brain,
  Clock3,
  Globe,
  Loader2,
  Map,
  RadioTower,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Waves,
} from "lucide-react";
import {
  buildDeterministicWorldPulseInsight,
  formatSignedPercent,
  humanizeTimeRange,
  humanizeTone,
  WORLD_PULSE_LAYERS,
  WORLD_PULSE_LAYER_META,
  WORLD_PULSE_TIME_RANGES,
  WORLD_PULSE_TIME_RANGE_LABELS,
  WORLD_PULSE_VIEWS,
  WORLD_PULSE_VIEW_LABELS,
  type WorldPulseAiInsight,
  type WorldPulseData,
  type WorldPulseLayer,
  type WorldPulseTimeRange,
  type WorldPulseView,
} from "@/lib/analysis/world-pulse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";

const WorldMonitorMap = dynamic(
  () =>
    import("@/components/explore/world-monitor-map").then((module) => ({
      default: module.WorldMonitorMap,
    })),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 animate-pulse bg-slate-950/90" />,
  }
);

const WorldGlobe = dynamic(
  () =>
    import("@/components/explore/world-globe").then((module) => ({
      default: module.WorldGlobe,
    })),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 animate-pulse bg-slate-950/90" />,
  }
);

const DEFAULT_VIEW: WorldPulseView = "asia";
const DEFAULT_TIME_RANGE: WorldPulseTimeRange = "48h";
const DEFAULT_LAYER: WorldPulseLayer = "conflicts";
const AI_SUMMARY_ERROR_MESSAGE =
  "We could not refresh the live summary right now. Please try again in a few minutes.";
const SUMMARY_LOADING_STATUSES = [
  "Scanning live hotspots and breaking alerts",
  "Checking oil, gold and equity-market reactions",
  "Writing the world summary in simple language",
] as const;

type WorldMonitorAiPayload = {
  view: WorldPulseView;
  timeRange: WorldPulseTimeRange;
  deterministic: WorldPulseAiInsight;
  insight: WorldPulseAiInsight;
  generatedAt: string;
  sourceUpdatedAt: string;
};

export function WorldMonitorDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [globeMode, setGlobeMode] = React.useState(false);

  const view = parseView(searchParams.get("view"));
  const timeRange = parseTimeRange(searchParams.get("timeRange"));
  const layer = parseLayer(searchParams.get("layer"));

  const resource = usePersistentResource<WorldPulseData>({
    cacheKey: `public:world-monitor:${view}:${timeRange}`,
    url: `/api/public/world-monitor?view=${view}&timeRange=${timeRange}`,
    refreshInterval: 2 * 60_000,
  });

  const deterministicInsight = React.useMemo(
    () => (resource.data ? buildDeterministicWorldPulseInsight(resource.data) : null),
    [resource.data]
  );

  const aiBody = React.useMemo(
    () =>
      resource.data
        ? ({
            view,
            timeRange,
          } satisfies Record<string, unknown>)
        : null,
    [resource.data, timeRange, view]
  );
  const { data: aiData, loading: aiLoading, error: aiError, refresh: refreshAi } =
    usePostJson<WorldMonitorAiPayload>("/api/public/world-monitor/ai", aiBody);

  const isAiCurrent =
    aiData?.view === view &&
    aiData?.timeRange === timeRange &&
    aiData?.sourceUpdatedAt === resource.data?.updatedAt;
  const aiInsight = isAiCurrent ? (aiData?.insight ?? deterministicInsight) : deterministicInsight;
  const isSummaryPending = Boolean(resource.data && aiLoading && !isAiCurrent);
  const [summaryStatusIndex, setSummaryStatusIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isSummaryPending) {
      setSummaryStatusIndex(0);
      return;
    }
    setSummaryStatusIndex(0);
    const intervalId = window.setInterval(() => {
      setSummaryStatusIndex((value) => (value + 1) % SUMMARY_LOADING_STATUSES.length);
    }, 1600);
    return () => window.clearInterval(intervalId);
  }, [isSummaryPending]);

  const updateQuery = React.useCallback(
    (next: Partial<{ view: WorldPulseView; timeRange: WorldPulseTimeRange; layer: WorldPulseLayer }>) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        const nextView = next.view ?? view;
        const nextTimeRange = next.timeRange ?? timeRange;
        const nextLayer = next.layer ?? layer;
        params.set("view", nextView);
        params.set("timeRange", nextTimeRange);
        params.set("layer", nextLayer);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [layer, pathname, router, searchParams, timeRange, view]
  );

  if (resource.isLoading) {
    return <WorldMonitorLoading />;
  }

  if (!resource.data) {
    return (
      <div className="mx-auto max-w-[1800px]">
        <Card className="overflow-hidden border-slate-800 bg-[#071311] text-slate-100 shadow-soft-lg">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-3xl bg-rose-500/15 p-4 text-rose-300">
                <AlertTriangle className="size-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">World Monitor is temporarily unavailable</h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-300">
                  {resource.error?.message ??
                    "We could not load the world map and live feeds right now. Please try again in a few minutes."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = resource.data;
  const leadHotspot = data.hotspots[0] ?? null;
  const leadDisaster = data.disasters[0] ?? null;
  const updatedAgo = timeAgo(data.updatedAt);

  return (
    <div className="mx-auto max-w-[1800px] space-y-5">
      <Card className="overflow-hidden border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_34%),linear-gradient(180deg,#081311_0%,#06110f_100%)] text-slate-100 shadow-soft-lg">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <Badge className="h-7 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 text-[11px] uppercase tracking-[0.22em] text-emerald-200">
                Explore · World Monitor
              </Badge>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Watch conflicts, disasters, and market stress on one live world map
                </h1>
                <p className="max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
                  Start with the map, then read the live intelligence feed, disruption alerts,
                  and market reaction panels beside it. This view ties global headlines, regional
                  flashpoints, commodities, and major equity markets into one fast-moving screen.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-4xl xl:grid-cols-4">
              <HeroMetric
                label="Live hotspots"
                value={String(data.summary.hotspotsLive)}
                tone="emerald"
                detail={leadHotspot ? leadHotspot.name : "No lead hotspot"}
              />
              <HeroMetric
                label="Disaster alerts"
                value={String(data.summary.disasterAlerts)}
                tone="amber"
                detail={leadDisaster ? leadDisaster.category : "No major alert"}
              />
              <HeroMetric
                label="Feed items"
                value={String(data.summary.feedItems)}
                tone="sky"
                detail={`Across the last ${humanizeTimeRange(timeRange)}`}
              />
              <HeroMetric
                label="Market tone"
                value={humanizeTone(data.marketSnapshot.tone)}
                tone={data.marketSnapshot.tone === "risk-off" ? "rose" : data.marketSnapshot.tone === "risk-on" ? "emerald" : "slate"}
                detail={`Updated ${updatedAgo}`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-slate-200">
                <Clock3 className="mr-1 size-3.5" />
                Updated {updatedAgo}
              </Badge>
              <Badge className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-slate-200">
                <RadioTower className="mr-1 size-3.5" />
                {data.regionLabel} live board
              </Badge>
              {resource.isRefreshing || isPending ? (
                <Badge className="h-8 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 text-xs text-cyan-200">
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Refreshing live feeds...
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="world-monitor-view">
                Region
              </label>
              <select
                id="world-monitor-view"
                value={view}
                onChange={(event) => updateQuery({ view: parseView(event.target.value) })}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-slate-100 outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/25"
              >
                {WORLD_PULSE_VIEWS.map((item) => (
                  <option key={item} value={item} className="bg-slate-950 text-slate-100">
                    {WORLD_PULSE_VIEW_LABELS[item]}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="h-11 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                onClick={() => void resource.refreshNow()}
              >
                Refresh now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(360px,0.78fr)] 2xl:grid-cols-[minmax(0,1.45fr)_640px]">
        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[#061210] shadow-soft-lg">
          <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Global situation map
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">
                {WORLD_PULSE_LAYER_META[layer].label}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {WORLD_PULSE_LAYER_META[layer].description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setGlobeMode((v) => !v)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition",
                  globeMode
                    ? "border-sky-300/35 bg-sky-400/20 text-sky-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                )}
              >
                {globeMode ? <Map className="size-4" /> : <Globe className="size-4" />}
                {globeMode ? "Flat map" : "3D Globe"}
              </button>
              {WORLD_PULSE_TIME_RANGES.map((item) => {
                const active = item === timeRange;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateQuery({ timeRange: item })}
                    className={cn(
                      "h-10 rounded-2xl border px-4 text-sm font-semibold transition",
                      active
                        ? "border-emerald-300/35 bg-emerald-400 text-slate-950"
                        : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                    )}
                  >
                    {WORLD_PULSE_TIME_RANGE_LABELS[item]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn("relative overflow-hidden transition-all", globeMode ? "min-h-[80vh]" : "min-h-[540px] lg:min-h-[700px]")}>
            {globeMode ? (
              <WorldGlobe data={data} activeLayer={layer} />
            ) : (
              <WorldMonitorMap data={data} activeLayer={layer} />
            )}

            <div className="absolute left-4 top-4 z-10 w-[min(17rem,calc(100%-2rem))] rounded-[1.6rem] border border-white/10 bg-slate-950/82 p-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Focus
              </p>
              <p className="mt-2 text-lg font-semibold text-white">{data.regionLabel}</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {leadHotspot
                  ? `${leadHotspot.name} is currently the loudest signal on this board.`
                  : leadDisaster
                    ? `${leadDisaster.category} alerts are the strongest live disruption signal right now.`
                    : "Markets are leading this view right now because the headline map is relatively calm."}
              </p>
            </div>

            <div className="absolute right-4 top-4 z-10 w-[min(18rem,calc(100%-2rem))] rounded-[1.6rem] border border-white/10 bg-slate-950/82 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Live tone
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {humanizeTone(data.marketSnapshot.tone)}
                  </p>
                </div>
                <div
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    data.marketSnapshot.tone === "risk-off"
                      ? "bg-rose-500/15 text-rose-200"
                      : data.marketSnapshot.tone === "risk-on"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-slate-500/15 text-slate-200"
                  )}
                >
                  {formatSignedPercent(data.marketSnapshot.averageMove)}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {data.marketSnapshot.signals.map((signal) => (
                  <div key={signal} className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
                    {signal}
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-4 left-4 z-10 w-[min(22rem,calc(100%-2rem))] rounded-[1.7rem] border border-white/10 bg-slate-950/86 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Map layers
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">Switch the live board</p>
                </div>
                <Badge className="h-8 rounded-full border border-white/10 bg-white/5 px-3 text-xs text-slate-200">
                  {data.layerOptions.find((item) => item.key === layer)?.count ?? 0} active
                </Badge>
              </div>
              <div className="mt-4 space-y-2.5">
                {data.layerOptions.map((option) => {
                  const active = option.key === layer;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => updateQuery({ layer: option.key })}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition",
                        active
                          ? "border-emerald-300/35 bg-emerald-400/12"
                          : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold", active ? "text-emerald-200" : "text-white")}>
                          {option.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{option.description}</p>
                      </div>
                      <div className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200">
                        {option.count}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 2xl:grid-cols-2">
          <PanelShell
            icon={<RadioTower className="size-5" />}
            title="Intel feed"
            subtitle="Fresh global headlines that are shaping this map."
          >
            <div className="space-y-3">
              {data.intelFeed.slice(0, 6).map((item) => (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        "h-6 rounded-full px-2.5 text-[11px] uppercase tracking-[0.18em]",
                        item.category === "conflict"
                          ? "bg-rose-500/15 text-rose-200"
                          : "bg-sky-500/15 text-sky-200"
                      )}
                    >
                      {item.category}
                    </Badge>
                    <span className="text-xs text-slate-400">{item.source}</span>
                    <span className="text-xs text-slate-500">{timeAgo(item.publishedAt)}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-100">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-200">
                    Open source <ArrowUpRight className="size-3.5" />
                  </div>
                </a>
              ))}
            </div>
          </PanelShell>

          <PanelShell
            icon={<TrendingUp className="size-5" />}
            title="Market pressure"
            subtitle="How equity indexes, oil, gold and crypto are reacting."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniPanel
                label="Average move"
                value={formatSignedPercent(data.marketSnapshot.averageMove)}
                detail={humanizeTone(data.marketSnapshot.tone)}
              />
              <MiniPanel
                label="Strongest market"
                value={data.marketSnapshot.best?.name ?? "—"}
                detail={data.marketSnapshot.best ? formatSignedPercent(data.marketSnapshot.best.changePct) : "Unavailable"}
              />
              <MiniPanel
                label="Weakest market"
                value={data.marketSnapshot.worst?.name ?? "—"}
                detail={data.marketSnapshot.worst ? formatSignedPercent(data.marketSnapshot.worst.changePct) : "Unavailable"}
              />
              <MiniPanel
                label="Brent / Gold / BTC"
                value={[
                  compactSignal("Brent", data.marketSnapshot.brent?.changePct),
                  compactSignal("Gold", data.marketSnapshot.gold?.changePct),
                  compactSignal("BTC", data.marketSnapshot.bitcoin?.changePct),
                ].join(" · ")}
                detail="Fast risk read"
              />
            </div>
            <div className="mt-4 space-y-2">
              {data.marketSnapshot.signals.map((signal) => (
                <div key={signal} className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
                  {signal}
                </div>
              ))}
            </div>
          </PanelShell>

          <PanelShell
            icon={<ShieldAlert className="size-5" />}
            title="Conflict hotspots"
            subtitle="The loudest geopolitical pressure points on this board."
          >
            <div className="space-y-3">
              {data.hotspots.length ? (
                data.hotspots.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.country} · {item.eventCount} fresh signals
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "h-7 rounded-full px-2.5 text-[11px] uppercase tracking-[0.18em]",
                          item.severity === "critical"
                            ? "bg-rose-500/18 text-rose-200"
                            : item.severity === "high"
                              ? "bg-orange-500/18 text-orange-200"
                              : item.severity === "elevated"
                                ? "bg-amber-500/18 text-amber-100"
                                : "bg-sky-500/18 text-sky-200"
                        )}
                      >
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{item.lead}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.latestSource ? `${item.latestSource} · ` : ""}
                      {item.latestAt ? timeAgo(item.latestAt) : "Monitoring"}
                    </p>
                  </div>
                ))
              ) : (
                <NoPanelData message="No hotspot cluster is dominating this regional view right now." />
              )}
            </div>
          </PanelShell>

          <PanelShell
            icon={<Waves className="size-5" />}
            title="Disaster alerts"
            subtitle="Natural disruptions that could spill into supply chains or risk sentiment."
          >
            <div className="space-y-3">
              {data.disasters.length ? (
                data.disasters.slice(0, 5).map((item) => (
                  <a
                    key={item.id}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.country} · {item.category}
                        </p>
                      </div>
                      <Badge
                        className={cn(
                          "h-7 rounded-full px-2.5 text-[11px] uppercase tracking-[0.18em]",
                          item.alertLevel === "red"
                            ? "bg-rose-500/18 text-rose-200"
                            : item.alertLevel === "orange"
                              ? "bg-orange-500/18 text-orange-200"
                              : "bg-emerald-500/18 text-emerald-200"
                        )}
                      >
                        {item.alertLevel}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{item.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.severityLabel} · {timeAgo(item.publishedAt)}
                    </p>
                  </a>
                ))
              ) : (
                <NoPanelData message="No major disaster alert is standing out in this time window." />
              )}
            </div>
          </PanelShell>

          <PanelShell
            className="2xl:col-span-2"
            icon={<Brain className="size-5" />}
            title="World summary"
            subtitle="A simple read of the same live data shown on the map and boards."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refreshAi()}
                disabled={aiLoading}
                className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              >
                {aiLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Refresh summary
              </Button>
            }
          >
            {isSummaryPending ? (
              <SummaryLoadingCard
                region={data.regionLabel}
                status={SUMMARY_LOADING_STATUSES[summaryStatusIndex] ?? SUMMARY_LOADING_STATUSES[0]}
              />
            ) : aiInsight ? (
              <div className="space-y-4">
                {aiError ? (
                  <div className="rounded-[1.4rem] border border-amber-400/18 bg-amber-400/8 p-4 text-sm text-amber-100">
                    {AI_SUMMARY_ERROR_MESSAGE}
                  </div>
                ) : null}
                <div className="rounded-[1.6rem] border border-emerald-400/15 bg-emerald-400/[0.08] p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="h-7 rounded-full bg-white/10 px-3 text-xs text-white">
                      {aiInsight.confidence} confidence
                    </Badge>
                    <Badge className="h-7 rounded-full bg-white/10 px-3 text-xs text-white">
                      {data.regionLabel}
                    </Badge>
                    <Badge className="h-7 rounded-full bg-white/10 px-3 text-xs text-white">
                      {humanizeTimeRange(timeRange)}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-white">{aiInsight.headline}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{aiInsight.summary}</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <InsightList title="What stands out right now" icon={<Sparkles className="size-4" />} items={aiInsight.focusPoints} />
                  <InsightList title="What to keep watching" icon={<Activity className="size-4" />} items={aiInsight.watchItems} />
                </div>

                <div className="rounded-[1.4rem] border border-sky-400/15 bg-sky-400/[0.08] p-4 text-sm leading-7 text-slate-100">
                  <p className="font-semibold text-sky-100">How to use this screen</p>
                  <p className="mt-2">{aiInsight.suggestion}</p>
                </div>
              </div>
            ) : (
              <NoPanelData message="The summary is not ready yet. Please refresh in a moment." />
            )}
          </PanelShell>
        </div>
      </div>
    </div>
  );
}

function WorldMonitorLoading() {
  const steps = [
    "Loading the world map canvas and regional controls",
    "Checking conflict hotspots, disaster alerts, and market centres",
    "Preparing the live boards beside the map",
    "Refreshing the plain-language world summary",
  ];

  return (
    <div className="mx-auto max-w-[1800px]">
      <Card className="overflow-hidden border-slate-800 bg-[#071311] text-slate-100 shadow-soft-lg">
        <CardContent className="space-y-5 p-8">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-emerald-500/15 p-4 text-emerald-200">
              <Loader2 className="size-6 animate-spin" />
            </div>
            <div>
              <p className="text-2xl font-semibold">Loading World Monitor</p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                We are preparing the live map, checking regional pressure points, and reading
                market reaction across the latest world feeds.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{step}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "sky" | "rose" | "slate";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border p-4 shadow-soft",
        tone === "emerald"
          ? "border-emerald-400/12 bg-emerald-400/[0.08]"
          : tone === "amber"
            ? "border-amber-400/12 bg-amber-400/[0.08]"
            : tone === "sky"
              ? "border-sky-400/12 bg-sky-400/[0.08]"
              : tone === "rose"
                ? "border-rose-400/12 bg-rose-400/[0.08]"
                : "border-white/10 bg-white/[0.04]"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

function PanelShell({
  icon,
  title,
  subtitle,
  children,
  className,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[1.8rem] border border-slate-800 bg-[#071311] p-4 shadow-soft-lg", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-[1.4rem] bg-white/[0.05] p-3 text-emerald-200">{icon}</div>
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
          </div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MiniPanel({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-base font-semibold leading-6 text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function InsightList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <p className="font-semibold">{title}</p>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm leading-6 text-slate-200">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryLoadingCard({
  region,
  status,
}: {
  region: string;
  status: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-violet-400/20 bg-violet-400/[0.08] p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-white/10 p-3 text-violet-100">
          <Loader2 className="size-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-100">
            Building {region} summary
          </p>
          <p className="mt-3 text-lg font-semibold text-white">{status}</p>
          <p className="mt-2 text-sm leading-7 text-slate-200">
            We are reading the latest flashpoints, disruption alerts, and market reaction before
            writing the final plain-language summary.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoPanelData({ message }: { message: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-slate-400">
      {message}
    </div>
  );
}

function parseView(value: string | null): WorldPulseView {
  return WORLD_PULSE_VIEWS.includes(value as WorldPulseView)
    ? (value as WorldPulseView)
    : DEFAULT_VIEW;
}

function parseTimeRange(value: string | null): WorldPulseTimeRange {
  return WORLD_PULSE_TIME_RANGES.includes(value as WorldPulseTimeRange)
    ? (value as WorldPulseTimeRange)
    : DEFAULT_TIME_RANGE;
}

function parseLayer(value: string | null): WorldPulseLayer {
  return WORLD_PULSE_LAYERS.includes(value as WorldPulseLayer)
    ? (value as WorldPulseLayer)
    : DEFAULT_LAYER;
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(diffSeconds / 60);
  const hours = Math.round(diffSeconds / 3600);
  const days = Math.round(diffSeconds / 86400);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
}

function compactSignal(label: string, value: number | null | undefined) {
  return `${label} ${formatSignedPercent(value)}`;
}

function usePostJson<T>(url: string, body: Record<string, unknown> | null) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    if (!body) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: T; error?: string }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? `Request failed: ${response.status}`);
      }
      setData(payload.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, [body, url]);

  React.useEffect(() => {
    void run();
  }, [run]);

  return { data, loading, error, refresh: run };
}
