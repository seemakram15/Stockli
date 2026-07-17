"use client";

import * as React from "react";
import type { WorldPulseData, WorldPulseLayer } from "@/lib/analysis/world-pulse";

export function WorldGlobe({
  data,
  activeLayer,
}: {
  data: WorldPulseData;
  activeLayer: WorldPulseLayer;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const spinRef = React.useRef<number | null>(null);
  const spinningRef = React.useRef(true);

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
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            carto: {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© CartoDB",
            },
          },
          layers: [
            { id: "background", type: "background", paint: { "background-color": "#061a24" } },
            { id: "carto", type: "raster", source: "carto" },
          ],
        },
        center: [20, 10],
        zoom: 1.5,
        attributionControl: false,
        ...(({ projection: { type: "globe" } } as unknown) as object),
      });

      map.on("load", () => {
        paintMarkers(map, ml, data, activeLayer);
        startSpin(map);
      });

      map.on("mousedown", () => {
        spinningRef.current = false;
        if (spinRef.current !== null) {
          cancelAnimationFrame(spinRef.current);
          spinRef.current = null;
        }
      });

      mapRef.current = map;
    }

    void init();

    return () => {
      cancelled = true;
      if (spinRef.current !== null) {
        cancelAnimationFrame(spinRef.current);
        spinRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
      spinningRef.current = true;
    };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    void import("maplibre-gl").then((ml) => {
      paintMarkers(map, ml, data, activeLayer);
    });
  }, [activeLayer, data]);

  return (
    <div ref={containerRef} className="absolute inset-0" />
  );
}

function startSpin(map: import("maplibre-gl").Map) {
  let last = performance.now();

  function frame(now: number) {
    const dt = now - last;
    last = now;
    const c = map.getCenter();
    c.lng = (c.lng - dt * 0.012 + 540) % 360 - 180;
    map.setCenter(c, { animate: false });
    (frame as { raf?: number }).raf = requestAnimationFrame(frame);
  }

  (frame as { raf?: number }).raf = requestAnimationFrame(frame);

  map.once("mousedown", () => {
    if ((frame as { raf?: number }).raf !== undefined) {
      cancelAnimationFrame((frame as { raf?: number }).raf!);
    }
  });
}

function paintMarkers(
  map: import("maplibre-gl").Map,
  ml: typeof import("maplibre-gl"),
  data: WorldPulseData,
  activeLayer: WorldPulseLayer,
) {
  ["globe-markers"].forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource("globe-markers")) map.removeSource("globe-markers");

  const items =
    activeLayer === "conflicts"
      ? data.hotspots.map((h) => ({
          lat: h.lat,
          lon: h.lon,
          color: hotspotColor(h.severity),
          name: h.name,
          sub: `${h.country} · ${h.severity}`,
          detail: h.lead,
        }))
      : activeLayer === "disasters"
        ? data.disasters.map((d) => ({
            lat: d.lat,
            lon: d.lon,
            color: disasterColor(d.alertLevel),
            name: d.category,
            sub: `${d.country} · ${d.alertLevel}`,
            detail: d.title,
          }))
        : data.marketMarkers.map((m) => ({
            lat: m.lat,
            lon: m.lon,
            color: marketColor(m.changePct),
            name: m.name,
            sub: m.country,
            detail: `${formatPct(m.changePct)}`,
          }));

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.lon, item.lat] },
      properties: {
        color: item.color,
        name: item.name,
        sub: item.sub,
        detail: item.detail,
      },
    })),
  };

  map.addSource("globe-markers", { type: "geojson", data: geojson });
  map.addLayer({
    id: "globe-markers",
    type: "circle",
    source: "globe-markers",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": 7,
      "circle-opacity": 0.9,
      "circle-stroke-width": 2,
      "circle-stroke-color": "rgba(255,255,255,0.6)",
    },
  });

  const popup = new ml.Popup({ closeButton: false, closeOnClick: false });

  map.on("click", "globe-markers", (e) => {
    const feat = e.features?.[0];
    if (!feat) return;
    const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
    const { name, sub, detail } = feat.properties as { name: string; sub: string; detail: string };
    popup
      .setLngLat(coords)
      .setHTML(
        `<div style="min-width:200px;padding:4px 2px 2px 2px;">
          <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(sub)}</div>
          <div style="margin-top:6px;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(name)}</div>
          <div style="margin-top:6px;font-size:13px;line-height:1.5;color:#334155;">${escapeHtml(detail)}</div>
        </div>`,
      )
      .addTo(map);
  });

  map.on("mouseenter", "globe-markers", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "globe-markers", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });
}

function hotspotColor(severity: WorldPulseData["hotspots"][number]["severity"]) {
  if (severity === "critical") return "#ef4444";
  if (severity === "high") return "#f97316";
  if (severity === "elevated") return "#facc15";
  return "#38bdf8";
}

function disasterColor(level: WorldPulseData["disasters"][number]["alertLevel"]) {
  if (level === "red") return "#fb7185";
  if (level === "orange") return "#fb923c";
  return "#4ade80";
}

function marketColor(changePct: number | null) {
  if (changePct == null) return "#cbd5e1";
  if (changePct >= 1) return "#22c55e";
  if (changePct > 0) return "#84cc16";
  if (changePct <= -1) return "#f43f5e";
  if (changePct < 0) return "#f97316";
  return "#cbd5e1";
}

function formatPct(v: number | null) {
  if (v == null) return "Flat";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
