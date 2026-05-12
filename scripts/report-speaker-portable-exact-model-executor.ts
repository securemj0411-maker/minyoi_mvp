import fs from "node:fs";
import path from "node:path";

type ContractRow = {
  caseId: string;
  title: string;
  price: number;
  expectedDecision: "candidate_positive_contract" | "manual_hold" | "negative_hold";
  expectedModel: string | null;
  expectedComparableKey: string | null;
  reason: string;
};

type ContractReport = {
  rows: ContractRow[];
};

type ExecutionDecision = {
  decision: "candidate_positive_contract" | "manual_hold" | "negative_hold";
  model: string | null;
  comparableKey: string | null;
  reason: string;
};

const contractPath = "reports/speaker-portable-exact-model-contract-latest.json";
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as ContractReport;

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectExactModel(title: string) {
  const n = normalize(title);
  if (/\bjbl\s*go\s*3\b|\bgo\s*3\b|go3\b/.test(n)) return "jbl_go_3";
  if (/\bjbl\s*go\s*4\b|\bgo\s*4\b|go4\b/.test(n)) return "jbl_go_4";
  if (/jbl.*(?:boombox\s*2|붐박스\s*2)|(?:boombox\s*2|붐박스\s*2).*jbl/.test(n)) return "jbl_boombox_2";
  if (/(?:\blg\b|엘지).*pk\s*5\b|pk5\b/.test(n)) return "lg_pk5";
  if (/(?:\blg\b|엘지).*(?:pk\s*7w|pk7w)|(?:pk\s*7w|pk7w).*(?:\blg\b|엘지)/.test(n)) return "lg_pk7w";
  if (/britz|브리츠|bz\s*jb9600|bz\s*lv2200/.test(n)) return "vendor_only_britz";
  if (/marshall|마샬|acton|액톤|stanmore|스탠모어|authentics|어센틱/.test(n)) return "home_tabletop_speaker";
  return null;
}

function execute(row: ContractRow): ExecutionDecision {
  const n = normalize(row.title);
  const hardHold = /(케이스|파우치|하드쉘|마이크|무선\s*마이크|karaoke|노래방|pa\s*스피커|eon|리시버|receiver|앰프|amp|마란츠|marantz|사운드바|soundbar|일괄|고장|파손|대여|렌탈|rent)/.test(n);
  if (hardHold) {
    return {
      decision: "negative_hold",
      model: null,
      comparableKey: null,
      reason: "hard speaker boundary signal",
    };
  }

  const model = detectExactModel(row.title);
  if (!model) {
    return {
      decision: "negative_hold",
      model: null,
      comparableKey: null,
      reason: "no allowed portable exact model",
    };
  }

  if (model === "vendor_only_britz" || model === "home_tabletop_speaker") {
    return {
      decision: "manual_hold",
      model,
      comparableKey: null,
      reason: model === "vendor_only_britz" ? "vendor-only evidence" : "home/tabletop speaker lane",
    };
  }

  return {
    decision: "candidate_positive_contract",
    model,
    comparableKey: `speaker|${model}|portable_bluetooth_speaker`,
    reason: "official-confirmed portable exact model",
  };
}

const rows = contract.rows.map((row) => {
  const actual = execute(row);
  const pass = actual.decision === row.expectedDecision
    && actual.comparableKey === row.expectedComparableKey
    && (row.expectedDecision === "candidate_positive_contract" ? actual.model === row.expectedModel : true);
  return {
    ...row,
    actualDecision: actual.decision,
    actualModel: actual.model,
    actualComparableKey: actual.comparableKey,
    actualReason: actual.reason,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "speaker_audio_discovered",
  lane: "speaker_portable_exact_model",
  inputFiles: [contractPath],
  metrics: {
    rows: rows.length,
    passedRows: rows.length - failedRows.length,
    failedRows: failedRows.length,
    candidatePositiveContractRows: rows.filter((row) => row.actualDecision === "candidate_positive_contract").length,
    manualHoldRows: rows.filter((row) => row.actualDecision === "manual_hold").length,
    negativeHoldRows: rows.filter((row) => row.actualDecision === "negative_hold").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length === 0
    ? "speaker_portable_exact_model_executor_passed_no_runtime_approval"
    : "speaker_portable_exact_model_executor_needs_review",
  nextAction: failedRows.length === 0
    ? "Review whether a dedicated speaker category can be added as internal_only; do not public-promote."
    : "Fix contract or executor before any runtime consideration.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "speaker-portable-exact-model-executor-latest.json");
const mdPath = path.join(reportsDir, "speaker-portable-exact-model-executor-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Speaker Portable Exact-Model Executor",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- lane: ${report.lane}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- passedRows: ${report.metrics.passedRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  `- candidatePositiveContractRows: ${report.metrics.candidatePositiveContractRows}`,
  `- manualHoldRows: ${report.metrics.manualHoldRows}`,
  `- negativeHoldRows: ${report.metrics.negativeHoldRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | expectedKey | actualKey | pass | title |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.actualDecision} | ${row.expectedComparableKey ?? "null"} | ${row.actualComparableKey ?? "null"} | ${row.pass ? "yes" : "no"} | ${row.title} |`),
  "",
  "## Failed Rows",
  "",
  failedRows.length === 0 ? "- none" : failedRows.map((row) => `- ${row.caseId}: expected ${row.expectedDecision}, got ${row.actualDecision}`).join("\n"),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  rows: report.metrics.rows,
  failedRows: report.metrics.failedRows,
  candidatePositiveContractRows: report.metrics.candidatePositiveContractRows,
  manualHoldRows: report.metrics.manualHoldRows,
  negativeHoldRows: report.metrics.negativeHoldRows,
  jsonPath,
  mdPath,
}, null, 2));
