export const colors = {
  bg: "#0f0f13",
  surface: "#17171f",
  surface2: "#1e1e28",
  border: "#2a2a38",
  text: "#e8e8f0",
  muted: "#8888a8",
  accent: "#8b5cf6",
  accentDim: "#3b2d6e",
  accentText: "#c4b5fd",
  gain: "#34d399",
  gainDim: "#0d3328",
  loss: "#f87171",
  lossDim: "#3b1212",
  warn: "#fbbf24",
  warnDim: "#3b2800",
  sky: "#38bdf8",
  skyDim: "#0b2a3b",
  emerald: "#10b981",
  rose: "#ec4899",
  orange: "#f97316",
  amber: "#f59e0b",
  violet: "#7c3aed",
} as const;

export const lightColors = {
  bg: "#f4f4f8",
  surface: "#ffffff",
  surface2: "#f0f0f6",
  border: "#e0e0ec",
  text: "#18182a",
  muted: "#666688",
  accent: "#7c3aed",
  accentDim: "#ede9fe",
  accentText: "#5b21b6",
  gain: "#059669",
  gainDim: "#d1fae5",
  loss: "#dc2626",
  lossDim: "#fee2e2",
  warn: "#d97706",
  warnDim: "#fef3c7",
  sky: "#0284c7",
  skyDim: "#e0f2fe",
  emerald: "#059669",
  rose: "#e11d48",
  orange: "#ea580c",
  amber: "#d97706",
  violet: "#6d28d9",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  "2xl": 28,
  "3xl": 34,
} as const;

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
};
