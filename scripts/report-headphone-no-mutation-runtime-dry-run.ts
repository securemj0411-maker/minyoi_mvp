import fs from "node:fs";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type ExpectedDecision = "candidate_positive_only" | "manual_review_only" | "negative_hold_only";

type FixtureRow = {
  caseId: string;
  inputTitle: string;
  inputDescription?: string;
  expectedClass: "positive" | "manual_review" | "hold";
  expectedDryRunDecision: ExpectedDecision;
  blockerType: string;
  notes?: string;
  accessoryOrPartTokens?: string[];
  classifierFocus?: string[];
};

type FixtureReport = {
  fixtureRows: FixtureRow[];
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8")) as T;
}

function runtimeDecision(listingType: string, comparableKey: string | null, needsReview: boolean): ExpectedDecision {
  if (listingType === "normal" && comparableKey && !needsReview) return "candidate_positive_only";
  if (listingType === "normal") return "manual_review_only";
  return "negative_hold_only";
}

const fixture = readJson<FixtureReport>("reports/headphone-repeat-dry-run-expanded-fixture-packet-latest.json");

const resultRows = fixture.fixtureRows.map((row) => {
  const description = row.inputDescription ?? "";
  const classified = classifyListing(row.inputTitle, description, 100_000);
  const matchedSku = ruleMatch(row.inputTitle, description);
  const parserSku = classified.sku ?? matchedSku;
  const parsed = parseListingOptions({
    title: row.inputTitle,
    description,
    category: "earphone",
    skuId: parserSku?.id ?? null,
    skuName: parserSku?.modelName ?? null,
  });
  const actualDryRunDecision = runtimeDecision(classified.listingType, parsed.comparableKey, parsed.needsReview);
  const pass = actualDryRunDecision === row.expectedDryRunDecision;
  return {
    caseId: row.caseId,
    inputTitle: row.inputTitle,
    expectedClass: row.expectedClass,
    expectedDryRunDecision: row.expectedDryRunDecision,
    actualDryRunDecision,
    runtimeListingType: classified.listingType,
    runtimeSkuId: classified.sku?.id ?? null,
    ruleMatchSkuId: matchedSku?.id ?? null,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    blockerType: row.blockerType,
    classifierFocus: row.classifierFocus ?? [],
    pass,
    failureClass: pass
      ? null
      : row.expectedDryRunDecision === "manual_review_only" && actualDryRunDecision === "candidate_positive_only"
        ? "manual_review_gap_runtime_too_confident"
        : row.expectedDryRunDecision === "negative_hold_only" && actualDryRunDecision === "candidate_positive_only"
          ? "negative_hold_leak"
          : "decision_mismatch",
  };
});

const failedRows = resultRows.filter((row) => !row.pass);
const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "headphone_discovered",
  scope: "no-mutation runtime dry-run over expanded headphone fixture packet",
  inputFiles: [
    "reports/headphone-repeat-dry-run-expanded-fixture-packet-latest.json",
    "reports/headphone-report-only-final-readiness-audit-latest.json",
    "reports/runtime-gap-expanded-audit-latest.json",
  ],
  metrics: {
    rows: resultRows.length,
    passedRows: resultRows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    candidatePositiveOnlyRows: resultRows.filter((row) => row.actualDryRunDecision === "candidate_positive_only").length,
    manualReviewOnlyRows: resultRows.filter((row) => row.actualDryRunDecision === "manual_review_only").length,
    negativeHoldOnlyRows: resultRows.filter((row) => row.actualDryRunDecision === "negative_hold_only").length,
    expectedCandidatePositiveOnlyRows: resultRows.filter((row) => row.expectedDryRunDecision === "candidate_positive_only").length,
    expectedManualReviewOnlyRows: resultRows.filter((row) => row.expectedDryRunDecision === "manual_review_only").length,
    expectedNegativeHoldOnlyRows: resultRows.filter((row) => row.expectedDryRunDecision === "negative_hold_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  failedRows,
  resultRows,
  decision: failedRows.length > 0
    ? "headphone_runtime_patch_proposal_required_before_runtime_review"
    : "headphone_runtime_dry_run_matches_report_only_fixture",
  nextStep: "Generate headphone runtime patch proposal for main-agent review; do not edit runtime files.",
};

const proposal = {
  generatedAt: report.generatedAt,
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  category: "headphone_discovered",
  scope: [
    "Matched headphone SKU classification/parser behavior only.",
    "Accessory-only case/pouch/cushion rows must not become normal candidates.",
    "AirPods Max ambiguous connector/generation rows must remain manual-review unless explicit accepted tokens and full-product context are present.",
  ],
  nonScope: [
    "public promotion",
    "candidate pool wiring",
    "runtime catalog apply",
    "Supabase schema or DB writes",
    "cron/lifecycle/debug/pack UI changes",
    "broad headphone_discovered readiness",
    "new Razer/Beats/B&O/Logitech/Corsair catalog expansion",
  ],
  changedBehaviorSummary: [
    "Treat model-code plus pouch/case-only headphone titles such as '보스 qc45 파우치' as accessory, not normal.",
    "Keep AirPods Max color-only or otherwise ambiguous connector/generation rows in manual review when fixture policy marks them manual.",
    "Preserve explicit positive rows for AirPods Max USB-C/Lightning, Sony XM5/CH520, and Bose QC Ultra full-product titles.",
  ],
  positiveFixtures: resultRows
    .filter((row) => row.expectedDryRunDecision === "candidate_positive_only")
    .map((row) => ({ caseId: row.caseId, title: row.inputTitle, expected: row.expectedDryRunDecision, actual: row.actualDryRunDecision })),
  negativeHoldFixtures: resultRows
    .filter((row) => row.expectedDryRunDecision === "negative_hold_only")
    .map((row) => ({ caseId: row.caseId, title: row.inputTitle, expected: row.expectedDryRunDecision, actual: row.actualDryRunDecision })),
  manualReviewFixtures: resultRows
    .filter((row) => row.expectedDryRunDecision === "manual_review_only")
    .map((row) => ({ caseId: row.caseId, title: row.inputTitle, expected: row.expectedDryRunDecision, actual: row.actualDryRunDecision, pass: row.pass })),
  controlFixtures: [
    "HEADPHONE-POS-03 must remain candidate_positive_only for Sony XM5 full-product wording.",
    "HEADPHONE-POS-04 must remain candidate_positive_only for Bose QC Ultra full-product wording.",
    "HEADPHONE-HOLD-01 must remain negative_hold_only for cushion/pad accessory wording.",
  ],
  affectedFilesProposal: [
    "mvp/src/lib/pipeline.ts: headphone/earphone accessory-only gate around case/pouch accessory tokens",
    "mvp/src/lib/option-parser.ts: AirPods Max ambiguous connector/generation review behavior if main-agent chooses parser-level fix",
    "mvp/tests/core-rules.test.ts or a new focused parser test file: add regression fixtures",
  ],
  codeOwner: "main-agent",
  riskLevel: failedRows.some((row) => row.failureClass === "negative_hold_leak") ? "high" : "medium",
  rollbackNote: "Revert the narrow headphone accessory/manual-review gate and associated tests; no DB or candidate-pool migration is involved.",
  requiredVerificationCommands: [
    "npx tsx scripts/report-headphone-no-mutation-runtime-dry-run.ts",
    "npx tsx scripts/report-runtime-gap-expanded-audit.ts",
    "npm run test:core",
    "npx eslint src/lib/pipeline.ts src/lib/option-parser.ts tests/core-rules.test.ts --max-warnings=0",
  ],
  ownerDecisionNeeded: true,
  failedRows,
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const dryRunJsonPath = path.join(reportsDir, "headphone-no-mutation-runtime-dry-run-latest.json");
const dryRunMdPath = path.join(reportsDir, "headphone-no-mutation-runtime-dry-run-latest.md");
const proposalJsonPath = path.join(reportsDir, "headphone-runtime-patch-proposal-latest.json");
const proposalMdPath = path.join(reportsDir, "headphone-runtime-patch-proposal-latest.md");

fs.writeFileSync(dryRunJsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(proposalJsonPath, `${JSON.stringify(proposal, null, 2)}\n`);

const dryRunMd = [
  "# Headphone No-Mutation Runtime Dry-Run",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- scope: ${report.scope}`,
  `- decision: ${report.decision}`,
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
  `- actual candidate/manual/negative: ${report.metrics.candidatePositiveOnlyRows}/${report.metrics.manualReviewOnlyRows}/${report.metrics.negativeHoldOnlyRows}`,
  `- expected candidate/manual/negative: ${report.metrics.expectedCandidatePositiveOnlyRows}/${report.metrics.expectedManualReviewOnlyRows}/${report.metrics.expectedNegativeHoldOnlyRows}`,
  "",
  "## Result Rows",
  "",
  "| caseId | expected | actual | listingType | sku | comparableKey | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...resultRows.map((row) => `| ${row.caseId} | ${row.expectedDryRunDecision} | ${row.actualDryRunDecision} | ${row.runtimeListingType} | ${row.runtimeSkuId ?? row.ruleMatchSkuId ?? "null"} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`),
  "",
  "## Failed Rows",
  "",
  ...(failedRows.length
    ? failedRows.map((row) => `- ${row.caseId}: ${row.failureClass}, expected=${row.expectedDryRunDecision}, actual=${row.actualDryRunDecision}, title=${row.inputTitle}`)
    : ["- none"]),
  "",
  "## Next Step",
  "",
  `- ${report.nextStep}`,
  "",
].join("\n");

const proposalMd = [
  "# Headphone Runtime Patch Proposal",
  "",
  `- generatedAt: ${proposal.generatedAt}`,
  "- category: headphone_discovered",
  "- codeOwner: main-agent",
  `- riskLevel: ${proposal.riskLevel}`,
  "- ownerDecisionNeeded: true",
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "",
  "## Scope",
  "",
  ...proposal.scope.map((line) => `- ${line}`),
  "",
  "## Non-Scope",
  "",
  ...proposal.nonScope.map((line) => `- ${line}`),
  "",
  "## Changed Behavior Summary",
  "",
  ...proposal.changedBehaviorSummary.map((line) => `- ${line}`),
  "",
  "## Failed Runtime Dry-Run Rows",
  "",
  ...(failedRows.length
    ? failedRows.map((row) => `- ${row.caseId}: ${row.failureClass}, expected=${row.expectedDryRunDecision}, actual=${row.actualDryRunDecision}, title=${row.inputTitle}`)
    : ["- none"]),
  "",
  "## Affected Files Proposal",
  "",
  ...proposal.affectedFilesProposal.map((line) => `- ${line}`),
  "",
  "## Required Verification Commands",
  "",
  ...proposal.requiredVerificationCommands.map((line) => `- \`${line}\``),
  "",
  "## Rollback Note",
  "",
  `- ${proposal.rollbackNote}`,
  "",
].join("\n");

fs.writeFileSync(dryRunMdPath, `${dryRunMd}\n`);
fs.writeFileSync(proposalMdPath, `${proposalMd}\n`);

console.log(JSON.stringify({
  decision: report.decision,
  rows: report.metrics.rows,
  failedRows: report.metrics.failedRows,
  dryRunJsonPath,
  dryRunMdPath,
  proposalJsonPath,
  proposalMdPath,
}, null, 2));
