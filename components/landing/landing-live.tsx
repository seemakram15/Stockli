"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random walks (stable between server/client)   */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeWalk(seed: string, points: number, drift: number): number[] {
  const rand = mulberry32(seedFrom(seed));
  const out: number[] = [50];
  for (let i = 1; i < points; i++) {
    const step = (rand() - 0.5 + drift * 0.18) * 14;
    out.push(Math.min(92, Math.max(8, out[i - 1] + step)));
  }
  return out;
}

/** Smooth SVG path through points (Catmull-Rom → cubic bezier). */
function smoothPath(values: number[], width: number, height: number): string {
  const n = values.length;
  const pts = values.map((v, i) => [
    (i / (n - 1)) * width,
    height - (v / 100) * height,
  ]);
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/* ------------------------------------------------------------------ */
/*  Sparkline — tiny inline trend chart that draws itself in           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  seed,
  up,
  className,
  width = 84,
  height = 28,
}: {
  seed: string;
  up: boolean;
  className?: string;
  width?: number;
  height?: number;
}) {
  const reduce = useReducedMotion();
  const gradientId = React.useId();
  const d = React.useMemo(
    () => smoothPath(makeWalk(seed, 22, up ? 1 : -1), width, height),
    [seed, up, width, height]
  );
  const stroke = up ? "var(--gain)" : "var(--loss)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${d} L ${width} ${height} L 0 ${height} Z`}
        fill={`url(#${gradientId})`}
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.35 }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  LiveAreaChart — hero chart: draw-in, scanline, pulsing last price  */
/* ------------------------------------------------------------------ */

const W = 520;
const H = 180;

export function LiveAreaChart({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const gradientId = React.useId();
  const d = React.useMemo(() => smoothPath(makeWalk("KSE100-hero", 34, 1), W, H), []);
  // Last point of the walk, mirrored from smoothPath math, for the live dot.
  const values = React.useMemo(() => makeWalk("KSE100-hero", 34, 1), []);
  const lastY = H - (values[values.length - 1] / 100) * H;

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden>
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="55%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="rgb(255 255 255 / 0.07)"
            strokeDasharray="3 6"
          />
        ))}

        <motion.path
          d={`${d} L ${W} ${H} L 0 ${H} Z`}
          fill={`url(#${gradientId}-fill)`}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.9 }}
        />
        <motion.path
          d={d}
          fill="none"
          stroke={`url(#${gradientId}-line)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* pulsing live endpoint */}
        <motion.circle
          cx={W}
          cy={lastY}
          r="4"
          fill="#34d399"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        />
        {!reduce && (
          <motion.circle
            cx={W}
            cy={lastY}
            r="4"
            fill="none"
            stroke="#34d399"
            strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0], scale: [1, 3.2, 3.2] }}
            transition={{ duration: 1.8, delay: 2.2, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: `${W}px ${lastY}px` }}
          />
        )}
      </svg>

      {/* vertical scanline sweep */}
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-emerald-300/60 to-transparent"
          initial={{ left: "0%" }}
          animate={{ left: ["0%", "100%"] }}
          transition={{ duration: 6, delay: 2.4, repeat: Infinity, ease: "linear", repeatDelay: 1.2 }}
          aria-hidden
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LiveTickerValue — a number that "ticks" every few seconds          */
/* ------------------------------------------------------------------ */

type TickerSpec = {
  base: number;
  spread: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  seed: string;
};

export function LiveTickerValue({
  base,
  spread,
  decimals = 2,
  prefix = "",
  suffix = "",
  seed,
  interval = 2600,
  className,
}: TickerSpec & { interval?: number; className?: string }) {
  const reduce = useReducedMotion();
  const rand = React.useRef(mulberry32(seedFrom(seed)));
  const [value, setValue] = React.useState(base);
  const [dir, setDir] = React.useState<"gain" | "loss" | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      const delta = (rand.current() - 0.48) * spread;
      setValue((v) => {
        const next = v + delta;
        setDir(next >= v ? "gain" : "loss");
        return next;
      });
      setTick((t) => t + 1);
    }, interval);
    return () => window.clearInterval(id);
  }, [reduce, spread, interval]);

  return (
    <span
      key={tick}
      className={cn(
        "rounded-md px-1 tabular-nums transition-colors",
        dir === "gain" && "animate-tick-gain",
        dir === "loss" && "animate-tick-loss",
        className
      )}
    >
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
