import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelPrice = {
  model: string;
  inputPerMillion: number;
  cachedInputPerMillion: number;
  outputPerMillion: number;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const prices: ModelPrice[] = [
  {
    model: "gpt-5.4-nano",
    inputPerMillion: 0.2,
    cachedInputPerMillion: 0.02,
    outputPerMillion: 1.25,
  },
  {
    model: "gpt-5.4-mini",
    inputPerMillion: 0.75,
    cachedInputPerMillion: 0.075,
    outputPerMillion: 4.5,
  },
];

const scenarios = [
  { name: "tiny_escrow_cap", callsPerDay: 100 },
  { name: "focused_candidate_review", callsPerDay: 300 },
  { name: "heavy_daily_review", callsPerDay: 1000 },
];

const tokenProfile = {
  staticPromptTokens: Number(process.env.AI_L2_COST_STATIC_PROMPT_TOKENS ?? 10_000),
  listingInputTokens: Number(process.env.AI_L2_COST_LISTING_INPUT_TOKENS ?? 900),
  outputTokens: Number(process.env.AI_L2_COST_OUTPUT_TOKENS ?? 220),
  cacheHitRate: Number(process.env.AI_L2_COST_CACHE_HIT_RATE ?? 0.8),
  daysPerMonth: Number(process.env.AI_L2_COST_DAYS_PER_MONTH ?? 30),
};

function dollars(value: number) {
  return `$${value.toFixed(value < 10 ? 2 : 0)}`;
}

function estimate(price: ModelPrice, callsPerDay: number) {
  const callsPerMonth = callsPerDay * tokenProfile.daysPerMonth;
  const cachedCalls = callsPerMonth * tokenProfile.cacheHitRate;
  const uncachedCalls = callsPerMonth - cachedCalls;

  const staticUncachedCost = (uncachedCalls * tokenProfile.staticPromptTokens * price.inputPerMillion) / 1_000_000;
  const staticCachedCost = (cachedCalls * tokenProfile.staticPromptTokens * price.cachedInputPerMillion) / 1_000_000;
  const listingCost = (callsPerMonth * tokenProfile.listingInputTokens * price.inputPerMillion) / 1_000_000;
  const outputCost = (callsPerMonth * tokenProfile.outputTokens * price.outputPerMillion) / 1_000_000;
  const total = staticUncachedCost + staticCachedCost + listingCost + outputCost;

  return {
    callsPerMonth,
    staticUncachedCost,
    staticCachedCost,
    listingCost,
    outputCost,
    total,
  };
}

const rows = prices.flatMap((price) =>
  scenarios.map((scenario) => ({
    model: price.model,
    scenario: scenario.name,
    callsPerDay: scenario.callsPerDay,
    ...estimate(price, scenario.callsPerDay),
  })),
);

const output = {
  generatedAt: new Date().toISOString(),
  mode: "report_only_no_runtime_mutation",
  tokenProfile,
  priceSource: {
    pricing: "https://developers.openai.com/api/docs/pricing",
    promptCaching: "https://openai.com/index/api-prompt-caching/",
    note:
      "Pricing changes over time. Keep this report as an envelope, and re-check official pricing before enabling production AI L2.",
  },
  rows,
  decision: {
    summary:
      "AI L2 cost is not the main blocker at tiny/focused scale; correctness and FK/cache safety are the blockers.",
    recommendedFirstStep:
      "Keep broad AI disabled. After FK approval, enable a tiny escrow cap for metadata/cache only while pool-policy hard-blocks remain.",
    forbidden: [
      "Do not let AI pass override needs_review into candidate pool.",
      "Do not enable all ai_l2_primary lanes at once.",
      "Do not remove deterministic blocker flags for self-unlocked/connectivity/generation ambiguity.",
    ],
  },
};

const markdown = [
  "# AI L2 Cost Envelope",
  "",
  `- generatedAt: ${output.generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  "",
  "## Assumptions",
  "",
  `- staticPromptTokens: ${tokenProfile.staticPromptTokens.toLocaleString()}`,
  `- listingInputTokens: ${tokenProfile.listingInputTokens.toLocaleString()}`,
  `- outputTokens: ${tokenProfile.outputTokens.toLocaleString()}`,
  `- cacheHitRate: ${(tokenProfile.cacheHitRate * 100).toFixed(0)}%`,
  `- daysPerMonth: ${tokenProfile.daysPerMonth}`,
  "",
  "## Monthly Envelope",
  "",
  "| model | scenario | calls/day | calls/month | static uncached | static cached | listing input | output | total |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...rows.map((row) =>
    [
      row.model,
      row.scenario,
      row.callsPerDay.toLocaleString(),
      row.callsPerMonth.toLocaleString(),
      dollars(row.staticUncachedCost),
      dollars(row.staticCachedCost),
      dollars(row.listingCost),
      dollars(row.outputCost),
      dollars(row.total),
    ].join(" | "),
  ).map((line) => `| ${line} |`),
  "",
  "## Decision",
  "",
  `- ${output.decision.summary}`,
  `- Recommended first step: ${output.decision.recommendedFirstStep}`,
  "",
  "## Forbidden",
  "",
  ...output.decision.forbidden.map((item) => `- ${item}`),
  "",
  "## Sources",
  "",
  "- OpenAI pricing: https://developers.openai.com/api/docs/pricing",
  "- OpenAI prompt caching: https://openai.com/index/api-prompt-caching/",
  "",
].join("\n");

async function main() {
  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "ai-l2-cost-envelope-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "ai-l2-cost-envelope-latest.md"), markdown);

  console.log("wrote reports/ai-l2-cost-envelope-latest.json");
  console.log("wrote reports/ai-l2-cost-envelope-latest.md");
  console.log(JSON.stringify({ rows: rows.length, decision: output.decision.summary }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
