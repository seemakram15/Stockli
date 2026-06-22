"use client";

import * as React from "react";

/**
 * Tiny dependency-free SVG sparkline. Colour follows the trend (last vs first).
 */
export function Sparkline({
  data,
  width = 96,
  height = 36,
  className,
  strokeWidth = 2,
}: {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const { path, area, up } = React.useMemo(() => {
    if (!data || data.length < 2) return { path: "", area: "", up: true };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const stepX = width / (data.length - 1);
    const pad = strokeWidth;
    const usable = height - pad * 2;
    const pts = data.map((v, i) => {
      const x = i * stepX;
      const y = pad + usable - ((v - min) / span) * usable;
      return [x, y] as const;
    });
    const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const a = `${d} L${width},${height} L0,${height} Z`;
    return { path: d, area: a, up: data[data.length - 1] >= data[0] };
  }, [data, width, height, strokeWidth]);

  const color = up ? "var(--gain)" : "var(--loss)";
  const gid = React.useId();

  if (!path) return null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
