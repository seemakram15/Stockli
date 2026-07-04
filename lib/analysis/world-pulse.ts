export const WORLD_PULSE_VIEWS = [
  "world",
  "asia",
  "middle-east",
  "europe",
  "americas",
  "africa",
] as const;

export const WORLD_PULSE_TIME_RANGES = ["24h", "48h", "7d"] as const;

export const WORLD_PULSE_LAYERS = ["conflicts", "disasters", "markets"] as const;

export type WorldPulseView = (typeof WORLD_PULSE_VIEWS)[number];
export type WorldPulseTimeRange = (typeof WORLD_PULSE_TIME_RANGES)[number];
export type WorldPulseLayer = (typeof WORLD_PULSE_LAYERS)[number];

export const WORLD_PULSE_VIEW_LABELS: Record<WorldPulseView, string> = {
  world: "World",
  asia: "Asia",
  "middle-east": "Middle East",
  europe: "Europe",
  americas: "Americas",
  africa: "Africa",
};

export const WORLD_PULSE_TIME_RANGE_LABELS: Record<WorldPulseTimeRange, string> = {
  "24h": "24h",
  "48h": "48h",
  "7d": "7d",
};

export const WORLD_PULSE_LAYER_META: Record<
  WorldPulseLayer,
  { label: string; description: string }
> = {
  conflicts: {
    label: "Conflict zones",
    description: "Military pressure points and geopolitical hotspots.",
  },
  disasters: {
    label: "Disaster alerts",
    description: "Earthquakes, floods, storms and other live disruption alerts.",
  },
  markets: {
    label: "Market stress",
    description: "Major market centres coloured by one-day market direction.",
  },
};

export interface WorldPulseHeadline {
  id: string;
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  category: "conflict" | "macro";
  hotspotIds: string[];
  summary: string;
}

export interface WorldPulseHotspot {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  score: number;
  eventCount: number;
  severity: "watch" | "elevated" | "high" | "critical";
  latestAt: string | null;
  lead: string;
  latestSource: string | null;
}

export interface WorldPulseDisasterEvent {
  id: string;
  title: string;
  category: string;
  country: string;
  alertLevel: "green" | "orange" | "red";
  lat: number;
  lon: number;
  publishedAt: string;
  link: string;
  summary: string;
  severityLabel: string;
  severityValue: number | null;
}

export interface WorldPulseMarketMarker {
  symbol: string;
  name: string;
  country: string;
  region: string;
  lat: number;
  lon: number;
  price: number | null;
  changePct: number | null;
  currency: string | null;
}

export interface WorldPulseLayerOption {
  key: WorldPulseLayer;
  label: string;
  count: number;
  description: string;
}

export interface WorldPulseSummaryQuote {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  currency?: string | null;
  country?: string;
  updatedAt?: string | null;
}

export interface WorldPulseData {
  updatedAt: string;
  view: WorldPulseView;
  timeRange: WorldPulseTimeRange;
  regionLabel: string;
  focus: {
    center: [number, number];
    zoom: number;
    bounds: [[number, number], [number, number]];
  };
  layerOptions: WorldPulseLayerOption[];
  intelFeed: WorldPulseHeadline[];
  hotspots: WorldPulseHotspot[];
  disasters: WorldPulseDisasterEvent[];
  marketMarkers: WorldPulseMarketMarker[];
  marketSnapshot: {
    averageMove: number;
    best: WorldPulseSummaryQuote | null;
    worst: WorldPulseSummaryQuote | null;
    brent: WorldPulseSummaryQuote | null;
    gold: WorldPulseSummaryQuote | null;
    bitcoin: WorldPulseSummaryQuote | null;
    tone: "risk-on" | "balanced" | "risk-off";
    signals: string[];
  };
  summary: {
    hotspotsLive: number;
    disasterAlerts: number;
    leadHotspot: string | null;
    leadDisaster: string | null;
    feedItems: number;
  };
}

export interface WorldPulseAiInsight {
  headline: string;
  summary: string;
  focusPoints: string[];
  watchItems: string[];
  suggestion: string;
  confidence: "high" | "medium" | "low";
}

export function buildDeterministicWorldPulseInsight(
  data: WorldPulseData
): WorldPulseAiInsight {
  const leadHotspot = data.hotspots[0] ?? null;
  const leadDisaster = data.disasters[0] ?? null;
  const best = data.marketSnapshot.best;
  const worst = data.marketSnapshot.worst;
  const windowLabel = humanizeTimeRange(data.timeRange);
  const toneLabel = humanizeTone(data.marketSnapshot.tone);

  let headline = `${data.regionLabel} monitor shows a ${toneLabel.toLowerCase()} tone`;
  if (leadHotspot) {
    headline = `${leadHotspot.name} is the main pressure point in the ${windowLabel} view`;
  } else if (leadDisaster) {
    headline = `${leadDisaster.category} alerts are shaping the ${windowLabel} global read`;
  } else if (best || worst) {
    headline = `${data.regionLabel} markets are giving a ${toneLabel.toLowerCase()} signal`;
  }

  const summaryParts = [
    `${data.summary.feedItems} live headlines were checked across the last ${windowLabel}.`,
    data.summary.hotspotsLive > 0
      ? `${data.summary.hotspotsLive} active geopolitical hotspots are on the board.`
      : "No major hotspot cluster is dominating the board right now.",
    data.summary.disasterAlerts > 0
      ? `${data.summary.disasterAlerts} disaster alerts are also being watched.`
      : "Disaster alerts are limited in the current window.",
    best && worst
      ? `${best.name} is the strongest market move while ${worst.name} is the weakest.`
      : `Market tone currently reads ${toneLabel.toLowerCase()}.`,
  ];

  const focusPoints = compactLines([
    leadHotspot
      ? `${leadHotspot.name}: ${leadHotspot.eventCount} fresh signals with a ${leadHotspot.severity} severity read.`
      : null,
    leadDisaster
      ? `${leadDisaster.category} alert in ${leadDisaster.country}: ${leadDisaster.severityLabel}.`
      : null,
    best
      ? `${best.name} is up ${formatSignedPercent(best.changePct)} and is the strongest market marker right now.`
      : null,
    worst
      ? `${worst.name} is down ${formatSignedPercent(worst.changePct)} and is the weakest market marker right now.`
      : null,
    data.marketSnapshot.brent
      ? `Brent crude is ${formatSignedPercent(data.marketSnapshot.brent.changePct)}, which helps frame the energy risk backdrop.`
      : null,
    data.marketSnapshot.gold
      ? `Gold is ${formatSignedPercent(data.marketSnapshot.gold.changePct)}, which helps read safety demand.`
      : null,
  ]).slice(0, 4);

  const watchItems = compactLines([
    data.marketSnapshot.tone === "risk-off"
      ? "Markets are leaning defensive, so keep an eye on oil, gold and the weakest equity index."
      : null,
    leadHotspot
      ? `Watch whether ${leadHotspot.country} stays the lead story or cools off over the next few hours.`
      : null,
    leadDisaster
      ? `Track follow-up disruption from ${leadDisaster.country}, especially if logistics or energy routes are nearby.`
      : null,
    data.marketSnapshot.bitcoin
      ? `Bitcoin is ${formatSignedPercent(data.marketSnapshot.bitcoin.changePct)} and can help confirm risk appetite.`
      : null,
    "Use the live feed as an early-warning screen, then confirm the original source before acting on a headline.",
  ]).slice(0, 4);

  return {
    headline,
    summary: summaryParts.join(" "),
    focusPoints,
    watchItems,
    suggestion:
      "Read this page as a fast global situation screen: start with the map, confirm the top hotspot, then check whether markets are supporting or fading that risk signal.",
    confidence:
      data.summary.feedItems >= 8 && data.summary.hotspotsLive + data.summary.disasterAlerts >= 3
        ? "high"
        : data.summary.feedItems >= 4
          ? "medium"
          : "low",
  };
}

export function formatSignedPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "0.00%";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}

export function humanizeTimeRange(range: WorldPulseTimeRange) {
  if (range === "24h") return "24 hours";
  if (range === "48h") return "48 hours";
  return "7 days";
}

export function humanizeTone(tone: WorldPulseData["marketSnapshot"]["tone"]) {
  if (tone === "risk-on") return "Risk-on";
  if (tone === "risk-off") return "Risk-off";
  return "Balanced";
}

function compactLines(items: Array<string | null>) {
  return items.filter((item): item is string => Boolean(item?.trim()));
}
