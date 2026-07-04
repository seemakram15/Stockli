import "server-only";

import { z } from "zod";
import {
  buildDeterministicWorldPulseInsight,
  type WorldPulseAiInsight,
  type WorldPulseTimeRange,
  type WorldPulseView,
} from "@/lib/analysis/world-pulse";
import {
  STOCK_ANALYZER_AI_MODELS,
  type StockAnalyzerAiModel,
} from "@/lib/analysis/stock-analyzer-ai";
import { getStaleCached } from "@/lib/cache/stale";
import { config, isZaiConfigured } from "@/lib/config";
import { getWorldPulseData } from "@/lib/services/world-pulse";

const AI_TTL_SECONDS = 6 * 60 * 60;
const AI_STALE_SECONDS = 24 * 60 * 60;
const AI_REQUEST_TIMEOUT_MS = 15_000;
const AI_REFRESH_ERROR_MESSAGE =
  "We could not refresh the live summary right now. Please try again in a few minutes.";

export class WorldMonitorAiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "WorldMonitorAiError";
    this.statusCode = statusCode;
  }
}

const insightSchema = z.object({
  headline: z.string().min(1).max(180),
  summary: z.string().min(1).max(900),
  focusPoints: z.array(z.string().min(1).max(240)).min(1).max(5),
  watchItems: z.array(z.string().min(1).max(240)).min(1).max(4),
  suggestion: z.string().min(1).max(420),
  confidence: z.enum(["high", "medium", "low"]),
});

type WorldMonitorAiPayload = {
  view: WorldPulseView;
  timeRange: WorldPulseTimeRange;
  deterministic: WorldPulseAiInsight;
  insight: WorldPulseAiInsight;
  generatedAt: string;
  sourceUpdatedAt: string;
};

export async function getWorldMonitorAiInsight({
  view,
  timeRange,
  model,
}: {
  view: WorldPulseView;
  timeRange: WorldPulseTimeRange;
  model?: StockAnalyzerAiModel;
}) {
  const pulse = await getWorldPulseData({ view, timeRange });
  const deterministic = buildDeterministicWorldPulseInsight(pulse.value);

  return getStaleCached<WorldMonitorAiPayload>({
    key: `public:world-monitor:ai:v1:auto:${view}:${timeRange}:${pulse.value.updatedAt}`,
    ttlSeconds: AI_TTL_SECONDS,
    staleSeconds: AI_STALE_SECONDS,
    load: async () => ({
      view,
      timeRange,
      deterministic,
      insight: await callZaiJsonWithFallback({
        preferredModel: model,
        schema: insightSchema,
        system:
          "You are Stockli's world monitor analyst. Use only the supplied feed, market and alert data. Explain clearly in plain English. Never output markdown.",
        prompt: buildWorldMonitorPrompt(pulse.value, deterministic),
      }),
      generatedAt: new Date().toISOString(),
      sourceUpdatedAt: pulse.value.updatedAt,
    }),
    isUsable: (value) => Boolean(value?.insight?.summary),
  });
}

async function callZaiJson<T>({
  model,
  schema,
  system,
  prompt,
}: {
  model: StockAnalyzerAiModel;
  schema: z.ZodSchema<T>;
  system: string;
  prompt: unknown;
}) {
  if (!isZaiConfigured) {
    throw new WorldMonitorAiError(AI_REFRESH_ERROR_MESSAGE, 503);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  const response = await fetch(`${config.ai.zaiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.ai.zaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    }),
    signal: controller.signal,
  }).catch((error) => {
    if (error instanceof Error && error.name === "AbortError") {
      throw new WorldMonitorAiError(AI_REFRESH_ERROR_MESSAGE, 504);
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { code?: string; message?: string };
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      }
    | null;

  if (!response.ok) {
    const message = payload?.error?.message ?? "Z.AI request failed.";
    if (payload?.error?.code === "1302" || /rate limit/i.test(message)) {
      throw new WorldMonitorAiError(AI_REFRESH_ERROR_MESSAGE, 429);
    }
    throw new WorldMonitorAiError(message, response.status >= 400 ? response.status : 502);
  }

  const content = extractMessageContent(payload);
  const parsed = safeJsonParse(content);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new WorldMonitorAiError(
      "AI returned an incomplete live summary. Please retry in a few minutes.",
      502
    );
  }
  return result.data;
}

async function callZaiJsonWithFallback<T>({
  preferredModel,
  schema,
  system,
  prompt,
}: {
  preferredModel?: StockAnalyzerAiModel;
  schema: z.ZodSchema<T>;
  system: string;
  prompt: unknown;
}) {
  const attempts = buildModelAttempts(preferredModel);

  for (const model of attempts) {
    try {
      return await callZaiJson({ model, schema, system, prompt });
    } catch (error) {
      if (
        error instanceof WorldMonitorAiError &&
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        error.statusCode !== 429
      ) {
        continue;
      }
    }
  }

  throw new WorldMonitorAiError(AI_REFRESH_ERROR_MESSAGE, 503);
}

function buildModelAttempts(preferredModel?: StockAnalyzerAiModel) {
  const attempts = preferredModel
    ? [preferredModel, ...STOCK_ANALYZER_AI_MODELS.filter((model) => model !== preferredModel)]
    : [...STOCK_ANALYZER_AI_MODELS];
  return [...new Set(attempts)];
}

function extractMessageContent(payload: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
} | null) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }
  throw new WorldMonitorAiError("Z.AI returned an empty response.", 502);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new WorldMonitorAiError(
        "AI did not return valid JSON for the live summary.",
        502
      );
    }
    return JSON.parse(match[0]);
  }
}

function buildWorldMonitorPrompt(
  data: Awaited<ReturnType<typeof getWorldPulseData>>["value"],
  deterministic: WorldPulseAiInsight
) {
  return [
    "Return only a valid JSON object.",
    "Required keys: headline, summary, focusPoints, watchItems, suggestion, confidence.",
    'Set confidence to only one of: "high", "medium", "low".',
    "Use simple, direct language for an investor or market watcher.",
    "Do not invent unseen events, secret intelligence, casualty counts, or political claims.",
    "Ground every line in the supplied headlines, hotspots, disaster alerts and market moves.",
    "Mention both the live situation and how markets are reacting.",
    "Live monitor data:",
    JSON.stringify({
      region: data.regionLabel,
      timeRange: data.timeRange,
      updatedAt: data.updatedAt,
      summary: data.summary,
      marketTone: data.marketSnapshot.tone,
      marketSignals: data.marketSnapshot.signals,
      topHotspots: data.hotspots.slice(0, 5).map((item) => ({
        name: item.name,
        country: item.country,
        severity: item.severity,
        eventCount: item.eventCount,
        lead: item.lead,
      })),
      topDisasters: data.disasters.slice(0, 5).map((item) => ({
        title: item.title,
        category: item.category,
        country: item.country,
        alertLevel: item.alertLevel,
        severityLabel: item.severityLabel,
      })),
      feed: data.intelFeed.slice(0, 8).map((item) => ({
        title: item.title,
        source: item.source,
        category: item.category,
        hotspotIds: item.hotspotIds,
      })),
      markets: data.marketMarkers.slice(0, 8).map((item) => ({
        name: item.name,
        country: item.country,
        changePct: item.changePct,
      })),
    }),
    "Deterministic baseline you may improve:",
    JSON.stringify(deterministic),
  ].join("\n");
}
