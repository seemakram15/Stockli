import "server-only";

import { z } from "zod";
import {
  buildDeterministicPortfolioSuggestionInsight,
  buildDeterministicSectorLeadersInsight,
  type PortfolioSuggestionAiInsight,
} from "@/lib/analysis/sector-portfolio-ai";
import {
  STOCK_ANALYZER_AI_MODELS,
  type StockAnalyzerAiModel,
} from "@/lib/analysis/stock-analyzer-ai";
import {
  buildPortfolioSuggestion,
  buildPortfolioSuggestionCandidatePool,
  buildPortfolioSuggestionFromSelection,
  type PortfolioDuration,
  type PortfolioObjective,
  type PortfolioSuggestionCandidate,
  type SuggestedPortfolio,
} from "@/lib/analysis/portfolio-suggestions";
import { getStaleCached } from "@/lib/cache/stale";
import { config, isZaiConfigured } from "@/lib/config";
import { getPortfolioSuggestion } from "@/lib/services/portfolio-suggestions";
import { getSectorLeadersData } from "@/lib/services/sector-leaders";

const AI_TTL_SECONDS = 6 * 60 * 60;
const AI_STALE_SECONDS = 24 * 60 * 60;
const AI_REQUEST_TIMEOUT_MS = 15_000;
const AI_REFRESH_ERROR_MESSAGE =
  "We could not refresh the AI summary right now. Please try again in a few minutes.";

export class StrategyAiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "StrategyAiError";
    this.statusCode = statusCode;
  }
}

const sectorInsightSchema = z.object({
  headline: z.string().min(1).max(180),
  summary: z.string().min(1).max(900),
  winnerCalls: z.array(z.string().min(1).max(240)).min(1).max(5),
  trends: z.array(z.string().min(1).max(220)).min(1).max(5),
  watchouts: z.array(z.string().min(1).max(220)).min(1).max(4),
  suggestion: z.string().min(1).max(420),
  confidence: z.enum(["high", "medium", "low"]),
});

const portfolioInsightSchema = z.object({
  headline: z.string().min(1).max(180),
  summary: z.string().min(1).max(900),
  portfolioFit: z.array(z.string().min(1).max(220)).min(1).max(5),
  holdingCalls: z
    .array(
      z.object({
        symbol: z.string().min(1).max(20),
        note: z.string().min(1).max(280),
      })
    )
    .min(1)
    .max(8),
  watchouts: z.array(z.string().min(1).max(220)).min(1).max(4),
  suggestion: z.string().min(1).max(420),
  confidence: z.enum(["high", "medium", "low"]),
});

const portfolioSelectionSchema = portfolioInsightSchema.extend({
  selectedSymbols: z.array(z.string().min(1).max(20)).min(1).max(12),
});

export type PortfolioSuggestionAiPortfolioPayload = {
  portfolio: SuggestedPortfolio;
  deterministic: PortfolioSuggestionAiInsight;
  insight: PortfolioSuggestionAiInsight;
  mode: "ai" | "fallback";
  generatedAt: string;
};

export async function getSectorLeadersAiInsight({
  sectorKey,
  model,
}: {
  sectorKey: string;
  model?: StockAnalyzerAiModel;
}) {
  const sectorData = await getSectorLeadersData();
  const leaderboard =
    sectorData.value.leaderboards.find((board) => board.key === sectorKey) ?? null;
  if (!leaderboard) {
    throw new StrategyAiError("Sector leaderboard is unavailable right now.", 404);
  }

  const deterministic = buildDeterministicSectorLeadersInsight(leaderboard);
  return getStaleCached({
    key: `public:sector-leaders:ai:v2:auto:${sectorKey}:${leaderboard.updatedAt}`,
    ttlSeconds: AI_TTL_SECONDS,
    staleSeconds: AI_STALE_SECONDS,
    load: async () => ({
      sectorKey,
      deterministic,
      insight: await callZaiJsonWithFallback({
        preferredModel: model,
        schema: sectorInsightSchema,
        system:
          "You are Stockli's sector-ranking analyst for the Pakistan Stock Exchange. Only use the supplied numbers. Explain in plain English. Never output markdown.",
        prompt: {
          sector: leaderboard.sector,
          ruleName: leaderboard.ruleName,
          averageScore: leaderboard.averageScore,
          stockCount: leaderboard.stockCount,
          categories: leaderboard.categories,
          topStocks: leaderboard.stocks.slice(0, 8).map((stock) => ({
            symbol: stock.symbol,
            name: stock.name,
            score: stock.totalScore,
            analyzerScore: stock.analyzerScore,
            strongestMetrics: stock.strongestMetrics,
            weakestMetrics: stock.weakestMetrics,
            currentPrice: stock.currentPrice,
            changePct: stock.changePct,
            priceReturn1Y: stock.priceReturn1Y,
          })),
          deterministic,
        },
      }),
      generatedAt: new Date().toISOString(),
    }),
    isUsable: (value) => Boolean(value?.insight?.summary),
  });
}

export async function getAiPortfolioSuggestion({
  duration,
  objective,
  holdings,
  model,
  variation = 0,
  currentSymbols = [],
  excludedSymbols = [],
  currentScore = null,
}: {
  duration: PortfolioDuration;
  objective: PortfolioObjective;
  holdings: number;
  model?: StockAnalyzerAiModel;
  variation?: number;
  currentSymbols?: string[];
  excludedSymbols?: string[];
  currentScore?: number | null;
}) {
  const sectorData = await getSectorLeadersData();
  const safeHoldings = Math.min(Math.max(Math.round(holdings), 3), 12);
  const safeSymbols = sanitizeSymbols(currentSymbols);
  const safeExcludedSymbols = sanitizeSymbols(excludedSymbols);
  const deterministicPortfolio =
    safeExcludedSymbols.length > 0
      ? buildPortfolioSuggestionFromSelection({
          dataset: sectorData.value,
          duration,
          objective,
          holdings: safeHoldings,
          selectedSymbols: [],
          avoidSymbols: safeExcludedSymbols,
        })
      : buildPortfolioSuggestion({
          dataset: sectorData.value,
          duration,
          objective,
          holdings: safeHoldings,
        });
  const deterministic = buildDeterministicPortfolioSuggestionInsight(deterministicPortfolio);
  const cacheSuffix = safeSymbols.length ? safeSymbols.join("-") : "base";
  const excludedSuffix = safeExcludedSymbols.length
    ? safeExcludedSymbols.slice(0, 24).join("-")
    : "none";
  const safeVariation = Math.max(0, Math.min(variation, 20));

  return getStaleCached({
    key: `public:portfolio-suggestions:ai-selection:v2:${duration}:${objective}:${safeHoldings}:v${safeVariation}:${cacheSuffix}:${excludedSuffix}:${sectorData.value.updatedAt}`,
    ttlSeconds: AI_TTL_SECONDS,
    staleSeconds: AI_STALE_SECONDS,
    load: async (): Promise<PortfolioSuggestionAiPortfolioPayload> => {
      try {
        const candidates = buildPortfolioSuggestionCandidatePool({
          dataset: sectorData.value,
          duration,
          objective,
          holdings: safeHoldings,
          limit: Math.max(28, safeHoldings * 6),
        });

        const aiPick = await selectAiPortfolio({
          duration,
          objective,
          holdings: safeHoldings,
          candidates,
          model,
          currentSymbols: safeSymbols,
          excludedSymbols: safeExcludedSymbols,
          currentScore,
          deterministic,
          dataset: sectorData.value,
        });

        if (!aiPick) {
          return {
            portfolio: deterministicPortfolio,
            deterministic,
            insight: deterministic,
            mode: "fallback",
            generatedAt: new Date().toISOString(),
          };
        }

        return {
          portfolio: aiPick.portfolio,
          deterministic,
          insight: aiPick.insight,
          mode: "ai",
          generatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          portfolio: deterministicPortfolio,
          deterministic,
          insight: deterministic,
          mode: "fallback",
          generatedAt: new Date().toISOString(),
        };
      }
    },
    isUsable: (value) => Boolean(value?.portfolio?.holdings?.length && value?.insight?.summary),
  });
}

export async function getPortfolioSuggestionAiInsight({
  duration,
  objective,
  holdings,
  model,
}: {
  duration: Parameters<typeof getPortfolioSuggestion>[0]["duration"];
  objective: Parameters<typeof getPortfolioSuggestion>[0]["objective"];
  holdings: number;
  model?: StockAnalyzerAiModel;
}) {
  const portfolio = await getPortfolioSuggestion({ duration, objective, holdings });
  const deterministic = buildDeterministicPortfolioSuggestionInsight(portfolio.value);

  return getStaleCached({
    key: `public:portfolio-suggestions:ai:v5:auto:${duration}:${objective}:${portfolio.value.holdingsRequested}:${portfolio.value.generatedAt}`,
    ttlSeconds: AI_TTL_SECONDS,
    staleSeconds: AI_STALE_SECONDS,
    load: async () => ({
      duration,
      objective,
      holdings: portfolio.value.holdingsRequested,
      deterministic,
      insight: await callZaiJsonWithFallback({
        preferredModel: model,
        schema: portfolioInsightSchema,
        system:
          "You are Stockli's portfolio suggestion analyst for the Pakistan Stock Exchange. Stay grounded in the supplied facts. Use plain language. Prefer durable, fundamentally strong companies. Favor blue-chip anchors plus credible growth names from healthier sectors. Avoid recommending stocks that only look strong because of recent price movement when the multi-year fundamentals are weak. Never output markdown.",
        prompt: {
          duration,
          objective,
          score: portfolio.value.score,
          expectedAnnualReturn: portfolio.value.expectedAnnualReturn,
          expectedRange: portfolio.value.expectedRange,
          sectorsCovered: portfolio.value.sectorsCovered,
          sectorMix: portfolio.value.sectorMix,
          holdings: portfolio.value.holdings.map((holding) => ({
            symbol: holding.symbol,
            name: holding.name,
            sector: holding.sector,
            portfolioRole: holding.portfolioRole,
            weight: holding.weight,
            score: holding.portfolioScore,
            expectedAnnualReturn: holding.expectedAnnualReturn,
            dividendYield: holding.dividendYield,
            reasons: holding.reasons,
          })),
          watchouts: portfolio.value.watchouts,
          deterministic,
        },
      }),
      generatedAt: new Date().toISOString(),
    }),
    isUsable: (value) => Boolean(value?.insight?.summary),
  });
}

async function selectAiPortfolio({
  duration,
  objective,
  holdings,
  candidates,
  model,
  currentSymbols,
  excludedSymbols,
  currentScore,
  deterministic,
  dataset,
}: {
  duration: PortfolioDuration;
  objective: PortfolioObjective;
  holdings: number;
  candidates: PortfolioSuggestionCandidate[];
  model?: StockAnalyzerAiModel;
  currentSymbols: string[];
  excludedSymbols: string[];
  currentScore: number | null;
  deterministic: PortfolioSuggestionAiInsight;
  dataset: Awaited<ReturnType<typeof getSectorLeadersData>>["value"];
}) {
  const excludedSet = new Set(excludedSymbols.map((symbol) => symbol.toUpperCase()));
  const preferredCandidates = candidates.filter(
    (candidate) => !excludedSet.has(candidate.symbol.toUpperCase())
  );
  const candidateInput =
    preferredCandidates.length >= holdings ? preferredCandidates : candidates;
  const attempts = buildPortfolioSelectionAttempts(currentSymbols, currentScore);
  const minimumReplacements = currentSymbols.length
    ? Math.min(holdings, Math.max(2, Math.ceil(holdings / 2)))
    : 0;
  const maxPreferredOverlap = Math.max(0, holdings - minimumReplacements);
  let best:
    | {
        portfolio: SuggestedPortfolio;
        insight: PortfolioSuggestionAiInsight;
        overlap: number;
      }
    | null = null;

  for (const attempt of attempts) {
    const response = await callZaiJsonWithFallback({
      preferredModel: model,
      temperature: currentSymbols.length > 0 ? 0.55 : 0.35,
      schema: portfolioSelectionSchema,
      system:
        "You are Stockli's portfolio construction analyst for the Pakistan Stock Exchange. Choose stocks only from the supplied candidate list. Build a diversified basket with strong fundamentals, stronger sectors, sensible role balance, and plain-language explanations. Never output markdown.",
      prompt: {
        duration,
        objective,
        holdingsWanted: holdings,
        changeRequest: currentSymbols.length > 0,
        currentPortfolio: currentSymbols.length
          ? {
              currentSymbols,
              currentScore,
              minimumReplacements,
              excludedSymbols,
            }
          : null,
        constructionRules: {
          diversifyAcrossSectors:
            holdings <= 4
              ? "Keep this spread across sectors and avoid stacking more than one name in the same sector unless the shortlist is too thin."
              : holdings <= 8
                ? "Keep the basket spread across sectors and avoid putting more than two names in one sector unless the shortlist is thin."
                : "Keep the basket diversified and avoid putting more than three names in one sector unless that is clearly unavoidable.",
          blueChipBias:
            "Mix steadier blue-chip anchors with cleaner growth names instead of chasing fast movers with weak yearly fundamentals.",
          dividendBias:
            objective === "dividend-income"
              ? "Prioritize high dividend names first. Prefer dividend yields around 10% or above when available, and look for payout ratios above 10% but not stretched beyond cash support."
              : "Dividend yield matters only as a supporting signal, not the main driver.",
          growthBias:
            objective === "capital-growth"
              ? "Favor stronger earnings and revenue growth from healthier sectors."
              : "Growth should support the basket, but not overpower quality and safety.",
          changeDirection: attempt.direction,
          carryOverLimit:
            currentSymbols.length > 0
              ? `Keep no more than ${maxPreferredOverlap} stocks from the current basket unless the candidate list is too thin to stay high quality.`
              : "No carry-over limit is needed on the first suggestion.",
          exclusionRule:
            excludedSymbols.length > 0
              ? `Avoid these already-shown symbols unless there is no cleaner high-quality alternative: ${excludedSymbols.join(", ")}.`
              : "No previous symbols are blocked on the first suggestion.",
        },
        candidates: candidateInput.map((candidate) => ({
          symbol: candidate.symbol,
          name: candidate.name,
          sector: candidate.sector,
          role: candidate.portfolioRole,
          compositeScore: candidate.composite,
          analyzerScore: candidate.analyzerScore,
          sectorScore: candidate.totalScore,
          expectedAnnualReturn: candidate.expectedAnnualReturn,
          dividendYield: candidate.dividendYield,
          payoutRatio: candidate.payoutRatio,
          revenueGrowth: candidate.revenueGrowth,
          epsGrowth: candidate.epsGrowth,
          priceReturn1Y: candidate.priceReturn1Y,
          marketCap: candidate.marketCap,
          marketCapScore: candidate.marketCapScore,
          safetyScore: candidate.safetyScore,
          qualityScore: candidate.qualityScore,
          sectorStrength: candidate.sectorStrength,
          strongestMetrics: candidate.strongestMetrics,
          weakestMetrics: candidate.weakestMetrics,
          reasons: candidate.reasons,
        })),
        deterministic,
      },
    }).catch(() => null);

    if (!response) {
      continue;
    }

    const selectedSymbols = limitPortfolioCarryovers(
      response.selectedSymbols,
      currentSymbols,
      maxPreferredOverlap
    );
    const portfolio = buildPortfolioSuggestionFromSelection({
      dataset,
      duration,
      objective,
      holdings,
      selectedSymbols,
      avoidSymbols: excludedSymbols,
    });
    const overlap = countOverlap(
      currentSymbols,
      portfolio.holdings.map((holding) => holding.symbol)
    );
    const candidateResult = {
      portfolio,
      insight: toPortfolioInsight(response),
      overlap,
    };

    if (
      !best ||
      isBetterPortfolioAlternative(
        candidateResult,
        best,
        currentSymbols.length > 0,
        currentScore,
        maxPreferredOverlap
      )
    ) {
      best = candidateResult;
    }

    if (
      currentSymbols.length === 0 ||
      (overlap <= maxPreferredOverlap && portfolio.score >= (currentScore ?? 0))
    ) {
      return candidateResult;
    }
  }

  return best;
}

function buildPortfolioSelectionAttempts(currentSymbols: string[], currentScore: number | null) {
  if (!currentSymbols.length) {
    return [
      {
        direction:
          "Build the strongest first suggestion from this candidate list and keep the basket diversified.",
      },
    ];
  }

  return [
    {
      direction: `Return a materially different basket than ${currentSymbols.join(", ")} and aim to beat the current score of ${currentScore ?? "the current"} out of 100.`,
    },
    {
      direction:
        "If a cleaner higher-scoring mix exists, rotate more aggressively into stronger sectors and stronger income or growth support as required.",
    },
    {
      direction:
        "If a higher score is not realistically available, still return the strongest clearly different basket you can justify from the candidate list.",
    },
  ];
}

function isBetterPortfolioAlternative(
  candidate: {
    portfolio: SuggestedPortfolio;
    insight: PortfolioSuggestionAiInsight;
    overlap: number;
  },
  currentBest: {
    portfolio: SuggestedPortfolio;
    insight: PortfolioSuggestionAiInsight;
    overlap: number;
  },
  changingSuggestion: boolean,
  currentScore: number | null,
  maxPreferredOverlap: number
) {
  if (!changingSuggestion) {
    return candidate.portfolio.score > currentBest.portfolio.score;
  }

  const candidateDifferent = candidate.overlap <= maxPreferredOverlap;
  const currentDifferent = currentBest.overlap <= maxPreferredOverlap;
  if (candidateDifferent !== currentDifferent) {
    return candidateDifferent;
  }
  const candidateImproved = candidate.portfolio.score > (currentScore ?? 0);
  const currentImproved = currentBest.portfolio.score > (currentScore ?? 0);
  if (candidateImproved !== currentImproved) {
    return candidateImproved;
  }
  if (candidate.overlap !== currentBest.overlap) {
    return candidate.overlap < currentBest.overlap;
  }
  if (candidate.portfolio.score !== currentBest.portfolio.score) {
    return candidate.portfolio.score > currentBest.portfolio.score;
  }
  return candidate.portfolio.expectedAnnualReturn > currentBest.portfolio.expectedAnnualReturn;
}

function toPortfolioInsight(payload: z.infer<typeof portfolioSelectionSchema>): PortfolioSuggestionAiInsight {
  return {
    headline: payload.headline,
    summary: payload.summary,
    portfolioFit: payload.portfolioFit,
    holdingCalls: payload.holdingCalls,
    watchouts: payload.watchouts,
    suggestion: payload.suggestion,
    confidence: payload.confidence,
  };
}

function sanitizeSymbols(symbols: string[]) {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))];
}

function limitPortfolioCarryovers(
  selectedSymbols: string[],
  currentSymbols: string[],
  maxPreferredOverlap: number
) {
  if (!currentSymbols.length) {
    return sanitizeSymbols(selectedSymbols);
  }

  const currentSet = new Set(currentSymbols.map((symbol) => symbol.toUpperCase()));
  const uniqueSelected = sanitizeSymbols(selectedSymbols);
  const nextSymbols: string[] = [];
  let carryovers = 0;

  uniqueSelected.forEach((symbol) => {
    if (!currentSet.has(symbol)) {
      nextSymbols.push(symbol);
    }
  });

  uniqueSelected.forEach((symbol) => {
    if (!currentSet.has(symbol)) return;
    if (carryovers >= maxPreferredOverlap) return;
    nextSymbols.push(symbol);
    carryovers += 1;
  });

  return sanitizeSymbols(nextSymbols);
}

function countOverlap(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right.map((symbol) => symbol.toUpperCase()));
  return left.reduce((count, symbol) => count + (rightSet.has(symbol.toUpperCase()) ? 1 : 0), 0);
}

async function callZaiJson<T>({
  model,
  temperature = 0.2,
  schema,
  system,
  prompt,
}: {
  model: StockAnalyzerAiModel;
  temperature?: number;
  schema: z.ZodSchema<T>;
  system: string;
  prompt: unknown;
}) {
  if (!isZaiConfigured) {
    throw new StrategyAiError(AI_REFRESH_ERROR_MESSAGE, 503);
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
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    }),
    signal: controller.signal,
  }).catch((error) => {
    if (error instanceof Error && error.name === "AbortError") {
      throw new StrategyAiError(AI_REFRESH_ERROR_MESSAGE, 504);
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      }
    | null;

  if (!response.ok) {
    const message = payload?.error?.message ?? `Z.AI request failed with status ${response.status}.`;
    throw new StrategyAiError(message, response.status);
  }

  const content = payload?.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((item) => item.text ?? "")
            .join("")
            .trim()
        : "";
  if (!text) {
    throw new StrategyAiError("AI did not return a usable response.", 502);
  }

  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new StrategyAiError("AI returned an invalid response shape.", 502);
  }

  return parsed.data;
}

async function callZaiJsonWithFallback<T>({
  preferredModel,
  temperature,
  schema,
  system,
  prompt,
}: {
  preferredModel?: StockAnalyzerAiModel;
  temperature?: number;
  schema: z.ZodSchema<T>;
  system: string;
  prompt: unknown;
}) {
  const attempts = buildModelAttempts(preferredModel);

  for (const model of attempts) {
    try {
      return await callZaiJson({ model, temperature, schema, system, prompt });
    } catch (error) {
      if (error instanceof StrategyAiError && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        continue;
      }
    }
  }

  throw new StrategyAiError(AI_REFRESH_ERROR_MESSAGE, 503);
}

function buildModelAttempts(preferredModel?: StockAnalyzerAiModel) {
  const attempts = preferredModel
    ? [preferredModel, ...STOCK_ANALYZER_AI_MODELS.filter((model) => model !== preferredModel)]
    : [...STOCK_ANALYZER_AI_MODELS];
  return [...new Set(attempts)];
}
