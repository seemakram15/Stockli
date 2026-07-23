import "server-only";

import { z } from "zod";
import {
  buildAnalyzerComparison,
  buildAnalyzerSummary,
  type AnalyzerComparison,
  type AnalyzerSummary,
} from "@/lib/analysis/stock-analyzer";
import {
  buildDeterministicAnalyzeInsight,
  buildDeterministicCompareInsight,
  STOCK_ANALYZER_AI_MODELS,
  type StockAnalyzeAiInsight,
  type StockAnalyzerAiModel,
  type StockCompareAiInsight,
} from "@/lib/analysis/stock-analyzer-ai";
import { getStaleCached } from "@/lib/cache/stale";
import { config, isZaiConfigured } from "@/lib/config";
import { getStockFinancials } from "@/lib/services/stock-fundamentals";

const ANALYZE_TTL_SECONDS = 6 * 60 * 60;
const ANALYZE_STALE_SECONDS = 24 * 60 * 60;
const AI_REQUEST_TIMEOUT_MS = 15_000;
const AI_REFRESH_ERROR_MESSAGE =
  "We could not refresh the AI summary right now. Please try again in a few minutes.";

export class StockAnalyzerAiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "StockAnalyzerAiError";
    this.statusCode = statusCode;
  }
}

const analyzeInsightSchema = z.object({
  headline: z.string().min(1).max(180),
  summary: z.string().min(1).max(900),
  strengths: z.array(z.string().min(1).max(220)).min(1).max(4),
  risks: z.array(z.string().min(1).max(220)).min(1).max(4),
  factorNotes: z
    .array(
      z.object({
        factorId: z.string().min(1).max(40),
        note: z.string().min(1).max(240),
      })
    )
    .max(20),
  suggestion: z.string().min(1).max(420),
  confidence: z.enum(["high", "medium", "low"]),
});

const compareInsightSchema = z.object({
  winner: z.string().min(1).max(30),
  summary: z.string().min(1).max(900),
  whyWinner: z.array(z.string().min(1).max(220)).min(1).max(5),
  firstStrengths: z.array(z.string().min(1).max(220)).min(1).max(4),
  secondStrengths: z.array(z.string().min(1).max(220)).min(1).max(4),
  factorCalls: z
    .array(
      z.object({
        factorId: z.string().min(1).max(40),
        winner: z.string().min(1).max(30),
        note: z.string().min(1).max(240),
      })
    )
    .max(20),
  watchouts: z.array(z.string().min(1).max(220)).min(1).max(4),
  suggestion: z.string().min(1).max(420),
  confidence: z.enum(["high", "medium", "low"]),
});

type AnalyzeAiPayload = {
  mode: "analyze";
  symbol: string;
  companyName: string;
  sourceUpdatedAt: string;
  deterministic: StockAnalyzeAiInsight;
  insight: StockAnalyzeAiInsight;
  generatedAt: string;
};

type CompareAiPayload = {
  mode: "compare";
  firstSymbol: string;
  secondSymbol: string;
  sourceUpdatedAt: [string, string];
  deterministic: StockCompareAiInsight;
  insight: StockCompareAiInsight;
  generatedAt: string;
};

export async function getStockAnalyzeAiInsight({
  symbol,
  model,
}: {
  symbol: string;
  model?: StockAnalyzerAiModel;
}) {
  const stock = await getStockFinancials(symbol);
  if (!stock) throw new Error(`Financial data unavailable for ${symbol}.`);

  const summary = buildAnalyzerSummary(stock.value, null);
  const deterministic = buildDeterministicAnalyzeInsight(summary);
  const cacheKey = [
    "public:stock-analyzer:ai:v3:analyze:auto",
    summary.symbol,
    stock.value.updatedAt,
  ].join(":");

  return getStaleCached<AnalyzeAiPayload>({
    key: cacheKey,
    ttlSeconds: ANALYZE_TTL_SECONDS,
    staleSeconds: ANALYZE_STALE_SECONDS,
    load: async () => ({
      mode: "analyze",
      symbol: summary.symbol,
      companyName: summary.name,
      sourceUpdatedAt: stock.value.updatedAt,
      deterministic,
      insight: await requestAnalyzeInsight(summary, deterministic, model),
      generatedAt: new Date().toISOString(),
    }),
    isUsable: (value) => Boolean(value?.insight?.summary),
  });
}

export async function getStockCompareAiInsight({
  firstSymbol,
  secondSymbol,
  model,
}: {
  firstSymbol: string;
  secondSymbol: string;
  model?: StockAnalyzerAiModel;
}) {
  const [firstStock, secondStock] = await Promise.all([
    getStockFinancials(firstSymbol),
    getStockFinancials(secondSymbol),
  ]);

  if (!firstStock || !secondStock) {
    throw new Error("Comparison data is unavailable for one or both stocks.");
  }

  const first = buildAnalyzerSummary(firstStock.value, null);
  const second = buildAnalyzerSummary(secondStock.value, null);
  const comparison = buildAnalyzerComparison(first, second);
  const deterministic = buildDeterministicCompareInsight(first, second, comparison);
  const cacheKey = [
    "public:stock-analyzer:ai:v3:compare:auto",
    first.symbol,
    firstStock.value.updatedAt,
    second.symbol,
    secondStock.value.updatedAt,
  ].join(":");

  return getStaleCached<CompareAiPayload>({
    key: cacheKey,
    ttlSeconds: ANALYZE_TTL_SECONDS,
    staleSeconds: ANALYZE_STALE_SECONDS,
    load: async () => ({
      mode: "compare",
      firstSymbol: first.symbol,
      secondSymbol: second.symbol,
      sourceUpdatedAt: [firstStock.value.updatedAt, secondStock.value.updatedAt],
      deterministic,
      insight: await requestCompareInsight(first, second, comparison, deterministic, model),
      generatedAt: new Date().toISOString(),
    }),
    isUsable: (value) => Boolean(value?.insight?.summary),
  });
}

async function requestAnalyzeInsight(
  summary: AnalyzerSummary,
  deterministic: StockAnalyzeAiInsight,
  preferredModel?: StockAnalyzerAiModel
) {
  return callZaiJsonWithFallback({
    preferredModel,
    schema: analyzeInsightSchema,
    system:
      "You are MyStockli's grounded stock analyzer for the Pakistan Stock Exchange. Explain only from the provided data. Keep the language simple for everyday investors. Never output markdown.",
    prompt: buildAnalyzePrompt(summary, deterministic),
  });
}

async function requestCompareInsight(
  first: AnalyzerSummary,
  second: AnalyzerSummary,
  comparison: AnalyzerComparison,
  deterministic: StockCompareAiInsight,
  preferredModel?: StockAnalyzerAiModel
) {
  return callZaiJsonWithFallback({
    preferredModel,
    schema: compareInsightSchema,
    system:
      "You are MyStockli's grounded stock comparison assistant for the Pakistan Stock Exchange. Stay inside the supplied facts, compare clearly, and never output markdown.",
    prompt: buildComparePrompt(first, second, comparison, deterministic),
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
    throw new StockAnalyzerAiError(AI_REFRESH_ERROR_MESSAGE, 503);
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
      throw new StockAnalyzerAiError(AI_REFRESH_ERROR_MESSAGE, 504);
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
      throw new StockAnalyzerAiError(AI_REFRESH_ERROR_MESSAGE, 429);
    }
    throw new StockAnalyzerAiError(message, response.status >= 400 ? response.status : 502);
  }

  const content = extractMessageContent(payload);
  const parsed = safeJsonParse(content);
  const normalized = sanitizeInsightPayload(normalizeInsightPayload(parsed));
  const result = schema.safeParse(normalized);
  if (!result.success) {
    throw new StockAnalyzerAiError(
      "GLM returned an incomplete response. Please retry for a cleaner explanation.",
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
        error instanceof StockAnalyzerAiError &&
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        error.statusCode !== 429
      ) {
        continue;
      }
    }
  }

  throw new StockAnalyzerAiError(AI_REFRESH_ERROR_MESSAGE, 503);
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
  throw new Error("Z.AI returned an empty response.");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new StockAnalyzerAiError(
        "GLM did not return valid JSON. Please retry the explanation.",
        502
      );
    }
    return JSON.parse(match[0]);
  }
}

function buildAnalyzePrompt(
  summary: AnalyzerSummary,
  deterministic: StockAnalyzeAiInsight
) {
  return [
    "Return only a valid JSON object.",
    "Required keys: headline, summary, strengths, risks, factorNotes, suggestion, confidence.",
    'Set confidence to only one of: "high", "medium", "low".',
    "For factorNotes, use the factorId values exactly as provided in the factor list.",
    "Use simple, meaningful English for a retail investor in Pakistan.",
    "Do not invent news, future events or hidden assumptions.",
    "Mention both strengths and risks.",
    "Grounded stock data:",
    JSON.stringify(serializeSummary(summary)),
    "Deterministic baseline you may improve:",
    JSON.stringify(deterministic),
  ].join("\n");
}

function buildComparePrompt(
  first: AnalyzerSummary,
  second: AnalyzerSummary,
  comparison: AnalyzerComparison,
  deterministic: StockCompareAiInsight
) {
  return [
    "Return only a valid JSON object.",
    "Required keys: winner, summary, whyWinner, firstStrengths, secondStrengths, factorCalls, watchouts, suggestion, confidence.",
    'Set confidence to only one of: "high", "medium", "low".',
    `Set winner to only one of: "${first.symbol}", "${second.symbol}", or "Balanced".`,
    "For factorCalls, use the factorId values exactly as provided in the factor list.",
    "Use simple, meaningful English for a retail investor in Pakistan.",
    "Do not invent sector stories, news or hidden assumptions.",
    "Keep the explanation grounded in the supplied factor results.",
    "First stock:",
    JSON.stringify(serializeSummary(first)),
    "Second stock:",
    JSON.stringify(serializeSummary(second)),
    "Deterministic head-to-head scorecard:",
    JSON.stringify(serializeComparison(comparison)),
    "Deterministic baseline you may improve:",
    JSON.stringify(deterministic),
  ].join("\n");
}

function normalizeInsightPayload(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;

  const factorNotes = normalizeFactorItems(
    record.factorNotes ?? record.factor_notes ?? record.factorBreakdown ?? record.factor_breakdown
  );
  const factorCalls = normalizeFactorCalls(
    record.factorCalls ?? record.factor_calls ?? record.factorWinners ?? record.factor_winners
  );

  if (
    "winner" in record ||
    "whyWinner" in record ||
    "firstStrengths" in record ||
    "secondStrengths" in record
  ) {
    return {
      winner: coerceString(record.winner) ?? coerceString(record.result) ?? "Balanced",
      summary:
        coerceString(record.summary) ??
        coerceString(record.overview) ??
        coerceString(record.comparison) ??
        "",
      whyWinner: coerceStringArray(
        record.whyWinner ?? record.why_winner ?? record.reasons ?? record.winnerReasons
      ),
      firstStrengths: coerceStringArray(
        record.firstStrengths ?? record.first_strengths ?? record.stockA ?? record.firstPros
      ),
      secondStrengths: coerceStringArray(
        record.secondStrengths ?? record.second_strengths ?? record.stockB ?? record.secondPros
      ),
      factorCalls,
      watchouts: coerceStringArray(
        record.watchouts ?? record.concerns ?? record.risks ?? record.sharedRisks
      ),
      suggestion:
        coerceString(record.suggestion) ??
        coerceString(record.recommendation) ??
        coerceString(record.finalSuggestion) ??
        "",
      confidence: coerceConfidence(record.confidence),
    };
  }

  return {
    headline:
      coerceString(record.headline) ??
      coerceString(record.title) ??
      coerceString(record.label) ??
      "",
    summary:
      coerceString(record.summary) ??
      coerceString(record.overview) ??
      coerceString(record.analysis) ??
      "",
    strengths: coerceStringArray(
      record.strengths ?? record.pros ?? record.positives ?? record.key_strengths
    ),
    risks: coerceStringArray(
      record.risks ?? record.cons ?? record.concerns ?? record.watchouts ?? record.key_risks
    ),
    factorNotes,
    suggestion:
      coerceString(record.suggestion) ??
      coerceString(record.recommendation) ??
      coerceString(record.finalSuggestion) ??
      "",
    confidence: coerceConfidence(record.confidence),
  };
}

function sanitizeInsightPayload(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;

  if (
    "winner" in record ||
    "whyWinner" in record ||
    "firstStrengths" in record ||
    "secondStrengths" in record
  ) {
    return {
      winner: limitText(record.winner, 30),
      summary: limitText(record.summary, 900),
      whyWinner: limitList(record.whyWinner, 5, 220),
      firstStrengths: limitList(record.firstStrengths, 4, 220),
      secondStrengths: limitList(record.secondStrengths, 4, 220),
      factorCalls: limitFactorCalls(record.factorCalls),
      watchouts: limitList(record.watchouts, 4, 220),
      suggestion: limitText(record.suggestion, 420),
      confidence: coerceConfidence(record.confidence),
    };
  }

  return {
    headline: limitText(record.headline, 180),
    summary: limitText(record.summary, 900),
    strengths: limitList(record.strengths, 4, 220),
    risks: limitList(record.risks, 4, 220),
    factorNotes: limitFactorItems(record.factorNotes),
    suggestion: limitText(record.suggestion, 420),
    confidence: coerceConfidence(record.confidence),
  };
}

function serializeSummary(summary: AnalyzerSummary) {
  return {
    symbol: summary.symbol,
    name: summary.name,
    sector: summary.sector,
    score: summary.totalScore,
    verdict: summary.verdict,
    factors_available: summary.factorsAvailable,
    categories: summary.categoryScores.map((category) => ({
      label: category.label,
      score: category.score,
      summary: category.summary,
    })),
    factors: summary.factors.map((factor) => ({
      factor_id: factor.id,
      label: factor.label,
      value: factor.value == null ? null : roundMetric(factor.value),
      display_value: factor.displayValue,
      score: factor.score,
      what_is_good: factor.whatIsGood,
      explanation: factor.explanation,
    })),
    price: summary.quote?.current ?? null,
    pe: summary.pe,
    pbv: summary.pbv,
    roe: summary.roe,
    dividend_yield: summary.dividendYield,
    revenue_trend: shrinkSeries(summary.revenue),
    profit_trend: shrinkSeries(summary.profit),
    eps_trend: shrinkSeries(summary.epsSeries),
    operating_cash_flow_trend: shrinkSeries(summary.cashflowSeries),
  };
}

function serializeComparison(comparison: AnalyzerComparison) {
  return {
    winner: comparison.winnerSymbol,
    first_wins: comparison.firstWins,
    second_wins: comparison.secondWins,
    ties: comparison.ties,
    summary: comparison.summary,
    decisive_factors: comparison.decisiveFactors.map((factor) => ({
      factor_id: factor.id,
      label: factor.label,
      winner: factor.winner,
      note: factor.note,
    })),
    factors: comparison.factors.map((factor) => ({
      factor_id: factor.id,
      label: factor.label,
      first_value: factor.firstDisplay,
      second_value: factor.secondDisplay,
      winner: factor.winner,
      note: factor.note,
    })),
  };
}

function shrinkSeries(series: AnalyzerSummary["revenue"]) {
  return series.slice(-4).map((point) => ({
    period: point.period,
    value: roundMetric(point.value),
  }));
}

function normalizeFactorItems(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const factorId = coerceString(record.factorId ?? record.factor_id ?? record.id);
        const note = coerceString(record.note ?? record.summary ?? record.text);
        if (!factorId || !note) return null;
        return { factorId, note };
      })
      .filter(
        (item): item is { factorId: string; note: string } =>
          Boolean(item?.factorId && item?.note)
      )
      .slice(0, 15);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([factorId, note]) => {
        const text = coerceString(note);
        return text ? { factorId, note: text } : null;
      })
      .filter(
        (item): item is { factorId: string; note: string } =>
          Boolean(item?.factorId && item?.note)
      )
      .slice(0, 15);
  }

  return [];
}

function normalizeFactorCalls(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const factorId = coerceString(record.factorId ?? record.factor_id ?? record.id);
        const winner = coerceString(record.winner ?? record.leader);
        const note = coerceString(record.note ?? record.summary ?? record.text);
        if (!factorId || !winner || !note) return null;
        return { factorId, winner, note };
      })
      .filter(
        (item): item is { factorId: string; winner: string; note: string } =>
          Boolean(item?.factorId && item?.winner && item?.note)
      )
      .slice(0, 15);
  }

  return [];
}

function limitFactorItems(value: unknown) {
  return normalizeFactorItems(value).map((item) => ({
    factorId: limitText(item.factorId, 40),
    note: limitText(item.note, 240),
  }));
}

function limitFactorCalls(value: unknown) {
  return normalizeFactorCalls(value).map((item) => ({
    factorId: limitText(item.factorId, 40),
    winner: limitText(item.winner, 30),
    note: limitText(item.note, 240),
  }));
}

function coerceString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function coerceStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceString(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 5);
  }
  const single = coerceString(value);
  return single ? [single] : [];
}

function coerceConfidence(value: unknown): "high" | "medium" | "low" {
  const text = coerceString(value)?.toLowerCase();
  if (text === "high" || text === "medium" || text === "low") return text;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 75) return "high";
    if (value >= 45) return "medium";
    return "low";
  }
  return "medium";
}

function limitText(value: unknown, max: number) {
  const text = coerceString(value) ?? "";
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function limitList(value: unknown, maxItems: number, maxChars: number) {
  return coerceStringArray(value)
    .slice(0, maxItems)
    .map((item) =>
      item.length <= maxChars
        ? item
        : `${item.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
    );
}

function roundMetric(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}
