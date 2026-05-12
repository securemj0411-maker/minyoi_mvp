import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type StrictContract = {
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
    saleStatus: string;
    reason?: string;
  }>;
  excludedRows: Array<{
    pid: string;
    title: string;
    model: string;
    disposition: string;
    reason: string;
  }>;
};

type SourceBackfill = {
  rows: Array<{
    modelCode: string;
    brandModel: string;
    sourceTier: string;
    sourceConfidence: string;
    sourceUrl: string;
  }>;
};

type ExactModelContract = {
  allowedModels: string[];
  rows: Array<{
    caseId: string;
    title: string;
    expectedDecision: string;
    expectedModel: string | null;
    expectedComparableKey: string | null;
    reason: string;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function compact(text: unknown, limit = 92) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const strict = await readJson<StrictContract>("speaker-selected-subset-strict-contract-latest.json");
  const source = await readJson<SourceBackfill>("speaker-jbl-flip6-source-backfill-latest.json");
  const exact = await readJson<ExactModelContract>("speaker-portable-exact-model-contract-latest.json");
  const sourceRows = source.rows.filter((row) => row.modelCode === strict.firstLaneModelCode && row.sourceConfidence === "high");
  const alreadyAllowed = exact.allowedModels.includes(strict.firstLaneModelCode);
  const proposedPositiveRows = strict.allowedRows.map((row, index) => ({
    caseId: `SPEAKER-PORTABLE-POS-FLIP6-${String(index + 1).padStart(2, "0")}`,
    title: row.title,
    price: row.price,
    expectedDecision: "candidate_positive_contract",
    expectedModel: "jbl-flip-6",
    expectedComparableKey: "speaker|jbl_flip_6|portable_bluetooth_speaker",
    reason: "official-source-backed JBL Flip 6 body row from no-write live detail strict contract",
    sourcePid: row.pid,
  }));
  const proposedNegativeRows = strict.excludedRows
    .filter((row) => /accessory|rental|damaged|speaker_context_missing/.test(row.reason))
    .map((row, index) => ({
      caseId: `SPEAKER-PORTABLE-HOLD-FLIP6-${String(index + 1).padStart(2, "0")}`,
      title: row.title,
      expectedDecision: row.disposition === "manual_review" ? "manual_hold" : "negative_hold",
      expectedModel: null,
      expectedComparableKey: null,
      reason: `preserve strict live-read hold: ${row.reason}`,
      sourcePid: row.pid,
    }));
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "speaker_audio_discovered",
    target: strict.firstLaneModelCode,
    sourceReports: [
      "speaker-portable-exact-model-contract-latest.json",
      "speaker-selected-subset-strict-contract-latest.json",
      "speaker-jbl-flip6-source-backfill-latest.json",
    ],
    metrics: {
      alreadyAllowed,
      sourceRows: sourceRows.length,
      proposedPositiveRows: proposedPositiveRows.length,
      proposedNegativeRows: proposedNegativeRows.length,
      strictAllowedRows: strict.metrics.strictAllowedRows,
      strictExcludedRows: strict.metrics.excludedRows,
      maxFutureWriteCap: strict.metrics.maxFutureWriteCap,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    mergeProposal: {
      addAllowedModel: alreadyAllowed ? null : strict.firstLaneModelCode,
      positiveRows: proposedPositiveRows,
      negativeRows: proposedNegativeRows,
      nonGoals: [
        "do not runtime-wire speaker category",
        "do not create DB acquisition executor",
        "do not public-promote Flip 6",
        "do not infer other JBL Flip models from Flip 6 evidence",
      ],
    },
    sourceEvidence: sourceRows,
    conclusion: alreadyAllowed
      ? "speaker_jbl_flip6_exact_contract_merge_already_applied_report_only"
      : "speaker_jbl_flip6_exact_contract_merge_proposal_ready_report_only",
    nextStep:
      "If owner wants to clear the speaker warning later, update the portable exact-model contract with this proposal in a separate report-only patch, then regenerate speaker checklist.",
  };

  const jsonPath = path.join(reportsDir, "speaker-jbl-flip6-exact-contract-merge-proposal-latest.json");
  const mdPath = path.join(reportsDir, "speaker-jbl-flip6-exact-contract-merge-proposal-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Speaker JBL Flip 6 Exact Contract Merge Proposal",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- alreadyAllowed: ${report.metrics.alreadyAllowed}`,
    `- sourceRows: ${report.metrics.sourceRows}`,
    `- proposedPositiveRows: ${report.metrics.proposedPositiveRows}`,
    `- proposedNegativeRows: ${report.metrics.proposedNegativeRows}`,
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    "",
    "## Proposed Positive Rows",
    "",
    mdTable(
      ["caseId", "sourcePid", "title", "price", "model", "key", "reason"],
      proposedPositiveRows.map((row) => [
        row.caseId,
        row.sourcePid,
        compact(row.title),
        row.price,
        row.expectedModel,
        row.expectedComparableKey,
        row.reason,
      ]),
    ),
    "",
    "## Proposed Negative / Manual Rows",
    "",
    mdTable(
      ["caseId", "sourcePid", "decision", "title", "reason"],
      proposedNegativeRows.map((row) => [
        row.caseId,
        row.sourcePid,
        row.expectedDecision,
        compact(row.title),
        row.reason,
      ]),
    ),
    "",
    "## Source Evidence",
    "",
    mdTable(
      ["modelCode", "brandModel", "tier", "confidence", "source"],
      sourceRows.map((row) => [row.modelCode, row.brandModel, row.sourceTier, row.sourceConfidence, row.sourceUrl]),
    ),
    "",
    "## Non Goals",
    "",
    ...report.mergeProposal.nonGoals.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    proposedPositiveRows: report.metrics.proposedPositiveRows,
    proposedNegativeRows: report.metrics.proposedNegativeRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
