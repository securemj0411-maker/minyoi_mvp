import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ObservedRow = {
  pid: string;
  title: string;
  price: number;
  query: string;
  saleStatus: string;
  disposition: string;
  reason: string;
};

type LaneResult = {
  lane: string;
  label: string;
  rows: ObservedRow[];
};

type LiveReadReport = {
  generatedAt: string;
  lanes: LaneResult[];
};

type QueryProposal = {
  query: string;
  intent: string;
  expectedNoiseReduction: string;
  remainingRisk: string;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  supabaseRead: false;
  supabaseWrite: false;
  sourceReport: string;
  conclusion: string;
  metrics: {
    observedRows: number;
    freshRows: number;
    holdRows: number;
    accessoryConsumableHolds: number;
    fraudWarningHolds: number;
    reservedHolds: number;
    proposedQueries: number;
  };
  observedHoldReasons: Array<{ reason: string; count: number; examples: string[] }>;
  queryProposals: QueryProposal[];
  stopConditions: string[];
  nextSteps: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const sourceRelativePath = "reports/category-no-write-live-read-observation-latest.json";
const outputJsonPath = path.join(reportsDir, "robot-vacuum-query-refinement-latest.json");
const outputMdPath = path.join(reportsDir, "robot-vacuum-query-refinement-latest.md");

const queryProposals: QueryProposal[] = [
  {
    query: "\"로보락 S8 Pro Ultra\" 로봇청소기 풀박스",
    intent: "Require full product phrase plus full-box context.",
    expectedNoiseReduction: "Filters many accessory-kit rows that mention only the model phrase.",
    remainingRisk: "May miss bare full-unit rows that do not include 풀박스.",
  },
  {
    query: "\"로보락 S8 Pro Ultra\" 로봇청소기 판매",
    intent: "Bias toward normal sale listings with robot-vacuum context.",
    expectedNoiseReduction: "Keeps model and device class explicit.",
    remainingRisk: "Still needs fraud/rental/accessory checks.",
  },
  {
    query: "\"에코백스 T20 옴니\" 로봇청소기",
    intent: "Use exact Korean model phrase and device class together.",
    expectedNoiseReduction: "Avoids generic omni/accessory spillover.",
    remainingRisk: "Consumables can still mention the full model phrase.",
  },
  {
    query: "\"X10 Pro Omni\" 로봇청소기 본품",
    intent: "Require exact model and 본품/full-unit signal.",
    expectedNoiseReduction: "Separates dock/consumable-only listings from complete set candidates.",
    remainingRisk: "본품 may still mean 본체만, so title hold rules must stay active.",
  },
];

function countBy<T extends string>(values: T[]) {
  const map = new Map<T, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function renderMarkdown(report: Report) {
  const lines = [
    "# Robot Vacuum Query Refinement",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- sourceReport: ${report.sourceReport}`,
    `- reportOnly: ${report.reportOnly}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Metrics",
    "",
    `- observedRows: ${report.metrics.observedRows}`,
    `- freshRows: ${report.metrics.freshRows}`,
    `- holdRows: ${report.metrics.holdRows}`,
    `- accessoryConsumableHolds: ${report.metrics.accessoryConsumableHolds}`,
    `- fraudWarningHolds: ${report.metrics.fraudWarningHolds}`,
    `- reservedHolds: ${report.metrics.reservedHolds}`,
    `- proposedQueries: ${report.metrics.proposedQueries}`,
    "",
    "## Observed Hold Reasons",
    "",
    "| reason | count | examples |",
    "|---|---:|---|",
    ...report.observedHoldReasons.map((row) => `| ${row.reason} | ${row.count} | ${row.examples.join("<br>")} |`),
    "",
    "## Query Proposals",
    "",
    "| query | intent | expected noise reduction | remaining risk |",
    "|---|---|---|---|",
    ...report.queryProposals.map((row) =>
      `| ${row.query} | ${row.intent} | ${row.expectedNoiseReduction} | ${row.remainingRisk} |`,
    ),
    "",
    "## Stop Conditions",
    "",
    ...report.stopConditions.map((item) => `- ${item}`),
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const source = JSON.parse(await readFile(path.join(appDir, sourceRelativePath), "utf8")) as LiveReadReport;
  const lane = source.lanes.find((row) => row.lane === "home_appliance_robot_vacuum_model_dock");
  if (!lane) throw new Error("robot vacuum lane not found in live-read source report");

  const rows = lane.rows;
  const holds = rows.filter((row) => row.disposition === "hold");
  const reasons = countBy(holds.map((row) => row.reason));
  const observedHoldReasons = [...reasons.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason, count]) => ({
      reason,
      count,
      examples: holds.filter((row) => row.reason === reason).slice(0, 3).map((row) => `${row.pid}: ${row.title}`),
    }));

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    sourceReport: sourceRelativePath,
    conclusion: "robot_vacuum_requires_query_refinement_before_runtime_review",
    metrics: {
      observedRows: rows.length,
      freshRows: rows.filter((row) => row.disposition === "fresh_live_candidate").length,
      holdRows: holds.length,
      accessoryConsumableHolds: holds.filter((row) => row.reason.includes("dock_or_consumable")).length,
      fraudWarningHolds: holds.filter((row) => row.reason.includes("fraud")).length,
      reservedHolds: holds.filter((row) => row.reason.includes("RESERVED")).length,
      proposedQueries: queryProposals.length,
    },
    observedHoldReasons,
    queryProposals,
    stopConditions: [
      "Do not promote robot vacuum runtime review while freshRows is 0 in no-write live-read.",
      "Stop if proposed queries still return mostly accessory/consumable/fraud rows.",
      "Any full-unit candidate must pass active saleStatus and no 본체만/소모품/도크만/fraud signals.",
    ],
    nextSteps: [
      "Run a future no-write live-read wave using these narrower query proposals.",
      "If at least 2 clean fresh rows appear and risky holds stay explicit, create a robot-vacuum owner review packet.",
      "Keep current runtime/candidate pool untouched.",
    ],
  };

  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, renderMarkdown(report), "utf8");
  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(JSON.stringify(report.metrics));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
