import fs from "node:fs";
import path from "node:path";

type ContractRow = {
  caseId: string;
  title: string;
  price: number;
  expectedDecision: string;
  expectedComparableKey: string | null;
  componentClass: string;
};

type ContractReport = {
  rows: ContractRow[];
};

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^0-9a-z가-힣+/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferVacuumModel(title: string) {
  const compact = normalizeText(title).replace(/\s+/g, "");
  if (/다이슨|dyson/.test(compact)) {
    if (/v10|싸이클론v10|cyclonev10|카본파이버/.test(compact)) return "dyson-cyclone-v10-carbon-fiber";
    if (/v8/.test(compact)) return "dyson-v8";
    if (/v7/.test(compact)) return "dyson-v7";
    if (/v6/.test(compact)) return "dyson-v6";
  }
  if (/(lg|엘지|코드제로|codezero).{0,24}a9|a9/.test(compact)) return "lg-codezero-a9";
  if (/샤오미|xiaomi|vvn3|g10/.test(compact)) return "xiaomi-mi-vacuum-cleaner-g10-vvn3";
  return null;
}

function classifyVacuumCompleteSet(title: string) {
  const text = normalizeText(title);
  const model = inferVacuumModel(title);
  const outOfLane =
    /로봇\s*청소기|로봇청소기|룸바|클린베이스|자동먼지통|침구\s*청소기|침구청소기|물걸레|스핀|듀얼스핀|mop|wet\s*dry/.test(text);
  const accessoryOnly =
    /충전기|어댑터|배터리|물걸레\s*브러쉬|물걸레브러쉬|브러쉬|거치대|크래들|홀더|클린베이스/.test(text)
    && !/(청소기).{0,24}(풀세트|풀\s*세트|포함|판매)/.test(text);
  const extraFeeOrIncomplete = /추가|별도|제외|본체|밧데리|배터리\s*새것|리필|호환|방전/.test(text);
  const completeSetSignal = /풀세트|풀\s*세트|충전기\s*포함|충전기포함|포함\s*판매|무선\s*청소기|무선청소기/.test(text);
  const mainUnitSignal = /청소기|무선청소기|무선\s*청소기/.test(text);

  if (outOfLane || accessoryOnly || !model) {
    return {
      decision: "negative_hold" as const,
      model,
      comparableKey: null,
      reason: outOfLane ? "out_of_lane_vacuum_subtype" : accessoryOnly ? "accessory_or_part_only" : "missing_exact_model",
    };
  }
  if (!["dyson-cyclone-v10-carbon-fiber", "dyson-v8"].includes(model) || extraFeeOrIncomplete || !completeSetSignal || !mainUnitSignal) {
    return {
      decision: "manual_hold" as const,
      model,
      comparableKey: null,
      reason: extraFeeOrIncomplete ? "incomplete_or_condition_caveat" : "not_approved_complete_set_model",
    };
  }
  return {
    decision: "candidate_positive_contract_only" as const,
    model,
    comparableKey: `stick_vacuum|${model}|complete_set`,
    reason: "exact_model_complete_set_contract",
  };
}

const contractPath = "reports/home-appliance-stick-vacuum-complete-set-contract-latest.json";
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as ContractReport;

const rows = contract.rows.map((row) => {
  const actual = classifyVacuumCompleteSet(row.title);
  const expectedBucket = row.expectedDecision === "candidate_positive_contract_only"
    ? "candidate_positive_contract_only"
    : row.expectedDecision.startsWith("manual_hold")
      ? "manual_hold"
      : "negative_hold";
  const pass = actual.decision === expectedBucket && actual.comparableKey === row.expectedComparableKey;
  return {
    caseId: row.caseId,
    title: row.title,
    componentClass: row.componentClass,
    expectedDecision: row.expectedDecision,
    expectedBucket,
    actualDecision: actual.decision,
    model: actual.model,
    expectedComparableKey: row.expectedComparableKey,
    actualComparableKey: actual.comparableKey,
    reason: actual.reason,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);
const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  runtimeCatalogApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "home_appliance_tech_discovered",
  lane: "stick_handheld_vacuum_complete_set",
  inputFiles: [contractPath],
  metrics: {
    rows: rows.length,
    positiveRows: rows.filter((row) => row.actualDecision === "candidate_positive_contract_only").length,
    manualRows: rows.filter((row) => row.actualDecision === "manual_hold").length,
    holdRows: rows.filter((row) => row.actualDecision === "negative_hold").length,
    failedRows: failedRows.length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion:
    failedRows.length === 0
      ? "home_appliance_stick_vacuum_no_mutation_executor_passed"
      : "home_appliance_stick_vacuum_no_mutation_executor_needs_review",
  nextAction:
    "Do not runtime-wire home appliance yet. Backfill more complete-set positives or create runtime impact review only if staying internal_only.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "home-appliance-stick-vacuum-no-mutation-executor-latest.json");
const mdPath = path.join(reportsDir, "home-appliance-stick-vacuum-no-mutation-executor-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Home Appliance Stick Vacuum No-Mutation Executor",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- lane: ${report.lane}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- runtimeCatalogApply: false",
  "- publicPromotion: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- positiveRows: ${report.metrics.positiveRows}`,
  `- manualRows: ${report.metrics.manualRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | model | key | pass | title | reason |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) =>
    `| ${row.caseId} | ${row.expectedBucket} | ${row.actualDecision} | ${row.model ?? "null"} | ${
      row.actualComparableKey ?? "null"
    } | ${row.pass ? "yes" : "no"} | ${row.title.replace(/\|/g, "\\|")} | ${row.reason} |`,
  ),
  "",
  "## Failed Rows",
  "",
  failedRows.length === 0
    ? "- none"
    : failedRows
        .map(
          (row) =>
            `- ${row.caseId}: expected ${row.expectedBucket}/${row.expectedComparableKey ?? "null"}, actual ${
              row.actualDecision
            }/${row.actualComparableKey ?? "null"}`,
        )
        .join("\n"),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      rows: report.metrics.rows,
      positiveRows: report.metrics.positiveRows,
      failedRows: report.metrics.failedRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
