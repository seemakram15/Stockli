import type {
  AnalyzerComparison,
  AnalyzerFactorComparison,
  AnalyzerFactorId,
  AnalyzerSummary,
} from "@/lib/analysis/stock-analyzer";

export const STOCK_ANALYZER_AI_MODELS = ["glm-4.7-flash", "glm-4.5-flash"] as const;

export type StockAnalyzerAiModel = (typeof STOCK_ANALYZER_AI_MODELS)[number];

export type StockAnalyzeAiFactorNote = {
  factorId: AnalyzerFactorId | string;
  note: string;
};

export type StockCompareAiFactorCall = {
  factorId: AnalyzerFactorId | string;
  winner: string;
  note: string;
};

export type StockAnalyzeAiInsight = {
  headline: string;
  summary: string;
  strengths: string[];
  risks: string[];
  factorNotes: StockAnalyzeAiFactorNote[];
  suggestion: string;
  confidence: "high" | "medium" | "low";
};

export type StockCompareAiInsight = {
  winner: string;
  summary: string;
  whyWinner: string[];
  firstStrengths: string[];
  secondStrengths: string[];
  factorCalls: StockCompareAiFactorCall[];
  watchouts: string[];
  suggestion: string;
  confidence: "high" | "medium" | "low";
};

export function buildDeterministicAnalyzeInsight(
  summary: AnalyzerSummary
): StockAnalyzeAiInsight {
  return {
    headline: `${summary.symbol} scores ${summary.totalScore}/100 on MyStockli's factor checklist`,
    summary: `${summary.name} has a ${summary.verdictTone} snapshot right now. ${summary.verdict} ${summary.factorsAvailable}/${summary.factors.length} factors were available in the cached fundamentals.`,
    strengths: summary.strongestFactors.length
      ? summary.strongestFactors.map(
          (factor) => `${factor.label}: ${factor.displayValue}. ${trimSentence(factor.explanation)}`
        )
      : ["The available data is still limited, so the model is leaning on basic fundamentals only."],
    risks: summary.weakestFactors.length
      ? summary.weakestFactors.map(
          (factor) => `${factor.label}: ${factor.displayValue}. ${trimSentence(factor.explanation)}`
        )
      : ["No clear weak factor is standing out yet because the data is incomplete."],
    factorNotes: summary.factors.map((factor) => ({
      factorId: factor.id,
      note: factor.explanation,
    })),
    suggestion:
      summary.totalScore >= 75
        ? "The stock looks fundamentally solid, but you should still confirm valuation, sector cycle and recent company notices before acting."
        : summary.totalScore >= 60
          ? "The stock has a workable base. Focus next on the weaker factors before making a final decision."
          : summary.totalScore >= 45
            ? "This is a mixed case. Treat it as a deeper research candidate rather than an easy yes."
            : "The current snapshot is weak. It needs stronger proof on profits, cash flow or balance sheet before it looks comfortable.",
    confidence: summary.factorsAvailable >= 13 ? "high" : summary.factorsAvailable >= 10 ? "medium" : "low",
  };
}

export function buildDeterministicCompareInsight(
  first: AnalyzerSummary,
  second: AnalyzerSummary,
  comparison: AnalyzerComparison
): StockCompareAiInsight {
  const firstLeading = comparison.factors
    .filter((factor) => factor.winner === "first")
    .slice(0, 4)
    .map((factor) => `${factor.label}: ${factor.firstDisplay} vs ${factor.secondDisplay}.`);
  const secondLeading = comparison.factors
    .filter((factor) => factor.winner === "second")
    .slice(0, 4)
    .map((factor) => `${factor.label}: ${factor.secondDisplay} vs ${factor.firstDisplay}.`);

  return {
    winner:
      comparison.winnerSymbol === "Balanced" ? "Balanced" : comparison.winnerSymbol,
    summary: comparison.summary,
    whyWinner:
      comparison.decisiveFactors.length > 0
        ? comparison.decisiveFactors.map((factor) => factor.note)
        : ["The main factors are too close to call, so the matchup stays balanced for now."],
    firstStrengths:
      firstLeading.length > 0
        ? firstLeading
        : [`${first.symbol} does not have a clear edge on the currently available factor set.`],
    secondStrengths:
      secondLeading.length > 0
        ? secondLeading
        : [`${second.symbol} does not have a clear edge on the currently available factor set.`],
    factorCalls: comparison.factors.map((factor) => buildFactorCall(factor, first.symbol, second.symbol)),
    watchouts: collectWatchouts(first, second),
    suggestion:
      comparison.winnerSymbol === "Balanced"
        ? "Both stocks are close enough that your time horizon, risk comfort and sector view should break the tie."
        : `${comparison.winnerSymbol} leads on the scorecard today, but you should still review the losing stock's strongest factors before making a final call.`,
    confidence:
      Math.min(first.factorsAvailable, second.factorsAvailable) >= 13
        ? "high"
        : Math.min(first.factorsAvailable, second.factorsAvailable) >= 10
          ? "medium"
          : "low",
  };
}

function buildFactorCall(
  factor: AnalyzerFactorComparison,
  firstSymbol: string,
  secondSymbol: string
): StockCompareAiFactorCall {
  if (factor.winner === "first") {
    return {
      factorId: factor.id,
      winner: firstSymbol,
      note: factor.note,
    };
  }

  if (factor.winner === "second") {
    return {
      factorId: factor.id,
      winner: secondSymbol,
      note: factor.note,
    };
  }

  return {
    factorId: factor.id,
    winner: "Tie",
    note: factor.note,
  };
}

function collectWatchouts(first: AnalyzerSummary, second: AnalyzerSummary) {
  const watchouts = [
    first.weakestFactors[0],
    first.weakestFactors[1],
    second.weakestFactors[0],
    second.weakestFactors[1],
  ]
    .filter((factor): factor is AnalyzerSummary["factors"][number] => Boolean(factor))
    .slice(0, 4)
    .map((factor) => `${factor.label}: ${factor.displayValue}. ${trimSentence(factor.explanation)}`);

  return watchouts.length
    ? watchouts
    : ["The weak spots are limited by incomplete data, so keep an eye on the next reporting cycle."];
}

function trimSentence(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
