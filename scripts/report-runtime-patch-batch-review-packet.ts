import fs from "node:fs";
import path from "node:path";

type ProposalReport = {
  category: string;
  failedRows: Array<{
    caseId: string;
    inputTitle: string;
    expectedDecision: string;
    actualDecision: string;
    failureClass: string | null;
  }>;
  changedBehaviorSummary?: string[];
  affectedFilesProposal?: string[];
  requiredVerificationCommands?: string[];
};

type RollupReport = {
  totals: Record<string, number>;
  patchReviewQueue: Array<{
    priority: number;
    category: string;
    reason: string;
    owner: string;
  }>;
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "reports", file), "utf8")) as T;
}

function findLineNumber(source: string, needle: string): number | null {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(needle));
  return index === -1 ? null : index + 1;
}

const headphoneProposal = readJson<ProposalReport>("headphone-runtime-patch-proposal-latest.json");
const gameConsoleProposal = readJson<ProposalReport>("game-console-runtime-patch-proposal-latest.json");
const rollup = readJson<RollupReport>("no-mutation-runtime-dry-run-rollup-latest.json");
const coreRulesPath = path.join(process.cwd(), "tests", "core-rules.test.ts");
const coreRules = fs.readFileSync(coreRulesPath, "utf8");

const testAnchors = [
  {
    category: "headphone_discovered",
    anchor: "headphone standalone cushion and case listings stay excluded",
    line: findLineNumber(coreRules, "headphone standalone cushion and case listings stay excluded"),
    proposedRegression: "Add `보스 qc45 파우치` as accessory-only regression beside existing headphone cushion/case exclusions.",
    ownerDecisionRequired: false,
  },
  {
    category: "headphone_discovered",
    anchor: "AirPods Max Lightning generation parses separately from USB-C",
    line: findLineNumber(coreRules, "AirPods Max Lightning generation parses separately from USB-C"),
    proposedRegression:
      "Review whether color-only `에어팟 맥스 스페이스 그레이` should become manual-review without breaking explicit Lightning full-box acceptance.",
    ownerDecisionRequired: true,
  },
  {
    category: "headphone_discovered",
    anchor: "full-size headphone bare-unit wording is not treated as earbud parts",
    line: findLineNumber(coreRules, "full-size headphone bare-unit wording is not treated as earbud parts"),
    proposedRegression:
      "Treat the `8핀 판매` dry-run row as a policy-tension case: fixture asks manual-review, while existing explicit Lightning behavior may intentionally accept it.",
    ownerDecisionRequired: true,
  },
  {
    category: "game_console_body_narrow",
    anchor: "game console parser avoids Switch 2 leakage and narrows clear Switch Lite configs",
    line: findLineNumber(coreRules, "game console parser avoids Switch 2 leakage and narrows clear Switch Lite configs"),
    proposedRegression:
      "Add direct `닌텐도 스위치2 본체 풀박스` manual-review assertion until separate Switch 2 current-product policy is approved.",
    ownerDecisionRequired: true,
  },
];

const patchItems = [
  headphoneProposal.failedRows.length > 0
    ? {
        priority: 1,
        category: headphoneProposal.category,
        owner: "main-agent",
        status: "owner_review_required",
        summary: "Headphone runtime still has AirPods Max manual-review policy gaps.",
        failedRows: headphoneProposal.failedRows,
        changedBehaviorSummary: headphoneProposal.changedBehaviorSummary ?? [],
        affectedFilesProposal: headphoneProposal.affectedFilesProposal ?? [],
        decisionNotes: [
          "`에어팟 맥스 스페이스 그레이` color-only manual-review is plausible because generation/connector is ambiguous.",
          "`에어팟 맥스 스페이스 그레이 8핀 판매` conflicts with existing Lightning-positive parser behavior unless owner wants stricter full-product context.",
        ],
      }
    : null,
  gameConsoleProposal.failedRows.length > 0
    ? {
        priority: 2,
        category: gameConsoleProposal.category,
        owner: "main-agent",
        status: "owner_review_required",
        summary: "Switch 2 body/full-set row is too confidently accepted before separate current-product policy.",
        failedRows: gameConsoleProposal.failedRows,
        changedBehaviorSummary: gameConsoleProposal.changedBehaviorSummary ?? [],
        affectedFilesProposal: gameConsoleProposal.affectedFilesProposal ?? [],
        decisionNotes: [
          "Switch 2 should not inherit Switch OLED/Lite/V2 comparable-key approval.",
          "Existing Switch 2 contamination test protects mentions in description, but direct title `닌텐도 스위치2 본체 풀박스` still needs review-gate coverage.",
        ],
      }
    : null,
].filter((item): item is NonNullable<typeof item> => item !== null);

const activeRegressionTestPlan = testAnchors.filter((row) => {
  if (row.proposedRegression.includes("보스 qc45 파우치")) {
    return headphoneProposal.failedRows.some((failed) => failed.inputTitle.includes("보스 qc45"));
  }
  if (row.category === "game_console_body_narrow") {
    return gameConsoleProposal.failedRows.length > 0;
  }
  if (row.category === "headphone_discovered") {
    return headphoneProposal.failedRows.length > 0;
  }
  return true;
});

const packet = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  forbiddenRuntimeFilesEdited: false,
  scope: [
    "Batch review packet for main-agent owned runtime patch decisions.",
    "Headphone and game-console dry-run failures only.",
    "Regression test placement plan only; no runtime/test mutation performed by this script.",
  ],
  nonScope: [
    "src/lib runtime edits",
    "Supabase schema or production DB writes",
    "cron/lifecycle/source-health/pack UI changes",
    "public promotion or runtime catalog apply",
    "candidate-pool policy wiring",
    "direct 30일_실행계획.md edits",
  ],
  rollupTotals: rollup.totals,
  patchReviewQueue: rollup.patchReviewQueue,
  patchItems,
  regressionTestPlan: activeRegressionTestPlan,
  ownerDecisionMatrix: patchItems.length > 0
    ? [
        {
          decision: "review_airpods_max_manual_policy",
          effect: "Decide whether AirPods Max color-only and `8핀 판매` rows should be review-gated or accepted as current Lightning behavior.",
          residualRisk: "Changing this without policy confirmation can over-block valid AirPods Max Lightning listings.",
        },
        {
          decision: "adjust_fixture_policy",
          effect: "Keep explicit Lightning acceptance and modify report fixture expectation only after owner policy confirms acceptance.",
          residualRisk: "Parser remains more permissive; artifact must clearly say why.",
        },
      ]
    : [],
  requiredVerificationCommands: Array.from(
    new Set([
      ...(headphoneProposal.requiredVerificationCommands ?? []),
      ...(gameConsoleProposal.requiredVerificationCommands ?? []),
      "npx tsx scripts/report-runtime-patch-batch-review-packet.ts",
      "npx eslint scripts/report-runtime-patch-batch-review-packet.ts --max-warnings=0",
    ]),
  ),
  nextAction: patchItems.length > 0
    ? "Review remaining owner-policy rows before any additional runtime patch."
    : "Patch queue is clear; keep expanding report-only readiness queue unless main-agent starts another patch implementation.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "runtime-patch-batch-review-packet-latest.json");
const mdPath = path.join(reportsDir, "runtime-patch-batch-review-packet-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

const md = [
  "# Runtime Patch Batch Review Packet",
  "",
  `- generatedAt: ${packet.generatedAt}`,
  "- reportOnly: true",
  "- owner: main-agent",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Scope",
  "",
  ...packet.scope.map((line) => `- ${line}`),
  "",
  "## Non-Scope",
  "",
  ...packet.nonScope.map((line) => `- ${line}`),
  "",
  "## Rollup Totals",
  "",
  `- rows/probes: ${packet.rollupTotals.rows}`,
  `- failed/leak rows: ${packet.rollupTotals.failedRows}`,
  `- runtimeApproved/public/candidatePool rows: ${packet.rollupTotals.runtimeApprovedRows}/${packet.rollupTotals.publicPromotionRows}/${packet.rollupTotals.candidatePoolWiringRows}`,
  "",
  "## Patch Items",
  "",
  ...packet.patchItems.flatMap((item) => [
    `### P${item.priority} ${item.category}`,
    "",
    `- status: ${item.status}`,
    `- summary: ${item.summary}`,
    "",
    "Failed rows:",
    ...item.failedRows.map(
      (row) =>
        `- ${row.caseId}: ${row.failureClass}, expected=${row.expectedDecision}, actual=${row.actualDecision}, title=${row.inputTitle}`,
    ),
    "",
    "Decision notes:",
    ...item.decisionNotes.map((line) => `- ${line}`),
    "",
  ]),
  "## Regression Test Plan",
  "",
  "| category | existing anchor | line | proposed regression | owner decision required |",
  "| --- | --- | ---: | --- | --- |",
  ...packet.regressionTestPlan.map(
    (row) =>
      `| ${row.category} | ${row.anchor} | ${row.line ?? "n/a"} | ${row.proposedRegression} | ${row.ownerDecisionRequired ? "yes" : "no"} |`,
  ),
  "",
  "## Owner Decision Matrix",
  "",
  ...packet.ownerDecisionMatrix.map(
    (row) => `- ${row.decision}: ${row.effect} Residual risk: ${row.residualRisk}`,
  ),
  "",
  "## Required Verification Commands",
  "",
  ...packet.requiredVerificationCommands.map((line) => `- \`${line}\``),
  "",
  "## Next Action",
  "",
  `- ${packet.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      reportOnly: packet.reportOnly,
      patchItems: packet.patchItems.length,
      regressionAnchors: packet.regressionTestPlan.length,
      ownerDecisionRequired: packet.regressionTestPlan.filter((row) => row.ownerDecisionRequired).length,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
