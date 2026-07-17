"use client";

import * as React from "react";
import type { GlobalMarketQuote } from "@/lib/services/global-markets";

export function WorldHeatGlobe({ quotes }: { quotes: GlobalMarketQuote[] }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const ml = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const map = new ml.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            carto: {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
            },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#061a24" } },
            { id: "carto", type: "raster", source: "carto" },
          ],
        },
        center: [20, 10],
        zoom: 1.5,
        attributionControl: false,
        ...(({ projection: { type: "globe" } } as unknown) as object),
      });

      map.on("load", () => {
        addMarkers(map, ml, quotes);
        startSpin(map);
      });

      mapRef.current = map;
    }

    void init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    void import("maplibre-gl").then((ml) => addMarkers(map, ml, quotes));
  }, [quotes]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function startSpin(map: import("maplibre-gl").Map) {
  let last = performance.now();
  let stopped = false;

  function frame(now: number) {
    if (stopped) return;
    const dt = now - last;
    last = now;
    const c = map.getCenter();
    c.lng = (c.lng - dt * 0.012 + 540) % 360 - 180;
    map.setCenter(c, { animate: false } as never);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  map.once("mousedown", () => { stopped = true; });
}

function addMarkers(
  map: import("maplibre-gl").Map,
  ml: typeof import("maplibre-gl"),
  quotes: GlobalMarketQuote[],
) {
  if (map.getLayer("hm")) map.removeLayer("hm");
  if (map.getSource("hm")) map.removeSource("hm");

  const features: GeoJSON.Feature[] = quotes
    .filter((q) => q.lat != null && q.lon != null)
    .map((q) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [q.lon!, q.lat!] },
      properties: {
        color: quoteColor(q.changePct),
        name: q.country ?? q.name,
        sub: q.name,
        detail: q.changePct != null ? fmtPct(q.changePct) : "—",
      },
    }));

  map.addSource("hm", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({
    id: "hm",
    type: "circle",
    source: "hm",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": 7,
      "circle-opacity": 0.92,
      "circle-stroke-width": 2,
      "circle-stroke-color": "rgba(255,255,255,0.55)",
    },
  });

  const popup = new ml.Popup({ closeButton: false, closeOnClick: false });

  map.on("click", "hm", (e) => {
    const feat = e.features?.[0];
    if (!feat) return;
    const [lng, lat] = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
    const { name, sub, detail } = feat.properties as { name: string; sub: string; detail: string };
    popup
      .setLngLat([lng, lat])
      .setHTML(
        `<div style="min-width:180px;padding:4px 2px 2px 2px;">
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">${esc(sub)}</div>
          <div style="margin-top:6px;font-size:15px;font-weight:700;color:#0f172a;">${esc(name)}</div>
          <div style="margin-top:6px;font-size:14px;font-weight:600;color:#0f172a;">${esc(detail)}</div>
        </div>`,
      )
      .addTo(map);
  });
  map.on("mouseenter", "hm", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "hm", () => { map.getCanvas().style.cursor = ""; popup.remove(); });
}

function quoteColor(changePct: number | null | undefined) {
  if (changePct == null) return "#cbd5e1";
  if (changePct >= 1.5) return "#2a9d55";
  if (changePct > 0) return "#a5cf4b";
  if (changePct <= -1.5) return "#d95866";
  if (changePct < 0) return "#f4b1ba";
  return "#dbe3ef";
}

function fmtPct(v: number) {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function esc(v: string) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
