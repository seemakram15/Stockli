"use client";

import * as React from "react";
import {
  Activity,
  Globe2,
  MapPinned,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/accent";
import {
  formatMarketPrice,
  formatPercent,
  formatSigned,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GlobalMarketData, GlobalMarketQuote } from "@/lib/services/global-markets";

type WorldRegionFilter = "all" | "asia-pacific" | "europe" | "americas" | "mena";

type CountryFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  };
  properties: {
    A3?: string;
  };
};

type CountryFeatureCollection = {
  type: "FeatureCollection";
  features: CountryFeature[];
};

const WORLD_REGION_FILTERS: Array<{
  key: WorldRegionFilter;
  label: string;
  match: (quote: GlobalMarketQuote) => boolean;
}> = [
  { key: "all", label: "All", match: () => true },
  {
    key: "asia-pacific",
    label: "Asia Pacific",
    match: (quote) => quote.region === "Asia Pacific",
  },
  { key: "europe", label: "Europe", match: (quote) => quote.region === "Europe" },
  { key: "americas", label: "Americas", match: (quote) => quote.region === "Americas" },
  { key: "mena", label: "MENA", match: (quote) => quote.region === "MENA" },
];

const MAP_DATA_URL = "/maps/world-countries-10km.geo.json";
const WORLD_REGION_BOUNDS: Record<WorldRegionFilter, readonly [readonly [number, number], readonly [number, number]]> = {
  all: [
    [8, -12],
    [64, 155],
  ],
  "asia-pacific": [
    [-48, 58],
    [60, 180],
  ],
  europe: [
    [32, -15],
    [72, 45],
  ],
  americas: [
    [-56, -170],
    [74, -25],
  ],
  mena: [
    [-35, 20],
    [42, 80],
  ],
} as const;

const WORLD_REGION_BOUNDS_COMPACT: Partial<
  Record<WorldRegionFilter, readonly [readonly [number, number], readonly [number, number]]>
> = {
  all: [
    [10, -2],
    [62, 145],
  ],
} as const;

export function WorldMarketHeatMap({
  data,
  compact = false,
}: {
  data: GlobalMarketData;
  compact?: boolean;
}) {
  const [activeRegion, setActiveRegion] = React.useState<WorldRegionFilter>("all");

  const quotes = React.useMemo(
    () => data.quotes.filter((quote) => quote.countryCode),
    [data.quotes]
  );

  const quotesByCode = React.useMemo(
    () => new Map(quotes.map((quote) => [quote.countryCode!, quote])),
    [quotes]
  );

  const visibleQuotes = React.useMemo(
    () => quotes.filter((quote) => matchesRegion(quote, activeRegion)),
    [activeRegion, quotes]
  );

  const greenCount = React.useMemo(
    () => visibleQuotes.filter((quote) => (quote.changePct ?? 0) > 0).length,
    [visibleQuotes]
  );
  const redCount = React.useMemo(
    () => visibleQuotes.filter((quote) => (quote.changePct ?? 0) < 0).length,
    [visibleQuotes]
  );

  const bestQuote = React.useMemo(() => topMoved(visibleQuotes, "gain")[0] ?? null, [visibleQuotes]);
  const worstQuote = React.useMemo(() => topMoved(visibleQuotes, "loss")[0] ?? null, [visibleQuotes]);
  const regionRows = React.useMemo(() => regionSummary(quotes), [quotes]);
  const gainers = React.useMemo(() => topMoved(visibleQuotes, "gain"), [visibleQuotes]);
  const decliners = React.useMemo(() => topMoved(visibleQuotes, "loss"), [visibleQuotes]);
  const selectedAverage = React.useMemo(() => averageChange(visibleQuotes), [visibleQuotes]);
  const activeFilterLabel = labelForRegion(activeRegion);
  const legendRange = React.useMemo(() => moveRange(visibleQuotes), [visibleQuotes]);
  const dailyBoard = React.useMemo(
    () =>
      [...visibleQuotes].sort((left, right) => {
        const leftMove = left.changePct ?? -999;
        const rightMove = right.changePct ?? -999;
        if (rightMove !== leftMove) return rightMove - leftMove;
        return left.country?.localeCompare(right.country ?? "") ?? 0;
      }),
    [visibleQuotes]
  );

  const regionControls = (
    <div className="rounded-[28px] border border-border bg-card p-3 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Region
          </span>
          <div className="flex flex-wrap gap-2">
            {WORLD_REGION_FILTERS.map((filter) => {
              const active = activeRegion === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveRegion(filter.key)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-blue-200 hover:text-foreground"
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Grey means the market is closed or a live daily move is not available yet.
        </p>
      </div>
    </div>
  );

  const mapPanel = (
    <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-soft">
      <div
        className={cn(
          "relative overflow-hidden bg-[#d8e6f5]",
          compact ? "min-h-[340px] sm:min-h-[460px]" : "min-h-[420px] sm:min-h-[620px]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.75),transparent_26%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.42),transparent_24%)]" />
        <LeafletCountryHeatMap
          quotesByCode={quotesByCode}
          activeRegion={activeRegion}
          compact={compact}
        />

        <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border border-white/75 bg-white/92 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
          {visibleQuotes.length} exchanges shown
        </div>

        <ScaleLegend min={legendRange.min} max={legendRange.max} />
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {regionControls}
        {mapPanel}
      </div>
    );
  }

  return (
    <Card variant="feature" className="overflow-hidden border-gradient-brand bg-background">
      <CardHeader className="border-b border-border bg-gradient-to-br from-card via-card to-sky-500/5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <IconChip accent="indigo" variant="gradient">
              <Globe2 />
            </IconChip>
            <div>
              <CardTitle>World market heat map</CardTitle>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                See how the main stock exchange in each tracked country is performing today.
                Stronger gains move deeper into green, while weaker sessions fade toward red.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-background px-3 py-1.5">
              {quotes.length} tracked exchanges
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1.5">
              {visibleQuotes.length} in view
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {regionControls}
        {mapPanel}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SnapshotCard
            label="Countries covered"
            value={`${quotes.length}`}
            detail="Main country exchanges on the live board."
            tone="neutral"
          />
          <SnapshotCard
            label="Up on the day"
            value={`${greenCount}`}
            detail={`${activeFilterLabel} markets closed stronger today.`}
            tone="gain"
          />
          <SnapshotCard
            label="Down on the day"
            value={`${redCount}`}
            detail={`${activeFilterLabel} markets closed softer today.`}
            tone="loss"
          />
          <SnapshotCard
            label="Average move"
            value={formatPercent(selectedAverage, 2)}
            detail={`${activeFilterLabel} average daily change.`}
            tone={selectedAverage > 0 ? "gain" : selectedAverage < 0 ? "loss" : "neutral"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Regional breadth
                </h3>
              </div>
              <div className="mt-3 space-y-2.5">
                {regionRows.map((region) => (
                  <div key={region.name} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{region.name}</p>
                      <span className={cn("font-semibold tabular-nums", plColorClass(region.avg))}>
                        {formatPercent(region.avg, 2)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="text-gain">{region.up} green</span>
                      <span>{region.flat} flat</span>
                      <span className="text-loss">{region.down} red</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <MoveList title="Top green days" rows={gainers} tone="gain" />
            <MoveList title="Top red days" rows={decliners} tone="loss" />
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MapPinned className="size-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Daily exchange board
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeFilterLabel} country exchanges ranked by today&apos;s move.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {dailyBoard.map((quote) => (
                <div
                  key={`${quote.symbol}-${quote.countryCode}`}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {quote.country}
                      </p>
                      <p className="mt-1 text-base font-semibold">{quote.name}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        toneChipClass(quote.changePct)
                      )}
                    >
                      {statusLabel(quote.changePct)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className={cn("text-2xl font-semibold tabular-nums", plColorClass(quote.changePct))}>
                        {formatPercent(quote.changePct, 2)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatMarketPrice(quote.price, quote.currency)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {quote.region}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <SignalCard
            label="Strongest board"
            quote={bestQuote}
            tone="gain"
            fallback="No winning board found in this view yet."
          />
          <SignalCard
            label="Softest board"
            quote={worstQuote}
            tone="loss"
            fallback="No softer board found in this view yet."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function LeafletCountryHeatMap({
  quotesByCode,
  activeRegion,
  compact = false,
}: {
  quotesByCode: Map<string, GlobalMarketQuote>;
  activeRegion: WorldRegionFilter;
  compact?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<{
    map: import("leaflet").Map;
    geoJsonLayer: import("leaflet").GeoJSON | null;
    labelLayer: import("leaflet").LayerGroup | null;
  } | null>(null);
  const [countries, setCountries] = React.useState<CountryFeatureCollection | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      const res = await fetch(MAP_DATA_URL, { cache: "force-cache" });
      if (!res.ok) throw new Error(`World map file request failed: ${res.status}`);
      const json = (await res.json()) as CountryFeatureCollection;
      if (!cancelled) setCountries(json);
    }

    void loadCountries().catch(() => {
      if (!cancelled) setCountries({ type: "FeatureCollection", features: [] });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true,
        preferCanvas: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: false,
        minZoom: 1.2,
        maxZoom: 6,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      fitRegion(map, "all", compact);
      mapRef.current = { map, geoJsonLayer: null, labelLayer: null };

      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize(false);
      });
      resizeObserver.observe(containerRef.current);
      window.setTimeout(() => map.invalidateSize(false), 80);
      (mapRef.current as typeof mapRef.current & { resizeObserver?: ResizeObserver }).resizeObserver =
        resizeObserver;
    }

    void init();

    return () => {
      cancelled = true;
      const current = mapRef.current as (typeof mapRef.current & { resizeObserver?: ResizeObserver }) | null;
      current?.resizeObserver?.disconnect();
      current?.geoJsonLayer?.remove();
      current?.labelLayer?.remove();
      current?.map.remove();
      mapRef.current = null;
    };
  }, [compact]);

  React.useEffect(() => {
    let cancelled = false;

    async function paintCountries() {
      const current = mapRef.current;
      if (!current || !countries) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      current.geoJsonLayer?.remove();
      current.labelLayer?.remove();

      const geoJsonLayer = L.geoJSON(countries, {
        style: (feature) => {
          const code = feature?.properties?.A3 ?? "";
          const quote = quotesByCode.get(code);
          const active = quote ? matchesRegion(quote, activeRegion) : false;
          return {
            fillColor: mapFillColor(quote?.changePct ?? null, active, Boolean(quote)),
            fillOpacity: active ? 0.96 : quote ? 0.9 : 0.82,
            color: active ? "#f8fafc" : "#e6eef9",
            weight: active ? 1 : 0.65,
            opacity: 1,
          };
        },
        onEachFeature: (feature, layer) => {
          const code = feature?.properties?.A3 ?? "";
          const quote = quotesByCode.get(code);
          const active = quote ? matchesRegion(quote, activeRegion) : false;
          if (!quote || !active) return;

          layer.bindTooltip(buildCountryTooltip(quote), {
            direction: "top",
            sticky: true,
            opacity: 1,
            offset: [0, -12],
            className: "world-heat-country-tooltip-shell",
          });
          layer.bindPopup(buildCountryPopup(quote), {
            className: "world-heat-country-popup",
            maxWidth: 320,
          });
          layer.on("mouseover", (event) => {
            event.target.setStyle({
              weight: 1.6,
              color: "#5b6b84",
              fillOpacity: 1,
            });
          });
          layer.on("mouseout", (event) => {
            (mapRef.current?.geoJsonLayer as import("leaflet").GeoJSON | null)?.resetStyle(
              event.target
            );
          });
        },
      }).addTo(current.map);

      const labelMarkers: import("leaflet").Marker[] = [];
      geoJsonLayer.eachLayer((layer) => {
        const featureLayer = layer as import("leaflet").Layer & {
          feature?: CountryFeature;
          getBounds?: () => import("leaflet").LatLngBounds;
        };
        const code = featureLayer.feature?.properties?.A3 ?? "";
        const quote = quotesByCode.get(code);
        if (!quote || !matchesRegion(quote, activeRegion)) return;

        const position = getCountryLabelPosition(featureLayer.feature);

        if (!position) return;

        labelMarkers.push(
          L.marker(position, {
            interactive: false,
            keyboard: false,
            zIndexOffset: 900,
            icon: L.divIcon({
              className: "world-heat-country-label",
              html: buildCountryMapLabel(quote),
              iconAnchor: [0, 0],
            }),
          })
        );
      });

      const labelLayer = L.layerGroup(labelMarkers).addTo(current.map);

      current.geoJsonLayer = geoJsonLayer;
      current.labelLayer = labelLayer;
      fitRegion(current.map, activeRegion, compact);
      current.map.invalidateSize(false);
    }

    void paintCountries();

    return () => {
      cancelled = true;
    };
  }, [activeRegion, compact, countries, quotesByCode]);

  return (
    <>
      <div ref={containerRef} className="world-heat-map absolute inset-0 z-10" />
      {!countries ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="rounded-full border border-white/70 bg-white/88 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            Loading country heat map...
          </div>
        </div>
      ) : null}
    </>
  );
}

function SnapshotCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "gain" | "loss" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-soft",
        tone === "gain"
          ? "border-emerald-200 bg-emerald-50"
          : tone === "loss"
            ? "border-rose-200 bg-rose-50"
            : "border-slate-200 bg-slate-50"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function SignalCard({
  label,
  quote,
  tone,
  fallback,
}: {
  label: string;
  quote: GlobalMarketQuote | null;
  tone: "gain" | "loss";
  fallback: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 shadow-soft">
      <div className="flex items-center gap-2">
        {tone === "gain" ? (
          <TrendingUp className="size-4 text-gain" />
        ) : (
          <TrendingDown className="size-4 text-loss" />
        )}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h3>
      </div>
      {quote ? (
        <div className="mt-3">
          <p className="text-lg font-semibold">{quote.country}</p>
          <p className="text-sm text-muted-foreground">{quote.name}</p>
          <p className={cn("mt-3 text-2xl font-semibold tabular-nums", plColorClass(quote.changePct))}>
            {formatPercent(quote.changePct, 2)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMarketPrice(quote.price, quote.currency)}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{fallback}</p>
      )}
    </div>
  );
}

function MoveList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: GlobalMarketQuote[];
  tone: "gain" | "loss";
}) {
  const TitleIcon = tone === "gain" ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <TitleIcon className={cn("size-4", tone === "gain" ? "text-gain" : "text-loss")} />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((quote) => (
          <div
            key={`${title}-${quote.symbol}`}
            className="rounded-xl border border-border bg-card px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{quote.country}</p>
                <p className="text-xs text-muted-foreground">{quote.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("font-semibold tabular-nums", plColorClass(quote.changePct))}>
                  {formatPercent(quote.changePct, 2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMarketPrice(quote.price, quote.currency)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScaleLegend({ min, max }: { min: number; max: number }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-2xl border border-white/75 bg-white/92 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
        <span className="tabular-nums">{formatPercent(min, 2)}</span>
        <span className="h-2.5 w-48 rounded-full bg-[linear-gradient(90deg,#e34f5f_0%,#f4b1ba_28%,#d9e3ef_50%,#b5d94d_72%,#2d9b56_100%)] sm:w-64" />
        <span className="tabular-nums">{formatPercent(max, 2)}</span>
      </div>
    </div>
  );
}

function matchesRegion(quote: GlobalMarketQuote, activeRegion: WorldRegionFilter) {
  const filter = WORLD_REGION_FILTERS.find((item) => item.key === activeRegion);
  return filter ? filter.match(quote) : true;
}

function labelForRegion(activeRegion: WorldRegionFilter) {
  return WORLD_REGION_FILTERS.find((filter) => filter.key === activeRegion)?.label ?? "All";
}

function averageChange(quotes: GlobalMarketQuote[]) {
  const priced = quotes.filter((quote) => quote.changePct != null);
  if (!priced.length) return 0;
  return priced.reduce((sum, quote) => sum + (quote.changePct ?? 0), 0) / priced.length;
}

function regionSummary(quotes: GlobalMarketQuote[]) {
  const groups = new Map<string, GlobalMarketQuote[]>();
  for (const quote of quotes) {
    const key = quote.region ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), quote]);
  }

  const order = ["Asia Pacific", "Europe", "Americas", "MENA"];
  return Array.from(groups.entries())
    .map(([name, rows]) => {
      const priced = rows.filter((row) => row.changePct != null);
      const avg = averageChange(priced);
      const up = priced.filter((row) => (row.changePct ?? 0) > 0).length;
      const down = priced.filter((row) => (row.changePct ?? 0) < 0).length;
      return {
        name,
        avg,
        up,
        down,
        flat: Math.max(0, priced.length - up - down),
      };
    })
    .sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name));
}

function topMoved(quotes: GlobalMarketQuote[], direction: "gain" | "loss") {
  const priced = quotes.filter((quote) => quote.changePct != null);
  return priced
    .sort((left, right) =>
      direction === "gain"
        ? (right.changePct ?? 0) - (left.changePct ?? 0)
        : (left.changePct ?? 0) - (right.changePct ?? 0)
    )
    .slice(0, 5);
}

function moveRange(quotes: GlobalMarketQuote[]) {
  const moves = quotes
    .map((quote) => quote.changePct)
    .filter((value): value is number => value != null && Number.isFinite(value));
  if (!moves.length) {
    return { min: -2, max: 2 };
  }

  return {
    min: Math.min(...moves),
    max: Math.max(...moves),
  };
}

function fitRegion(
  map: import("leaflet").Map,
  region: WorldRegionFilter,
  compact = false
) {
  const bounds =
    (compact ? WORLD_REGION_BOUNDS_COMPACT[region] : null) ??
    WORLD_REGION_BOUNDS[region];

  map.fitBounds(
    bounds as unknown as import("leaflet").LatLngBoundsExpression,
    {
      padding: compact ? [12, 12] : [20, 20],
      animate: false,
      maxZoom: compact
        ? region === "all"
          ? 3.55
          : 4.35
        : region === "all"
          ? 3.35
          : 4.2,
    }
  );
}

function mapFillColor(
  value: number | null,
  active: boolean,
  hasQuote: boolean
) {
  if (!hasQuote || !active) return "#c9d5e6";
  if (value == null || Number.isNaN(value)) return "#dbe3ef";
  if (value >= 1.5) return "#2a9d55";
  if (value > 0) return "#a5cf4b";
  if (value <= -1.5) return "#d95866";
  if (value < 0) return "#f4b1ba";
  return "#dbe3ef";
}

function toneChipClass(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return "bg-slate-100 text-slate-700";
  }
  if (value >= 1.5) return "bg-emerald-100 text-emerald-700";
  if (value > 0) return "bg-lime-100 text-lime-700";
  if (value <= -1.5) return "bg-rose-100 text-rose-700";
  return "bg-rose-50 text-rose-600";
}

function statusLabel(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) return "Flat";
  if (value >= 1.5) return "Strong green";
  if (value > 0) return "Light green";
  if (value <= -1.5) return "Red";
  return "Light red";
}

function buildCountryTooltip(quote: GlobalMarketQuote) {
  return buildCountryCard(quote);
}

function buildCountryPopup(quote: GlobalMarketQuote) {
  return `
    ${buildCountryCard(quote)}
  `;
}

function buildCountryMapLabel(quote: GlobalMarketQuote) {
  return `<span class="world-heat-country-label__text">${escapeHtml(quote.country ?? quote.name)}</span>`;
}

type GeoPoint = [number, number];
type PolygonCoordinates = GeoPoint[][];
type MultiPolygonCoordinates = GeoPoint[][][];

function getCountryLabelPosition(feature?: CountryFeature): [number, number] | null {
  const geometry = feature?.geometry;
  if (!geometry) return null;

  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as PolygonCoordinates]
      : (geometry.coordinates as MultiPolygonCoordinates);

  if (!polygons.length) return null;

  let largestPolygon: PolygonCoordinates | null = null;
  let largestArea = -1;

  for (const polygon of polygons) {
    const outerRing = polygon[0];
    const area = polygonRingArea(outerRing);
    if (area > largestArea) {
      largestArea = area;
      largestPolygon = polygon;
    }
  }

  const ring = largestPolygon?.[0];
  if (!ring?.length) return null;

  return polygonRingCentroid(ring) ?? polygonRingBoundsCenter(ring);
}

function polygonRingArea(ring?: GeoPoint[]) {
  if (!ring || ring.length < 3) return 0;

  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

function polygonRingCentroid(ring?: GeoPoint[]): [number, number] | null {
  if (!ring || ring.length < 3) return null;

  let crossSum = 0;
  let lonSum = 0;
  let latSum = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[(index + 1) % ring.length];
    const cross = lon1 * lat2 - lon2 * lat1;
    crossSum += cross;
    lonSum += (lon1 + lon2) * cross;
    latSum += (lat1 + lat2) * cross;
  }

  if (Math.abs(crossSum) < 1e-9) {
    return null;
  }

  const lon = lonSum / (3 * crossSum);
  const lat = latSum / (3 * crossSum);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return [lat, lon];
}

function polygonRingBoundsCenter(ring?: GeoPoint[]): [number, number] | null {
  if (!ring?.length) return null;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) {
    return null;
  }

  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

function buildCountryCard(quote: GlobalMarketQuote) {
  const tone = valueToneClass(quote.changePct);
  return `
    <div class="world-heat-country-card">
      <div class="world-heat-country-card__header">
        <div class="world-heat-country-card__flag">${escapeHtml(countryFlagEmoji(quote.countryCode))}</div>
        <div class="world-heat-country-card__headline">
          <div class="world-heat-country-card__country">${escapeHtml(quote.country ?? quote.symbol)}</div>
          <div class="world-heat-country-card__exchange">${escapeHtml(quote.name)}</div>
        </div>
      </div>

      <div class="world-heat-country-card__divider"></div>

      <div class="world-heat-country-card__rows">
        <div class="world-heat-country-card__row">
          <span class="world-heat-country-card__label">Last</span>
          <span class="world-heat-country-card__value">${escapeHtml(formatHeatMapLast(quote.price))}</span>
        </div>
        <div class="world-heat-country-card__row">
          <span class="world-heat-country-card__label">Change</span>
          <span class="world-heat-country-card__value ${tone}">${escapeHtml(formatSigned(quote.change, 2))}</span>
        </div>
        <div class="world-heat-country-card__row">
          <span class="world-heat-country-card__label">% Change</span>
          <span class="world-heat-country-card__value ${tone}">${escapeHtml(formatPercent(quote.changePct, 2))}</span>
        </div>
      </div>
    </div>
  `;
}

function formatHeatMapLast(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 2 : abs >= 100 ? 2 : 3;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function valueToneClass(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return "world-heat-country-card__value--flat";
  }
  return value > 0
    ? "world-heat-country-card__value--gain"
    : "world-heat-country-card__value--loss";
}

function countryFlagEmoji(code?: string | null) {
  if (!code) return "🌍";

  const flags: Record<string, string> = {
    ARG: "🇦🇷",
    AUS: "🇦🇺",
    AUT: "🇦🇹",
    BEL: "🇧🇪",
    BRA: "🇧🇷",
    CAN: "🇨🇦",
    CHE: "🇨🇭",
    CHL: "🇨🇱",
    CHN: "🇨🇳",
    COL: "🇨🇴",
    DEU: "🇩🇪",
    DNK: "🇩🇰",
    EGY: "🇪🇬",
    ESP: "🇪🇸",
    FIN: "🇫🇮",
    FRA: "🇫🇷",
    GBR: "🇬🇧",
    GRC: "🇬🇷",
    HKG: "🇭🇰",
    HUN: "🇭🇺",
    IDN: "🇮🇩",
    IND: "🇮🇳",
    IRL: "🇮🇪",
    ISR: "🇮🇱",
    ITA: "🇮🇹",
    IRN: "🇮🇷",
    JPN: "🇯🇵",
    KOR: "🇰🇷",
    KWT: "🇰🇼",
    MEX: "🇲🇽",
    MYS: "🇲🇾",
    NLD: "🇳🇱",
    NOR: "🇳🇴",
    NZL: "🇳🇿",
    PER: "🇵🇪",
    PAK: "🇵🇰",
    PHL: "🇵🇭",
    POL: "🇵🇱",
    PRT: "🇵🇹",
    QAT: "🇶🇦",
    ROU: "🇷🇴",
    SAU: "🇸🇦",
    SGP: "🇸🇬",
    SWE: "🇸🇪",
    THA: "🇹🇭",
    TUR: "🇹🇷",
    TWN: "🇹🇼",
    USA: "🇺🇸",
    VNM: "🇻🇳",
    ZAF: "🇿🇦",
    ARE: "🇦🇪",
  };

  return flags[code] ?? "🌍";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
