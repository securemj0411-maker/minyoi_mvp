import fs from "node:fs";
import path from "node:path";

type EvidenceRow = {
  caseId: string;
  pid?: string;
  brand: string;
  exactModel: string;
  normalizedModel: string;
  deviceClass: string;
  evidenceStrength: string;
  decision: string;
  title: string;
  price: number;
};

type BoundaryRow = {
  caseId: string;
  observedClass: string;
  decision: string;
  reason: string;
  title: string;
  price: number;
};

type EvidenceReport = {
  selectedRows: EvidenceRow[];
  boundaryRows: BoundaryRow[];
};

type StrictContractReport = {
  firstLaneModelCode: string;
  metrics: {
    strictAllowedRows: number;
    excludedRows: number;
    maxFutureWriteCap: number;
  };
  allowedRows: Array<{
    pid: string;
    title: string;
    price: number;
    model: string;
  }>;
  excludedRows: Array<{
    pid: string;
    title: string;
    model: string;
    disposition: string;
    reason: string;
  }>;
};

type SourceBackfillReport = {
  rows: Array<{
    modelCode: string;
    sourceConfidence: string;
  }>;
};

type ContractRow = {
  caseId: string;
  title: string;
  price: number;
  expectedDecision: "candidate_positive_contract" | "manual_hold" | "negative_hold";
  expectedModel: string | null;
  expectedComparableKey: string | null;
  reason: string;
};

const inputPath = "reports/speaker-portable-evidence-latest.json";
const flip6StrictPath = "reports/speaker-selected-subset-strict-contract-latest.json";
const flip6SourcePath = "reports/speaker-jbl-flip6-source-backfill-latest.json";
const evidence = JSON.parse(fs.readFileSync(inputPath, "utf8")) as EvidenceReport;
const flip6Strict = JSON.parse(fs.readFileSync(flip6StrictPath, "utf8")) as StrictContractReport;
const flip6Source = JSON.parse(fs.readFileSync(flip6SourcePath, "utf8")) as SourceBackfillReport;

const allowModels = new Set(["jbl_go_3", "jbl_go_4", "jbl_boombox_2", "lg_pk5", "lg_pk7w", "jbl-flip-6"]);
const flip6HasDirectSource = flip6Source.rows.some(
  (row) => row.modelCode === "jbl-flip-6" && row.sourceConfidence === "high",
);

const candidateRows: ContractRow[] = evidence.selectedRows
  .filter((row) => row.evidenceStrength === "official_confirmed" && allowModels.has(row.normalizedModel))
  .map((row) => ({
    caseId: row.caseId,
    title: row.title,
    price: row.price,
    expectedDecision: "candidate_positive_contract",
    expectedModel: row.normalizedModel,
    expectedComparableKey: `speaker|${row.normalizedModel}|portable_bluetooth_speaker`,
    reason: "official-confirmed portable Bluetooth exact model in first subset",
  }));

const manualRows: ContractRow[] = evidence.selectedRows
  .filter((row) => !allowModels.has(row.normalizedModel))
  .map((row) => ({
    caseId: row.caseId,
    title: row.title,
    price: row.price,
    expectedDecision: "manual_hold",
    expectedModel: row.normalizedModel,
    expectedComparableKey: null,
    reason: "vendor-only or out-of-first-subset speaker row",
  }));

const flip6CandidateRows: ContractRow[] =
  flip6HasDirectSource && flip6Strict.metrics.strictAllowedRows >= 3
    ? flip6Strict.allowedRows.map((row, index) => ({
        caseId: `SPEAKER-PORTABLE-POS-FLIP6-${String(index + 1).padStart(2, "0")}`,
        title: row.title,
        price: row.price,
        expectedDecision: "candidate_positive_contract",
        expectedModel: "jbl-flip-6",
        expectedComparableKey: "speaker|jbl_flip_6|portable_bluetooth_speaker",
        reason: "official-source-backed JBL Flip 6 body row from no-write live detail strict contract",
      }))
    : [];

const flip6BoundaryRows: ContractRow[] = flip6Strict.excludedRows
  .filter((row) => /accessory|rental|damaged|speaker_context_missing/.test(row.reason))
  .map((row, index) => ({
    caseId: `SPEAKER-PORTABLE-HOLD-FLIP6-${String(index + 1).padStart(2, "0")}`,
    title: row.title,
    price: 0,
    expectedDecision: row.disposition === "manual_review" ? "manual_hold" : "negative_hold",
    expectedModel: null,
    expectedComparableKey: null,
    reason: `preserve strict live-read hold: ${row.reason}`,
  }));

const boundaryRows: ContractRow[] = evidence.boundaryRows.map((row) => ({
  caseId: row.caseId,
  title: row.title,
  price: row.price,
  expectedDecision: row.decision.startsWith("manual") ? "manual_hold" : "negative_hold",
  expectedModel: null,
  expectedComparableKey: null,
  reason: row.reason,
}));

const rows = [...candidateRows, ...manualRows, ...boundaryRows, ...flip6CandidateRows, ...flip6BoundaryRows];

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
  inputFiles: [inputPath, flip6StrictPath, flip6SourcePath],
  metrics: {
    rows: rows.length,
    candidatePositiveContractRows: candidateRows.length + flip6CandidateRows.length,
    manualHoldRows:
      manualRows.length +
      boundaryRows.filter((row) => row.expectedDecision === "manual_hold").length +
      flip6BoundaryRows.filter((row) => row.expectedDecision === "manual_hold").length,
    negativeHoldRows: boundaryRows.filter((row) => row.expectedDecision === "negative_hold").length + flip6BoundaryRows.filter((row) => row.expectedDecision === "negative_hold").length,
    flip6CandidateRows: flip6CandidateRows.length,
    flip6HoldRows: flip6BoundaryRows.length,
    flip6MaxFutureWriteCap: flip6Strict.metrics.maxFutureWriteCap,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  allowedModels: [...allowModels],
  rows,
  conclusion: "speaker_portable_exact_model_contract_ready_with_flip6_backfill_no_runtime_approval",
  nextAction: "Run no-mutation executor; do not runtime-wire speaker category yet.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "speaker-portable-exact-model-contract-latest.json");
const mdPath = path.join(reportsDir, "speaker-portable-exact-model-contract-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Speaker Portable Exact-Model Contract",
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
  `- candidatePositiveContractRows: ${report.metrics.candidatePositiveContractRows}`,
  `- manualHoldRows: ${report.metrics.manualHoldRows}`,
  `- negativeHoldRows: ${report.metrics.negativeHoldRows}`,
  `- flip6CandidateRows: ${report.metrics.flip6CandidateRows}`,
  `- flip6HoldRows: ${report.metrics.flip6HoldRows}`,
  `- flip6MaxFutureWriteCap: ${report.metrics.flip6MaxFutureWriteCap}`,
  "",
  "## Allowed Models",
  "",
  ...report.allowedModels.map((model) => `- ${model}`),
  "",
  "## Rows",
  "",
  "| caseId | expectedDecision | expectedModel | expectedComparableKey | title |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.expectedModel ?? "null"} | ${row.expectedComparableKey ?? "null"} | ${row.title} |`),
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
  candidatePositiveContractRows: report.metrics.candidatePositiveContractRows,
  manualHoldRows: report.metrics.manualHoldRows,
  negativeHoldRows: report.metrics.negativeHoldRows,
  jsonPath,
  mdPath,
}, null, 2));
