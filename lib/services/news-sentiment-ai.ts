import "server-only";
import { config, isZaiConfigured } from "@/lib/config";
import type { PsxSentiment } from "@/lib/services/world-news";

// Parameters used to judge Pakistan impact:
// 1. Oil/energy prices  — Pakistan is a net importer; price rise = negative
// 2. US Fed / rates     — higher global rates = capital outflow from Pakistan
// 3. IMF decisions      — direct Pakistan programme impact
// 4. USD strength       — stronger dollar = PKR pressure = negative
// 5. Regional conflict  — Middle East/South Asia instability = investor risk-off
// 6. Global trade       — tariffs/sanctions on Pakistan trade partners
// 7. Commodities        — wheat (imports), cotton (exports), gold
// 8. CPEC / China       — Pakistan's largest FDI partner
// 9. Saudi/UAE          — largest remittance sources for Pakistan
// 10. Pakistan domestic — floods, elections, policy rate, PSX, KSE, SBP

const SYSTEM = `You are a Pakistan economy and stock market analyst.

For each news article, decide:
1. Does it have a DIRECT or STRONG INDIRECT impact on Pakistan's economy or stock market (PSX/KSE)?
2. If yes, is that impact POSITIVE or NEGATIVE for Pakistan?

Criteria to judge impact:
- OIL/ENERGY: Price rise = negative (Pakistan imports oil). Price drop = positive.
- US FEDERAL RESERVE: Rate hike = negative (capital outflow, PKR pressure). Rate cut = positive.
- IMF: Deal/tranche approval = positive. Delay/concern = negative.
- USD STRENGTH: Dollar surges = negative (PKR weakens, imports costlier). Dollar falls = positive.
- REGIONAL CONFLICT: Escalation (Middle East, India-Pakistan) = negative (investor risk-off, oil spike).
  Ceasefire/peace = positive.
- GLOBAL TRADE/TARIFFS: Tariffs on Pakistan's export partners (US, EU, China) = negative for Pakistan exports.
  Trade deals opening markets = positive.
- COMMODITIES: Wheat price rise = negative (Pakistan imports wheat). Cotton price rise = positive (Pakistan exports cotton).
  Gold price rise = neutral/slightly positive (remittance-linked).
- CHINA/CPEC: China economic trouble = negative (CPEC delays). China growth = positive.
- SAUDI/UAE: Instability = negative (remittances drop). Economic strength = positive.
- PAKISTAN DOMESTIC: Floods/disasters = negative. Elections/stability = context-dependent.
  SBP rate cut = positive. Inflation rise = negative. PSX/KSE gains = positive.
  Political crisis = negative.
- GLOBAL RECESSION: Negative (exports drop, remittances drop).
- SANCTIONS ON PAKISTAN PARTNERS: Negative.

Rules:
- Only tag if there is a CLEAR, DIRECT connection to Pakistan. Do NOT tag general world news with no Pakistan link.
- Return EXACTLY one JSON object mapping each article's "id" to "positive", "negative", or null (null = no Pakistan impact).
- No explanations, only the JSON object.`;

type SentimentMap = Record<string, PsxSentiment | null>;

export async function classifyPakistanImpact(
  articles: { id: string; title: string; description: string }[]
): Promise<SentimentMap> {
  if (!isZaiConfigured || articles.length === 0) return {};

  const input = articles.map((a) => ({
    id: a.id,
    title: a.title,
    desc: a.description.slice(0, 200),
  }));

  try {
    const res = await fetch(
      `${config.ai.zaiBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.ai.zaiApiKey}`,
        },
        body: JSON.stringify({
          model: "glm-4.7-flash",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: `Classify these ${articles.length} articles:\n${JSON.stringify(input)}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) return {};

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    const parsed: Record<string, unknown> = JSON.parse(raw);

    const map: SentimentMap = {};
    for (const [id, val] of Object.entries(parsed)) {
      if (val === "positive" || val === "negative") map[id] = val;
      else map[id] = null;
    }
    return map;
  } catch {
    return {};
  }
}
