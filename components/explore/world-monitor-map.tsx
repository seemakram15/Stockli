"use client";

import * as React from "react";
// Scoped to this map component instead of the root layout, so pages that
// never render a map don't ship Leaflet's CSS.
import "leaflet/dist/leaflet.css";
import {
  type WorldPulseData,
  type WorldPulseLayer,
} from "@/lib/analysis/world-pulse";

export function WorldMonitorMap({
  data,
  activeLayer,
}: {
  data: WorldPulseData;
  activeLayer: WorldPulseLayer;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<{
    map: import("leaflet").Map;
    layerGroup: import("leaflet").LayerGroup;
  } | null>(null);

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
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      mapRef.current = { map, layerGroup };

      map.setView([data.focus.center[1], data.focus.center[0]], data.focus.zoom);
      map.fitBounds(
        [
          [data.focus.bounds[0][1], data.focus.bounds[0][0]],
          [data.focus.bounds[1][1], data.focus.bounds[1][0]],
        ],
        { padding: [42, 42], maxZoom: Math.max(data.focus.zoom, 4.2) }
      );

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
      current?.layerGroup.clearLayers();
      current?.map.remove();
      mapRef.current = null;
    };
  }, [data.focus.bounds, data.focus.center, data.focus.zoom]);

  React.useEffect(() => {
    const current = mapRef.current;
    if (!current) return;

    current.map.fitBounds(
      [
        [data.focus.bounds[0][1], data.focus.bounds[0][0]],
        [data.focus.bounds[1][1], data.focus.bounds[1][0]],
      ],
      { padding: [42, 42], maxZoom: Math.max(data.focus.zoom, 4.2) }
    );
    current.map.invalidateSize(false);
  }, [data.focus.bounds, data.focus.zoom]);

  React.useEffect(() => {
    let cancelled = false;

    async function paintMarkers() {
      const current = mapRef.current;
      if (!current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;

      current.layerGroup.clearLayers();

      if (activeLayer === "conflicts") {
        data.hotspots.forEach((item) => {
          L.circleMarker([item.lat, item.lon], {
            radius: 7 + Math.min(7, item.eventCount),
            color: "#ffffff",
            weight: 2,
            fillColor: hotspotColor(item.severity),
            fillOpacity: 0.92,
          })
            .bindPopup(buildConflictPopup(item))
            .addTo(current.layerGroup);
        });
        return;
      }

      if (activeLayer === "disasters") {
        data.disasters.forEach((item) => {
          L.circleMarker([item.lat, item.lon], {
            radius: 6 + (item.alertLevel === "red" ? 6 : item.alertLevel === "orange" ? 4 : 2),
            color: "#ffffff",
            weight: 2,
            fillColor: disasterColor(item.alertLevel),
            fillOpacity: 0.92,
          })
            .bindPopup(buildDisasterPopup(item))
            .addTo(current.layerGroup);
        });
        return;
      }

      data.marketMarkers.forEach((item) => {
        L.circleMarker([item.lat, item.lon], {
          radius: 6 + Math.min(6, Math.abs(item.changePct ?? 0) * 3),
          color: "#ffffff",
          weight: 2,
          fillColor: marketColor(item.changePct),
          fillOpacity: 0.92,
        })
          .bindPopup(buildMarketPopup(item))
          .addTo(current.layerGroup);
      });
    }

    void paintMarkers();

    return () => {
      cancelled = true;
    };
  }, [activeLayer, data.disasters, data.hotspots, data.marketMarkers]);

  return <div ref={containerRef} className="absolute inset-0" />;
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

function formatSignedPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Flat";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}

function formatMarketPopup(price: number | null, currency: string | null) {
  if (price == null || Number.isNaN(price)) return "Price unavailable";
  return `${currency ?? "USD"} ${price.toLocaleString(undefined, {
    minimumFractionDigits: price >= 100 ? 0 : 2,
    maximumFractionDigits: price >= 100 ? 2 : 3,
  })}`;
}

function buildConflictPopup(item: WorldPulseData["hotspots"][number]) {
  return `
    <div style="min-width:220px;padding:4px 2px 2px 2px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Conflict hotspot</div>
      <div style="margin-top:6px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(item.name)}</div>
      <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(item.country)} · ${escapeHtml(item.severity)}</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.5;color:#0f172a;">${escapeHtml(item.lead)}</div>
      <div style="margin-top:8px;font-size:12px;color:#64748b;">${item.eventCount} fresh signals</div>
    </div>
  `;
}

function buildDisasterPopup(item: WorldPulseData["disasters"][number]) {
  return `
    <div style="min-width:220px;padding:4px 2px 2px 2px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Disaster alert</div>
      <div style="margin-top:6px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(item.category)}</div>
      <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(item.country)} · ${escapeHtml(item.alertLevel)} alert</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.5;color:#0f172a;">${escapeHtml(item.title)}</div>
      <div style="margin-top:8px;font-size:12px;color:#64748b;">${escapeHtml(item.severityLabel)}</div>
    </div>
  `;
}

function buildMarketPopup(item: WorldPulseData["marketMarkers"][number]) {
  return `
    <div style="min-width:220px;padding:4px 2px 2px 2px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">Market marker</div>
      <div style="margin-top:6px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(item.name)}</div>
      <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(item.country)}</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.5;color:#0f172a;">${formatMarketPopup(item.price, item.currency)} · ${formatSignedPercent(item.changePct)}</div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
