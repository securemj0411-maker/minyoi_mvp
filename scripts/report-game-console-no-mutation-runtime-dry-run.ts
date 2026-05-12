import fs from "node:fs";
import path from "node:path";

import { parseGameConsoleListing } from "@/lib/game-console-parser";

type ExpectedClass = "positive" | "manual_review" | "hold";

type GameConsoleCase = {
  caseId: string;
  inputTitle: string;
  inputDescription?: string;
  expectedClass: ExpectedClass;
  blockerType: string;
  confidence: string;
  notes?: string;
};

type PrepReport = {
  positiveTestCases: GameConsoleCase[];
  manualReviewTestCases: GameConsoleCase[];
  negativeHoldTestCases: GameConsoleCase[];
};

const prep = JSON.parse(fs.readFileSync("reports/game-console-body-narrow-implementation-prep-latest.json", "utf8")) as PrepReport;
const cases = [
  ...prep.positiveTestCases,
  ...prep.manualReviewTestCases,
  ...prep.negativeHoldTestCases,
];

function expectedDecision(expectedClass: ExpectedClass) {
  if (expectedClass === "positive") return "candidate_positive_only";
  if (expectedClass === "manual_review") return "manual_review_only";
  return "negative_hold_only";
}

function actualDecision(parsed: ReturnType<typeof parseGameConsoleListing>) {
  if (parsed.listingType === "normal" && parsed.comparableKey && !parsed.needsReview) return "candidate_positive_only";
  if (parsed.listingType === "normal" || parsed.needsReview) return "manual_review_only";
  return "negative_hold_only";
}

const rows = cases.map((row) => {
  const parsed = parseGameConsoleListing(row.inputTitle, row.inputDescription ?? "", 100_000);
  const expected = expectedDecision(row.expectedClass);
  const actual = actualDecision(parsed);
  const pass = expected === actual || (row.expectedClass === "hold" && actual !== "candidate_positive_only");
  return {
    caseId: row.caseId,
    inputTitle: row.inputTitle,
    expectedClass: row.expectedClass,
    expectedDecision: expected,
    actualDecision: actual,
    listingType: parsed.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    platform: parsed.platform,
    edition: parsed.edition,
    bodyConfig: parsed.bodyConfig,
    reasons: parsed.reasons,
    blockerType: row.blockerType,
    pass,
    failureClass: pass
      ? null
      : row.expectedClass === "manual_review" && actual === "candidate_positive_only"
        ? "manual_review_gap_runtime_too_confident"
        : "decision_mismatch",
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
  category: "game_console_body_narrow",
  scope: "no-mutation runtime dry-run over game console body-narrow implementation-prep cases",
  inputFiles: ["reports/game-console-body-narrow-implementation-prep-latest.json"],
  metrics: {
    rows: rows.length,
    passedRows: rows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    positiveRows: rows.filter((row) => row.expectedClass === "positive").length,
    manualReviewRows: rows.filter((row) => row.expectedClass === "manual_review").length,
    holdRows: rows.filter((row) => row.expectedClass === "hold").length,
    candidatePositiveOnlyRows: rows.filter((row) => row.actualDecision === "candidate_positive_only").length,
    manualReviewOnlyRows: rows.filter((row) => row.actualDecision === "manual_review_only").length,
    negativeHoldOnlyRows: rows.filter((row) => row.actualDecision === "negative_hold_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "game_console_body_narrow_runtime_review_gate_gap_found"
    : "game_console_body_narrow_runtime_dry_run_matches_fixture",
  patchProposalNeeded: failedRows.length > 0,
  nextAction: "Proceed to desktop_pc_discovered no-mutation runtime dry-run; keep Switch 2 runtime policy as main-agent review item.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "game-console-no-mutation-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "game-console-no-mutation-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Game Console No-Mutation Runtime Dry-Run",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
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
  `- positive/manual/hold: ${report.metrics.positiveRows}/${report.metrics.manualReviewRows}/${report.metrics.holdRows}`,
  `- actual candidate/manual/negative: ${report.metrics.candidatePositiveOnlyRows}/${report.metrics.manualReviewOnlyRows}/${report.metrics.negativeHoldOnlyRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | listingType | comparableKey | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.actualDecision} | ${row.listingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`),
  "",
  "## Failed Rows",
  "",
  ...(failedRows.length
    ? failedRows.map((row) => `- ${row.caseId}: ${row.failureClass}, expected=${row.expectedDecision}, actual=${row.actualDecision}, title=${row.inputTitle}`)
    : ["- none"]),
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
  jsonPath,
  mdPath,
}, null, 2));
