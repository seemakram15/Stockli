import "server-only";

import { createHash } from "crypto";
import { z } from "zod";
import {
  STOCK_ANALYZER_AI_MODELS,
  type StockAnalyzerAiModel,
} from "@/lib/analysis/stock-analyzer-ai";
import { getStaleCached } from "@/lib/cache/stale";
import { config, isZaiConfigured } from "@/lib/config";
import { normalizeSymbol } from "@/lib/security/validation";
import { getStockOverview } from "@/lib/services/stock-overview";
import { hasWikiMarkup, wikiToPlainText } from "@/lib/text/plain-text";

const AI_TTL_SECONDS = 7 * 24 * 60 * 60;
const AI_STALE_SECONDS = 30 * 24 * 60 * 60;
const AI_REQUEST_TIMEOUT_MS = 20_000;
const AI_REFRESH_ERROR_MESSAGE =
  "We could not refresh the company description right now. Please try again later.";

export class StockProfileDescriptionAiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "StockProfileDescriptionAiError";
    this.statusCode = statusCode;
  }
}

const descriptionSchema = z.object({
  description: z.string().min(40).max(1800),
});

export type StockProfileDescriptionAiPayload = {
  symbol: string;
  companyName: string | null;
  description: string;
  sourceHash: string;
  usedAi: boolean;
  generatedAt: string;
};

export async function getStockProfileDescriptionAi({
  symbol: symbolRaw,
  sourceDescription,
  companyName,
  model,
}: {
  symbol: string;
  sourceDescription?: string | null;
  companyName?: string | null;
  model?: StockAnalyzerAiModel;
}): Promise<{
  value: StockProfileDescriptionAiPayload;
  status: "fresh" | "stale" | "miss" | "skipped";
  storedAt: string;
}> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) {
    throw new StockProfileDescriptionAiError("Invalid symbol", 400);
  }

  let source = (sourceDescription ?? "").trim();
  let name = companyName ?? null;

  if (!source) {
    const overview = await getStockOverview(symbol);
    source = overview?.profile.description?.trim() ?? "";
    name = name || overview?.profile.companyName || null;
  }

  source = wikiToPlainText(source);
  if (!source || source.length < 40) {
    throw new StockProfileDescriptionAiError("No company description available to rewrite.", 404);
  }

  const sourceHash = hashSource(source);
  const deterministic = (): StockProfileDescriptionAiPayload => ({
    symbol,
    companyName: name,
    description: source,
    sourceHash,
    usedAi: false,
    generatedAt: new Date().toISOString(),
  });

  if (!isZaiConfigured) {
    return {
      value: deterministic(),
      status: "skipped",
      storedAt: new Date().toISOString(),
    };
  }

  try {
    const cached = await getStaleCached<StockProfileDescriptionAiPayload>({
      key: `public:stock-profile-description:ai:v2:${symbol}:${sourceHash}`,
      ttlSeconds: AI_TTL_SECONDS,
      staleSeconds: AI_STALE_SECONDS,
      load: async () => {
        const rewritten = await callZaiJsonWithFallback({
          preferredModel: model,
          schema: descriptionSchema,
          system:
            "You are MyStockli's company profile editor for Pakistan Stock Exchange listings. Rewrite the supplied source text into clear investor-friendly prose. Stay factual. Never invent numbers, dates, products, people, or claims that are not grounded in the source. Never output markdown or bullet lists.",
          prompt: buildPrompt({ symbol, companyName: name, source }),
        });

        const description = normalizeDescription(rewritten.description);
        if (!description) {
          throw new StockProfileDescriptionAiError(AI_REFRESH_ERROR_MESSAGE, 502);
        }

        return {
          symbol,
          companyName: name,
          description,
          sourceHash,
          usedAi: true,
          generatedAt: new Date().toISOString(),
        };
      },
      isUsable: (value) =>
        Boolean(value?.description && value.description.length >= 40 && !hasWikiMarkup(value.description)),
    });

    // Prefer AI when present; otherwise keep the cleaned deterministic source.
    if (!cached.value.usedAi || !cached.value.description) {
      return {
        value: deterministic(),
        status: cached.status,
        storedAt: cached.storedAt,
      };
    }

    return cached;
  } catch {
    // Timeout / rate limit / model failure → never leave the client without plaintext.
    return {
      value: deterministic(),
      status: "skipped",
      storedAt: new Date().toISOString(),
    };
  }
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
    throw new StockProfileDescriptionAiError(AI_REFRESH_ERROR_MESSAGE, 503);
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
  })
    .catch((error) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new StockProfileDescriptionAiError(AI_REFRESH_ERROR_MESSAGE, 504);
      }
      throw error;
    })
    .finally(() => {
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
      throw new StockProfileDescriptionAiError(AI_REFRESH_ERROR_MESSAGE, 429);
    }
    throw new StockProfileDescriptionAiError(
      message,
      response.status >= 400 ? response.status : 502
    );
  }

  const content = extractMessageContent(payload);
  const parsed = safeJsonParse(content);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new StockProfileDescriptionAiError(
      "AI returned an incomplete company description. Please retry later.",
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
        error instanceof StockProfileDescriptionAiError &&
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        error.statusCode !== 429
      ) {
        continue;
      }
    }
  }

  throw new StockProfileDescriptionAiError(AI_REFRESH_ERROR_MESSAGE, 503);
}

function buildModelAttempts(preferredModel?: StockAnalyzerAiModel) {
  const attempts = preferredModel
    ? [preferredModel, ...STOCK_ANALYZER_AI_MODELS.filter((model) => model !== preferredModel)]
    : [...STOCK_ANALYZER_AI_MODELS];
  return [...new Set(attempts)];
}

function extractMessageContent(
  payload: {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  } | null
) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }
  throw new StockProfileDescriptionAiError("Z.AI returned an empty response.", 502);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new StockProfileDescriptionAiError(
        "AI did not return valid JSON for the company description.",
        502
      );
    }
    return JSON.parse(match[0]);
  }
}

function buildPrompt({
  symbol,
  companyName,
  source,
}: {
  symbol: string;
  companyName: string | null;
  source: string;
}) {
  return [
    "Return only a valid JSON object with key: description.",
    "Rewrite the source into 1–3 short paragraphs about the company (business, listing/context, operations).",
    "Use plain English. Separate paragraphs with \\n\\n.",
    "Do not invent numbers, financial results, market share, or people not present in the source.",
    "If the source is thin, keep the rewrite short rather than padding.",
    "Company:",
    JSON.stringify({ symbol, companyName, source }),
  ].join("\n");
}

function normalizeDescription(raw: string): string {
  const paragraphs = String(raw)
    .split(/\n\n+/)
    .map((part) => wikiToPlainText(part))
    .filter((part) => part && !hasWikiMarkup(part))
    .slice(0, 3);
  return paragraphs.join("\n\n");
}

function hashSource(source: string) {
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}
