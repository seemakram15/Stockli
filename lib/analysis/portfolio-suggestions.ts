import {
  getMetricScoreByLabel,
  type SectorLeadersDataset,
  type SectorLeaderStock,
} from "@/lib/analysis/sector-ranking";

export const PORTFOLIO_DURATIONS = ["short-term", "long-term"] as const;
export const PORTFOLIO_OBJECTIVES = [
  "dividend-income",
  "capital-growth",
  "income-and-growth",
] as const;

export type PortfolioDuration = (typeof PORTFOLIO_DURATIONS)[number];
export type PortfolioObjective = (typeof PORTFOLIO_OBJECTIVES)[number];

export type SuggestedPortfolioHolding = {
  rank: number;
  symbol: string;
  name: string;
  sector: string;
  portfolioRole: PortfolioRole;
  weight: number;
  portfolioScore: number;
  sectorScore: number;
  analyzerScore: number;
  expectedAnnualReturn: number;
  dividendYield: number | null;
  payoutRatio: number | null;
  currentPrice: number | null;
  reasons: string[];
  highlights: Array<{ label: string; value: string }>;
};

export type SuggestedPortfolio = {
  generatedAt: string;
  duration: PortfolioDuration;
  objective: PortfolioObjective;
  holdingsRequested: number;
  score: number;
  expectedAnnualReturn: number;
  expectedRange: {
    low: number;
    base: number;
    high: number;
  };
  expectedDividendYield: number | null;
  sectorsCovered: number;
  holdings: SuggestedPortfolioHolding[];
  sectorMix: Array<{
    sector: string;
    holdings: number;
    weight: number;
  }>;
  scoreBreakdown: Array<{
    label: string;
    score: number;
  }>;
  summary: string;
  watchouts: string[];
};

export type PortfolioRole = "Blue-chip anchor" | "Growth leader" | "Quality compounder";

export type PortfolioSuggestionCandidate = {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number | null;
  marketCap: number | null;
  totalScore: number;
  analyzerScore: number;
  qualityScore: number;
  cashScore: number;
  balanceScore: number;
  valuationScore: number;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  priceReturn1Y: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  metricsAvailable: number;
  strongestMetrics: string[];
  weakestMetrics: string[];
  portfolioRole: PortfolioRole;
  composite: number;
  expectedAnnualReturn: number;
  objectiveFit: number;
  durationFit: number;
  growthScore: number;
  dividendScore: number;
  valueScore: number;
  safetyScore: number;
  franchiseScore: number;
  marketCapScore: number;
  sectorStrength: number;
  reasons: string[];
};

type SectorProfile = {
  sector: string;
  stockCount: number;
  breadthScore: number;
  scaleScore: number;
  topTierScore: number;
  sectorStrength: number;
};

type Candidate = {
  stock: SectorLeaderStock;
  sectorProfile: SectorProfile;
  marketCapScore: number;
  franchiseScore: number;
  objectiveFit: number;
  durationFit: number;
  growthScore: number;
  dividendScore: number;
  valueScore: number;
  safetyScore: number;
  qualityScore: number;
  portfolioRole: PortfolioRole;
  composite: number;
  expectedAnnualReturn: number;
};

export function buildPortfolioSuggestion({
  dataset,
  duration,
  objective,
  holdings,
}: {
  dataset: SectorLeadersDataset;
  duration: PortfolioDuration;
  objective: PortfolioObjective;
  holdings: number;
}): SuggestedPortfolio {
  const targetHoldings = clamp(Math.round(holdings), 3, 12);
  const candidates = buildSortedCandidatePool(dataset, duration, objective, targetHoldings);
  const maxPerSector = targetHoldings <= 4 ? 1 : targetHoldings <= 8 ? 2 : 3;
  const selectedCandidates = pickDiversifiedCandidates(candidates, targetHoldings, maxPerSector);
  return buildPortfolioFromCandidates(selectedCandidates, {
    duration,
    objective,
    targetHoldings,
  });
}

export function buildPortfolioSuggestionCandidatePool({
  dataset,
  duration,
  objective,
  holdings,
  limit,
}: {
  dataset: SectorLeadersDataset;
  duration: PortfolioDuration;
  objective: PortfolioObjective;
  holdings: number;
  limit?: number;
}): PortfolioSuggestionCandidate[] {
  const targetHoldings = clamp(Math.round(holdings), 3, 12);
  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(targetHoldings, Math.round(limit))
      : null;
  const candidates = buildSortedCandidatePool(dataset, duration, objective, targetHoldings);
  const sliced = safeLimit == null ? candidates : candidates.slice(0, safeLimit);

  return sliced.map((candidate) => ({
    symbol: candidate.stock.symbol,
    name: candidate.stock.name,
    sector: candidate.stock.sector,
    currentPrice: candidate.stock.currentPrice,
    marketCap: candidate.stock.marketCap,
    totalScore: candidate.stock.totalScore,
    analyzerScore: candidate.stock.analyzerScore,
    qualityScore: candidate.stock.qualityScore,
    cashScore: candidate.stock.cashScore,
    balanceScore: candidate.stock.balanceScore,
    valuationScore: candidate.stock.valuationScore,
    revenueGrowth: candidate.stock.revenueGrowth,
    epsGrowth: candidate.stock.epsGrowth,
    priceReturn1Y: candidate.stock.priceReturn1Y,
    dividendYield: candidate.stock.dividendYield,
    payoutRatio: candidate.stock.payoutRatio,
    metricsAvailable: candidate.stock.metricsAvailable,
    strongestMetrics: candidate.stock.strongestMetrics,
    weakestMetrics: candidate.stock.weakestMetrics,
    portfolioRole: candidate.portfolioRole,
    composite: round0(candidate.composite),
    expectedAnnualReturn: candidate.expectedAnnualReturn,
    objectiveFit: candidate.objectiveFit,
    durationFit: candidate.durationFit,
    growthScore: candidate.growthScore,
    dividendScore: candidate.dividendScore,
    valueScore: candidate.valueScore,
    safetyScore: candidate.safetyScore,
    franchiseScore: candidate.franchiseScore,
    marketCapScore: candidate.marketCapScore,
    sectorStrength: candidate.sectorProfile.sectorStrength,
    reasons: buildHoldingReasons(candidate),
  }));
}

export function buildPortfolioSuggestionFromSelection({
  dataset,
  duration,
  objective,
  holdings,
  selectedSymbols,
  avoidSymbols = [],
}: {
  dataset: SectorLeadersDataset;
  duration: PortfolioDuration;
  objective: PortfolioObjective;
  holdings: number;
  selectedSymbols: string[];
  avoidSymbols?: string[];
}): SuggestedPortfolio {
  const targetHoldings = clamp(Math.round(holdings), 3, 12);
  const candidates = buildSortedCandidatePool(dataset, duration, objective, targetHoldings);
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.stock.symbol.toUpperCase(), candidate] as const)
  );
  const avoidSet = new Set(avoidSymbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  const maxPerSector = targetHoldings <= 4 ? 1 : targetHoldings <= 8 ? 2 : 3;
  const selected: Candidate[] = [];
  const sectorCounts = new Map<string, number>();

  selectedSymbols.forEach((symbol) => {
    if (selected.length >= targetHoldings) return;
    const candidate = candidateMap.get(symbol.trim().toUpperCase());
    if (!candidate) return;
    tryAddCandidate(selected, sectorCounts, candidate, maxPerSector);
  });

  const preferredCandidates = candidates.filter(
    (candidate) => !avoidSet.has(candidate.stock.symbol.toUpperCase())
  );
  const avoidedCandidates = candidates.filter((candidate) =>
    avoidSet.has(candidate.stock.symbol.toUpperCase())
  );

  addCandidatesFromGroup(
    selected,
    sectorCounts,
    preferredCandidates,
    Math.max(0, targetHoldings - selected.length),
    maxPerSector
  );
  if (selected.length < targetHoldings) {
    addCandidatesFromGroup(
      selected,
      sectorCounts,
      preferredCandidates,
      Math.max(0, targetHoldings - selected.length),
      targetHoldings
    );
  }
  if (selected.length < targetHoldings) {
    addCandidatesFromGroup(
      selected,
      sectorCounts,
      avoidedCandidates,
      Math.max(0, targetHoldings - selected.length),
      targetHoldings
    );
  }

  return buildPortfolioFromCandidates(selected.slice(0, targetHoldings), {
    duration,
    objective,
    targetHoldings,
  });
}

function buildPortfolioFromCandidates(
  selectedCandidates: Candidate[],
  {
    duration,
    objective,
    targetHoldings,
  }: {
    duration: PortfolioDuration;
    objective: PortfolioObjective;
    targetHoldings: number;
  }
) {
  const weights = buildWeights(selectedCandidates);
  const holdingsList = selectedCandidates.map((candidate, index) =>
    buildHolding(candidate, weights[index] ?? 0, index + 1)
  );
  const sectorMix = summarizeSectorMix(holdingsList);
  const expectedAnnualReturn = round1(
    holdingsList.reduce((sum, holding) => sum + holding.expectedAnnualReturn * (holding.weight / 100), 0)
  );
  const expectedDividendYield = averageNullable(holdingsList.map((holding) => holding.dividendYield));
  const coreScore = round0(
    average(
      selectedCandidates.map((candidate) => candidate.composite)
    )
  );
  const diversificationBonus = Math.min(8, sectorMix.length * 1.3);
  const concentrationPenalty = Math.max(
    0,
    ...(sectorMix.map((sector) => Math.max(0, sector.weight - 35) * 0.5))
  );
  const score = clamp(
    round0(coreScore * 0.9 + diversificationBonus - concentrationPenalty),
    0,
    97
  );
  const scoreBreakdown = [
    {
      label: "Business quality",
      score: round0(average(selectedCandidates.map((candidate) => candidate.qualityScore))),
    },
    {
      label: "Sector backdrop",
      score: round0(average(selectedCandidates.map((candidate) => candidate.sectorProfile.sectorStrength))),
    },
    {
      label: "Balance-sheet safety",
      score: round0(average(selectedCandidates.map((candidate) => candidate.safetyScore))),
    },
    {
      label:
        objective === "dividend-income"
          ? "Income fit"
          : objective === "capital-growth"
            ? "Growth fit"
            : "Balanced fit",
      score: round0(average(selectedCandidates.map((candidate) => candidate.objectiveFit))),
    },
  ];
  const watchouts = buildPortfolioWatchouts(holdingsList, duration, objective);
  const summary = buildPortfolioSummary(holdingsList, duration, objective, score, expectedAnnualReturn);

  return {
    generatedAt: new Date().toISOString(),
    duration,
    objective,
    holdingsRequested: targetHoldings,
    score,
    expectedAnnualReturn,
    expectedRange: {
      low: Math.max(0, round1(expectedAnnualReturn - 4)),
      base: expectedAnnualReturn,
      high: round1(expectedAnnualReturn + 4),
    },
    expectedDividendYield,
    sectorsCovered: sectorMix.length,
    holdings: holdingsList,
    sectorMix,
    scoreBreakdown,
    summary,
    watchouts,
  };
}

function buildSortedCandidatePool(
  dataset: SectorLeadersDataset,
  duration: PortfolioDuration,
  objective: PortfolioObjective,
  holdings: number
) {
  const universe = dataset.leaderboards.flatMap((board) => board.stocks);
  const marketCapScoreMap = buildMarketCapScoreMap(universe);
  const sectorProfileMap = buildSectorProfileMap(dataset, marketCapScoreMap);
  const allCandidates = universe
    .map((stock) =>
      buildCandidate(
        stock,
        duration,
        objective,
        sectorProfileMap.get(stock.symbol),
        marketCapScoreMap.get(stock.symbol) ?? 35
      )
    )
    .filter((candidate): candidate is Candidate => Boolean(candidate));
  const candidatePool = pickCandidatePool(allCandidates, holdings);

  return [...candidatePool].sort((left, right) => {
    if (right.composite !== left.composite) return right.composite - left.composite;
    if (right.franchiseScore !== left.franchiseScore) {
      return right.franchiseScore - left.franchiseScore;
    }
    return right.stock.totalScore - left.stock.totalScore;
  });
}

function buildCandidate(
  stock: SectorLeaderStock,
  duration: PortfolioDuration,
  objective: PortfolioObjective,
  sectorProfile: SectorProfile | undefined,
  marketCapScore: number
): Candidate | null {
  if (!sectorProfile) return null;

  const growthScore = scoreGrowth(stock);
  const dividendScore = scoreDividend(stock);
  const valueScore = scoreValue(stock);
  const safetyScore = round0((stock.balanceScore + stock.cashScore) / 2);
  const qualityScore = round0((stock.qualityScore + stock.analyzerScore + stock.totalScore) / 3);
  const franchiseScore = round0(
    marketCapScore * 0.42 + qualityScore * 0.32 + safetyScore * 0.14 + sectorProfile.sectorStrength * 0.12
  );

  const objectiveFit =
    objective === "dividend-income"
      ? qualityScore * 0.18 + dividendScore * 0.34 + safetyScore * 0.24 + valueScore * 0.12 + franchiseScore * 0.12
      : objective === "capital-growth"
        ? qualityScore * 0.24 + growthScore * 0.3 + valueScore * 0.16 + safetyScore * 0.12 + sectorProfile.sectorStrength * 0.18
        : qualityScore * 0.24 + growthScore * 0.18 + dividendScore * 0.18 + valueScore * 0.14 + safetyScore * 0.12 + franchiseScore * 0.14;

  const durationFit =
    duration === "long-term"
      ? qualityScore * 0.28 + safetyScore * 0.24 + dividendScore * 0.14 + growthScore * 0.14 + valueScore * 0.08 + sectorProfile.sectorStrength * 0.12
      : qualityScore * 0.16 + growthScore * 0.28 + valueScore * 0.18 + safetyScore * 0.12 + dividendScore * 0.1 + sectorProfile.sectorStrength * 0.16;

  const fundamentalPenalty = computeFundamentalPenalty({
    stock,
    growthScore,
    qualityScore,
    safetyScore,
    sectorProfile,
    marketCapScore,
  });

  const rawComposite =
    stock.totalScore * 0.2 +
    stock.analyzerScore * 0.2 +
    objectiveFit * 0.2 +
    durationFit * 0.16 +
    sectorProfile.sectorStrength * 0.12 +
    franchiseScore * 0.12;
  const composite = round1(clamp(rawComposite - fundamentalPenalty, 0, 100));
  const portfolioRole = classifyPortfolioRole({
    growthScore,
    marketCapScore,
    franchiseScore,
    qualityScore,
    sectorProfile,
  });

  const expectedAnnualReturn = projectExpectedReturn(
    stock,
    duration,
    objective,
    growthScore,
    dividendScore,
    valueScore,
    safetyScore,
    qualityScore,
    sectorProfile.sectorStrength
  );

  return {
    stock,
    sectorProfile,
    marketCapScore,
    franchiseScore,
    objectiveFit: round0(objectiveFit),
    durationFit: round0(durationFit),
    growthScore,
    dividendScore,
    valueScore,
    safetyScore,
    qualityScore,
    portfolioRole,
    composite,
    expectedAnnualReturn,
  };
}

function pickCandidatePool(candidates: Candidate[], holdings: number) {
  const preferred = candidates.filter(passesPreferredGate);
  if (preferred.length >= holdings) return preferred;

  const relaxed = candidates.filter(passesRelaxedGate);
  if (relaxed.length >= holdings) return relaxed;

  return candidates;
}

function passesPreferredGate(candidate: Candidate) {
  const averageGrowth = averageNullable([candidate.stock.revenueGrowth, candidate.stock.epsGrowth]);

  if (candidate.stock.metricsAvailable < 7) return false;
  if (candidate.stock.totalScore < 50) return false;
  if (candidate.stock.analyzerScore < 68) return false;
  if (candidate.qualityScore < 62) return false;
  if (candidate.safetyScore < 55) return false;
  if (candidate.sectorProfile.stockCount < 3 && !(candidate.marketCapScore >= 82 && candidate.franchiseScore >= 75)) {
    return false;
  }
  if (candidate.sectorProfile.sectorStrength < 58 && candidate.marketCapScore < 85) return false;
  if (averageGrowth != null && averageGrowth < -3 && candidate.dividendScore < 72) return false;
  if ((candidate.stock.priceReturn1Y ?? 0) > 55 && candidate.qualityScore < 70) return false;
  return true;
}

function passesRelaxedGate(candidate: Candidate) {
  if (candidate.stock.metricsAvailable < 5) return false;
  if (candidate.stock.totalScore < 45) return false;
  if (candidate.stock.analyzerScore < 60) return false;
  if (candidate.qualityScore < 56) return false;
  if (candidate.safetyScore < 48) return false;
  if (candidate.sectorProfile.stockCount < 2 && candidate.marketCapScore < 78) return false;
  return true;
}

function pickDiversifiedCandidates(
  candidates: Candidate[],
  holdings: number,
  maxPerSector: number
) {
  const selected: Candidate[] = [];
  const sectorCounts = new Map<string, number>();
  const anchors = candidates
    .filter((candidate) => candidate.portfolioRole === "Blue-chip anchor")
    .sort((left, right) => right.franchiseScore - left.franchiseScore || right.composite - left.composite);
  const growers = candidates
    .filter((candidate) => candidate.portfolioRole === "Growth leader")
    .sort((left, right) => right.growthScore - left.growthScore || right.composite - left.composite);
  const compounders = candidates
    .filter((candidate) => candidate.portfolioRole === "Quality compounder")
    .sort((left, right) => right.composite - left.composite);

  const anchorTarget = holdings <= 4 ? 2 : holdings <= 6 ? 3 : 4;
  const growthTarget = holdings <= 4 ? 1 : holdings <= 6 ? 2 : holdings <= 8 ? 3 : 4;

  addCandidatesFromGroup(selected, sectorCounts, anchors, anchorTarget, 1);
  addCandidatesFromGroup(selected, sectorCounts, growers, growthTarget, 1);
  addCandidatesFromGroup(selected, sectorCounts, compounders, Math.max(0, holdings - selected.length), 1);
  addCandidatesFromGroup(selected, sectorCounts, anchors, Math.max(0, holdings - selected.length), maxPerSector);
  addCandidatesFromGroup(selected, sectorCounts, growers, Math.max(0, holdings - selected.length), maxPerSector);
  addCandidatesFromGroup(selected, sectorCounts, candidates, Math.max(0, holdings - selected.length), maxPerSector);

  return selected;
}

function buildWeights(candidates: Candidate[]) {
  const raw = candidates.map((candidate) => {
    const roleLift =
      candidate.portfolioRole === "Blue-chip anchor"
        ? 1.04
        : candidate.portfolioRole === "Growth leader"
          ? 1.03
          : 1;
    return Math.max(candidate.composite * roleLift, 1);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (!total) return candidates.map(() => 0);

  const weights = raw.map((value) => round1((value / total) * 100));
  const delta = round1(100 - weights.reduce((sum, value) => sum + value, 0));
  if (weights.length) {
    weights[weights.length - 1] = round1((weights[weights.length - 1] ?? 0) + delta);
  }
  return weights;
}

function buildHolding(candidate: Candidate, weight: number, rank: number): SuggestedPortfolioHolding {
  const stock = candidate.stock;
  return {
    rank,
    symbol: stock.symbol,
    name: stock.name,
    sector: stock.sector,
    portfolioRole: candidate.portfolioRole,
    weight,
    portfolioScore: round0(candidate.composite),
    sectorScore: stock.totalScore,
    analyzerScore: stock.analyzerScore,
    expectedAnnualReturn: candidate.expectedAnnualReturn,
    dividendYield: stock.dividendYield,
    payoutRatio: stock.payoutRatio,
    currentPrice: stock.currentPrice,
    reasons: buildHoldingReasons(candidate),
    highlights: [
      { label: "Sector score", value: `${stock.totalScore}/100` },
      { label: "Analyzer score", value: `${stock.analyzerScore}/100` },
      {
        label: "Dividend yield",
        value: stock.dividendYield == null ? "—" : `${formatPct(stock.dividendYield)}%`,
      },
      { label: "Expected annual return", value: `${formatPct(candidate.expectedAnnualReturn)}%` },
    ],
  };
}

function buildHoldingReasons(candidate: Candidate) {
  const stock = candidate.stock;
  const reasons = [
    `${stock.symbol} is clearing ${stock.totalScore}/100 on the sector scorecard and ${stock.analyzerScore}/100 on the broader analyzer, so the case is coming from more than price action alone.`,
  ];

  const strongest = stock.strongestMetrics.slice(0, 2);
  if (strongest.length) {
    reasons.push(`Its cleanest edges right now are ${strongest.join(" and ")}.`);
  }

  if (candidate.portfolioRole === "Blue-chip anchor") {
    reasons.push(
      `This is one of the larger, steadier names in the shortlist, which helps anchor the basket with stronger franchise scale and more reliable sector depth.`
    );
  } else if (candidate.portfolioRole === "Growth leader") {
    reasons.push(
      `This is one of the growth slots in the basket because earnings momentum still looks healthy while the fundamentals remain supportive.`
    );
  } else {
    reasons.push(
      `This name adds quality balance because cash flow, margins and valuation are contributing together without leaning too hard on one hot metric.`
    );
  }

  if (candidate.sectorProfile.stockCount >= 5 && candidate.sectorProfile.sectorStrength >= 65) {
    reasons.push(
      `${stock.sector} is also coming through as a healthier backdrop with multiple investable names ready, so this idea is not relying on a one-company story.`
    );
  }

  if (candidate.dividendScore >= candidate.growthScore + 10) {
    reasons.push(
      `This name fits the income side well because yield, payout quality and cash cover are stronger than average.`
    );
  } else if (candidate.growthScore >= candidate.dividendScore + 10) {
    reasons.push(
      `This pick leans more toward capital growth because earnings and revenue trends are doing more of the heavy lifting.`
    );
  }

  return reasons.slice(0, 4);
}

function summarizeSectorMix(holdings: SuggestedPortfolioHolding[]) {
  const map = new Map<string, { holdings: number; weight: number }>();
  holdings.forEach((holding) => {
    const current = map.get(holding.sector) ?? { holdings: 0, weight: 0 };
    current.holdings += 1;
    current.weight += holding.weight;
    map.set(holding.sector, current);
  });

  return [...map.entries()]
    .map(([sector, value]) => ({
      sector,
      holdings: value.holdings,
      weight: round1(value.weight),
    }))
    .sort((left, right) => right.weight - left.weight);
}

function buildPortfolioSummary(
  holdings: SuggestedPortfolioHolding[],
  duration: PortfolioDuration,
  objective: PortfolioObjective,
  score: number,
  expectedAnnualReturn: number
) {
  const leaders = holdings.slice(0, 3).map((holding) => holding.symbol).join(", ");
  const anchorCount = holdings.filter((holding) => holding.portfolioRole === "Blue-chip anchor").length;
  const growthCount = holdings.filter((holding) => holding.portfolioRole === "Growth leader").length;
  const durationLabel = duration === "long-term" ? "longer holding period" : "shorter holding period";
  const objectiveLabel =
    objective === "dividend-income"
      ? "income-focused"
      : objective === "capital-growth"
        ? "capital-growth"
        : "balanced income-and-growth";

  return `This ${objectiveLabel} portfolio is built for a ${durationLabel}. The basket mixes ${anchorCount} blue-chip anchor${anchorCount === 1 ? "" : "s"} with ${growthCount} growth leader${growthCount === 1 ? "" : "s"}, scores ${score}/100 overall, and the current historical projection points to about ${formatPct(expectedAnnualReturn)}% a year. The top anchors are ${leaders}.`;
}

function buildPortfolioWatchouts(
  holdings: SuggestedPortfolioHolding[],
  duration: PortfolioDuration,
  objective: PortfolioObjective
) {
  const watchouts: string[] = [];

  const lowestScore = [...holdings].sort((left, right) => left.portfolioScore - right.portfolioScore)[0];
  if (lowestScore) {
    watchouts.push(
      `${lowestScore.symbol} is the weakest name in this basket on the current scorecard, so review its softer metrics before buying the full mix.`
    );
  }

  if (objective === "dividend-income") {
    watchouts.push(
      `Income portfolios still need payout safety checks because a high yield without cash support can fade quickly.`
    );
  } else if (objective === "capital-growth") {
    watchouts.push(
      `Growth-led portfolios need patience because earnings momentum can look uneven from quarter to quarter.`
    );
  } else {
    watchouts.push(
      `Balanced portfolios trade some upside for stability, so the return path may feel steadier but less explosive.`
    );
  }

  watchouts.push(
    duration === "long-term"
      ? `For a longer-term plan, refresh this basket after each major result season so the holdings stay aligned with the strongest fundamentals.`
      : `For a shorter-term plan, recheck price and earnings momentum more often because leadership can rotate faster.`
  );

  const topSector = summarizeSectorMix(holdings)[0];
  if (topSector && topSector.weight > 30) {
    watchouts.push(
      `${topSector.sector} is carrying the biggest weight in this mix, so keep watching that sector's result season and policy headlines.`
    );
  }

  return watchouts;
}

function projectExpectedReturn(
  stock: SectorLeaderStock,
  duration: PortfolioDuration,
  objective: PortfolioObjective,
  growthScore: number,
  dividendScore: number,
  valueScore: number,
  safetyScore: number,
  qualityScore: number,
  sectorStrength: number
) {
  const growthBase = averageNullable([stock.revenueGrowth, stock.epsGrowth]) ?? 0;
  const clampedGrowth = clamp(growthBase, -6, 22);
  const valuationLift = (valueScore - 50) * 0.018;
  const safetyLift = (safetyScore - 50) * 0.018;
  const qualityLift = (qualityScore - 50) * 0.02;
  const sectorLift = (sectorStrength - 50) * 0.014;
  const incomeLift =
    objective === "dividend-income"
      ? (stock.dividendYield ?? 0) * 0.32
      : objective === "income-and-growth"
        ? (stock.dividendYield ?? 0) * 0.22
        : (stock.dividendYield ?? 0) * 0.08;
  const durationLift = duration === "long-term" ? 0.75 : 0.25;
  const growthWeight = duration === "long-term" ? 0.16 : 0.14;
  const base =
    4.4 +
    clampedGrowth * growthWeight +
    (growthScore / 100) * 1.35 +
    (dividendScore / 100) * 0.45 +
    incomeLift +
    valuationLift +
    safetyLift +
    qualityLift +
    sectorLift +
    durationLift;

  return round1(clamp(base, 4, 15.5));
}

function scoreGrowth(stock: SectorLeaderStock) {
  const raw = averageNullable([stock.revenueGrowth, stock.epsGrowth]);
  if (raw == null) return round0((stock.totalScore + stock.analyzerScore) / 2);
  if (raw <= -10) return 5;
  if (raw <= 0) return 30;
  if (raw <= 5) return 45;
  if (raw <= 10) return 60;
  if (raw <= 18) return 78;
  if (raw <= 25) return 90;
  return 100;
}

function scoreDividend(stock: SectorLeaderStock) {
  const sectorDividend = getMetricScoreByLabel(stock, "Dividend Score");
  if (sectorDividend != null) return sectorDividend;

  const yieldValue = stock.dividendYield ?? 0;
  if (yieldValue <= 0) return 10;
  if (yieldValue <= 1) return 35;
  if (yieldValue <= 3) return 55;
  if (yieldValue <= 5) return 78;
  if (yieldValue <= 8) return 90;
  return 100;
}

function scoreValue(stock: SectorLeaderStock) {
  const earningsYield = getMetricScoreByLabel(stock, "Earnings Yield");
  const evSales = getMetricScoreByLabel(stock, "EV / Sales");
  const pb = getMetricScoreByLabel(stock, "P/B");
  const pe = getMetricScoreByLabel(stock, "P/E Ratio");
  return round0(
    average(
      [earningsYield, evSales, pb, pe].filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value)
      )
    ) || stock.valuationScore
  );
}

function buildSectorProfileMap(
  dataset: SectorLeadersDataset,
  marketCapScoreMap: Map<string, number>
) {
  const map = new Map<string, SectorProfile>();

  dataset.leaderboards.forEach((board) => {
    const top = [...board.stocks]
      .sort((left, right) => right.totalScore + right.analyzerScore - (left.totalScore + left.analyzerScore))
      .slice(0, Math.min(board.stocks.length, 4));
    const breadthScore = scoreSectorBreadth(board.stockCount);
    const scaleScore = round0(
      average(top.map((stock) => marketCapScoreMap.get(stock.symbol) ?? 35))
    );
    const topTierScore = round0(
      average(
        top.map((stock) =>
          average([
            stock.totalScore,
            stock.analyzerScore,
            stock.qualityScore,
            stock.cashScore,
            stock.balanceScore,
          ])
        )
      )
    );
    const depthScore = round0(average(top.map((stock) => clamp(stock.metricsAvailable * 9, 35, 100))));
    const sectorStrength = round0(
      topTierScore * 0.48 + scaleScore * 0.24 + breadthScore * 0.18 + depthScore * 0.1
    );
    const profile: SectorProfile = {
      sector: board.sector,
      stockCount: board.stockCount,
      breadthScore,
      scaleScore,
      topTierScore,
      sectorStrength,
    };

    board.stocks.forEach((stock) => {
      map.set(stock.symbol, profile);
    });
  });

  return map;
}

function buildMarketCapScoreMap(stocks: SectorLeaderStock[]) {
  const sortedCaps = stocks
    .map((stock) => stock.marketCap)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  const map = new Map<string, number>();

  stocks.forEach((stock) => {
    map.set(stock.symbol, scoreMarketCap(stock.marketCap, sortedCaps));
  });

  return map;
}

function scoreMarketCap(value: number | null, sortedCaps: number[]) {
  if (value == null || sortedCaps.length === 0) return 35;
  const rank = sortedCaps.filter((cap) => cap <= value).length;
  return round0(clamp((rank / sortedCaps.length) * 100, 12, 100));
}

function scoreSectorBreadth(stockCount: number) {
  if (stockCount >= 12) return 100;
  if (stockCount >= 8) return 86;
  if (stockCount >= 5) return 74;
  if (stockCount >= 3) return 62;
  if (stockCount >= 2) return 46;
  return 28;
}

function computeFundamentalPenalty({
  stock,
  growthScore,
  qualityScore,
  safetyScore,
  sectorProfile,
  marketCapScore,
}: {
  stock: SectorLeaderStock;
  growthScore: number;
  qualityScore: number;
  safetyScore: number;
  sectorProfile: SectorProfile;
  marketCapScore: number;
}) {
  let penalty = 0;
  const averageGrowth = averageNullable([stock.revenueGrowth, stock.epsGrowth]);

  if (qualityScore < 65) penalty += 4;
  if (qualityScore < 58) penalty += 6;
  if (safetyScore < 58) penalty += 4;
  if (safetyScore < 50) penalty += 6;
  if (sectorProfile.sectorStrength < 62) penalty += 3;
  if (sectorProfile.sectorStrength < 55) penalty += 5;
  if (stock.metricsAvailable < 8) penalty += 3;
  if (averageGrowth != null && averageGrowth < 0) penalty += 2;
  if (averageGrowth != null && averageGrowth < -4) penalty += 4;
  if ((stock.priceReturn1Y ?? 0) > 45 && growthScore < 62) penalty += 4;
  if (marketCapScore < 35 && qualityScore < 70) penalty += 3;

  return penalty;
}

function classifyPortfolioRole({
  growthScore,
  marketCapScore,
  franchiseScore,
  qualityScore,
  sectorProfile,
}: {
  growthScore: number;
  marketCapScore: number;
  franchiseScore: number;
  qualityScore: number;
  sectorProfile: SectorProfile;
}): PortfolioRole {
  if (marketCapScore >= 72 && franchiseScore >= 72 && qualityScore >= 68) {
    return "Blue-chip anchor";
  }
  if (growthScore >= 72 && qualityScore >= 64 && sectorProfile.sectorStrength >= 60) {
    return "Growth leader";
  }
  return "Quality compounder";
}

function addCandidatesFromGroup(
  selected: Candidate[],
  sectorCounts: Map<string, number>,
  group: Candidate[],
  additionsWanted: number,
  sectorLimit: number
) {
  const startingLength = selected.length;
  for (const candidate of group) {
    if (selected.length - startingLength >= additionsWanted) break;
    tryAddCandidate(selected, sectorCounts, candidate, sectorLimit);
  }
}

function tryAddCandidate(
  selected: Candidate[],
  sectorCounts: Map<string, number>,
  candidate: Candidate,
  sectorLimit: number
) {
  if (selected.some((picked) => picked.stock.symbol === candidate.stock.symbol)) return false;
  const count = sectorCounts.get(candidate.stock.sector) ?? 0;
  if (count >= sectorLimit) return false;
  selected.push(candidate);
  sectorCounts.set(candidate.stock.sector, count + 1);
  return true;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function averageNullable(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? average(valid) : null;
}

function formatPct(value: number) {
  return value.toFixed(1);
}

function round0(value: number) {
  return Math.round(value);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
