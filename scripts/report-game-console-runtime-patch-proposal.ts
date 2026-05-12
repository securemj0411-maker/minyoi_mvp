import fs from "node:fs";
import path from "node:path";

type DryRun = {
  generatedAt: string;
  failedRows: Array<{
    caseId: string;
    inputTitle: string;
    expectedDecision: string;
    actualDecision: string;
    failureClass: string | null;
  }>;
  metrics: Record<string, number>;
};

const dryRun = JSON.parse(fs.readFileSync("reports/game-console-no-mutation-runtime-dry-run-latest.json", "utf8")) as DryRun;

const proposal = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  category: "game_console_body_narrow",
  scope: [
    "Game console body-narrow parser behavior only.",
    "Keep Nintendo Switch OLED/Lite/V2 positive fixtures intact.",
    "Keep Switch 2 as manual-review until separate current-product policy is approved.",
    "Keep PS5 Disc/Digital/Slim rows review-gated until edition policy is approved.",
  ],
  nonScope: [
    "whole game_console_discovered public readiness",
    "public promotion",
    "candidate pool wiring",
    "runtime catalog apply",
    "Supabase schema or DB writes",
    "cron/lifecycle/debug/pack UI changes",
    "broad game title/bundle/package policy",
  ],
  changedBehaviorSummary: [
    "Treat `닌텐도 스위치2 본체 풀박스` and other Switch 2 body/full-set rows as manual-review, not candidate_positive_only.",
    "Do not let Switch 2 inherit Nintendo Switch OLED/Lite/V2 comparable-key approval.",
    "Preserve existing positive body-narrow fixtures for Switch OLED full-set/body-only, Switch Lite, and V2 full-set.",
  ],
  positiveFixtures: [
    "GAME-CONSOLE-POS-01: 닌텐도 스위치 OLED 화이트 본체 풀박스",
    "GAME-CONSOLE-POS-02: 닌텐도 스위치 oled 본체만 판매",
    "GAME-CONSOLE-POS-03: [2024년형/일본판] 닌텐도 스위치 라이트 핑크 본체",
    "GAME-CONSOLE-POS-04: 닌텐도 스위치 배터리 개선판 본체 퍼플/오렌지 풀박스 s급",
  ],
  negativeHoldFixtures: [
    "GAME-CONSOLE-HOLD-01: buying post",
    "GAME-CONSOLE-HOLD-02: accessory/housing only",
    "GAME-CONSOLE-HOLD-03/HOLD-05: game title or bundle contamination",
    "GAME-CONSOLE-HOLD-04: damaged/parts",
  ],
  manualReviewFixtures: [
    "GAME-CONSOLE-MANUAL-01: PS5 Disc + game disc bundle",
    "GAME-CONSOLE-MANUAL-02: PS5 Digital + DualSense",
    "GAME-CONSOLE-MANUAL-03: Nintendo Switch unknown edition + game chip",
    "GAME-CONSOLE-MANUAL-04: Nintendo Switch OLED full box with body ambiguity",
    "GAME-CONSOLE-MANUAL-05: Nintendo Switch 2 body/full-set separate policy gate",
  ],
  affectedFilesProposal: [
    "mvp/src/lib/game-console-parser.ts: add explicit Switch 2 review gate or needsReview condition",
    "mvp/tests/core-rules.test.ts or focused game-console parser test: add Switch 2 manual-review regression",
    "mvp/scripts/report-game-console-no-mutation-runtime-dry-run.ts: keep verifying dry-run contract",
  ],
  codeOwner: "main-agent",
  riskLevel: "medium",
  rollbackNote: "Revert the Switch 2 manual-review gate and tests; no DB/candidate-pool migration is involved.",
  requiredVerificationCommands: [
    "npx tsx scripts/report-game-console-no-mutation-runtime-dry-run.ts",
    "npx tsx scripts/report-no-mutation-runtime-dry-run-rollup.ts",
    "npm run test:core",
    "npx eslint src/lib/game-console-parser.ts tests/core-rules.test.ts --max-warnings=0",
  ],
  ownerDecisionNeeded: true,
  failedRows: dryRun.failedRows,
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "game-console-runtime-patch-proposal-latest.json");
const mdPath = path.join(reportsDir, "game-console-runtime-patch-proposal-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(proposal, null, 2)}\n`);

const md = [
  "# Game Console Runtime Patch Proposal",
  "",
  `- generatedAt: ${proposal.generatedAt}`,
  "- category: game_console_body_narrow",
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
  ...proposal.failedRows.map((row) => `- ${row.caseId}: ${row.failureClass}, expected=${row.expectedDecision}, actual=${row.actualDecision}, title=${row.inputTitle}`),
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

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  category: proposal.category,
  failedRows: proposal.failedRows.length,
  jsonPath,
  mdPath,
}, null, 2));
