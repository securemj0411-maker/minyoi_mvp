import fs from "node:fs";
import path from "node:path";

type DryRun = {
  metrics: Record<string, number>;
  rows: Array<{
    caseId: string;
    expected: string;
    actual: string;
    listingType: string;
    comparableKey: string | null;
    needsReview: boolean;
    pass: boolean;
  }>;
};

const dryRun = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "reports", "desktop-no-mutation-runtime-dry-run-latest.json"), "utf8"),
) as DryRun;

const fixtureGroups = [
  {
    group: "manual_full_unit_candidates",
    currentCaseIds: ["DESKTOP-MANUAL-01", "DESKTOP-MANUAL-02", "DESKTOP-MANUAL-03", "DESKTOP-MANUAL-04"],
    requiredSignals: [
      "desktop/full-unit body noun: 본체, 컴퓨터, PC, 데스크탑",
      "CPU identity resolved to known generation/model family",
      "GPU identity resolved to known generation/model family",
      "component-only wording absent",
      "commercial/mining/software-key risk absent",
    ],
    expansionTargets: [
      "Ryzen 7800X3D/9800X3D + RTX 4070/4080/5080 full-unit rows",
      "Intel Core Ultra/i7/i9 + RTX/Radeon full-unit rows",
      "RAM/SSD/warranty/newness as follow-up fields, not comparable-key gates",
      "brand desktop model rows only when model-family source evidence exists",
    ],
    decision: "manual_review_until_cpu_gpu_normalization_policy_exists",
  },
  {
    group: "part_only_hard_holds",
    currentCaseIds: ["DESKTOP-HOLD-01", "DESKTOP-HOLD-02", "DESKTOP-HOLD-03"],
    requiredSignals: [
      "GPU token without resolved CPU identity",
      "graphics-card-only or component-sale context",
      "price/context inconsistent with full desktop body",
    ],
    expansionTargets: [
      "GPU-only rows with `컴퓨터` bait wording",
      "CPU/RAM/SSD/case/PSU component-only rows",
      "full-set peripheral bundle rows that are not desktop bodies",
    ],
    decision: "hold_even_if_gpu_model_is_high_value",
  },
  {
    group: "commercial_mining_software_exclusions",
    currentCaseIds: ["DESKTOP-HOLD-04", "DESKTOP-HOLD-05"],
    requiredSignals: [
      "software/license key wording",
      "mining/node/ 위탁/월수익 style wording",
      "shop template or bulk office/PC-room wording",
    ],
    expansionTargets: [
      "Windows/Office key rows",
      "mining/node consignment rows",
      "commercial shop template rows",
      "PC-room/office bulk liquidation rows",
    ],
    decision: "hard_hold_not_candidate",
  },
];

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "desktop_pc_discovered",
  scope: "desktop full-unit versus part-only fixture expansion packet",
  metrics: {
    dryRunRows: dryRun.metrics.rows,
    dryRunFailedRows: dryRun.metrics.failedRows,
    manualRows: dryRun.metrics.manualRows ?? 4,
    holdRows: dryRun.metrics.holdRows ?? 5,
    candidatePositiveOnlyRows: dryRun.metrics.candidatePositiveOnlyRows,
    fixtureGroups: fixtureGroups.length,
    runtimeApprovedRows: 0,
  },
  fixtureGroups,
  dryRunRows: dryRun.rows,
  policyImplications: [
    "Desktop progress should move through full-unit/part-only split first, not broad category promotion.",
    "CPU+GPU title tokens are evidence, not enough for positive candidate wiring without normalization policy.",
    "GPU-only rows must remain hold even when title contains generic `컴퓨터` wording.",
    "RAM/SSD/warranty/newness are useful follow-up fields but should not be required comparable-key dimensions in this phase.",
  ],
  ownerQuestions: [
    "Which CPU/GPU normalization surface is allowed for first runtime patch: exact token only, family bucket, or manual-review only?",
    "Should new/current GPU families such as RTX 50 and RX 9000 remain manual until official taxonomy is stored?",
    "Should configurable shop templates be permanently excluded from one-off used desktop comparisons?",
  ],
  nextAction:
    "Create desktop artifact consistency audit, then continue to speaker model-family/device-class fixture expansion packet.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "desktop-full-unit-part-split-fixture-packet-latest.json");
const mdPath = path.join(reportsDir, "desktop-full-unit-part-split-fixture-packet-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Desktop Full-Unit Part-Split Fixture Packet",
  "",
  `- generatedAt: ${report.generatedAt}`,
  "- category: desktop_pc_discovered",
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- dryRunRows: ${report.metrics.dryRunRows}`,
  `- dryRunFailedRows: ${report.metrics.dryRunFailedRows}`,
  `- manualRows: ${report.metrics.manualRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  "",
  "## Fixture Groups",
  "",
  ...fixtureGroups.flatMap((group) => [
    `### ${group.group}`,
    "",
    `- decision: ${group.decision}`,
    `- currentCaseIds: ${group.currentCaseIds.join(", ")}`,
    "",
    "Required signals:",
    ...group.requiredSignals.map((line) => `- ${line}`),
    "",
    "Expansion targets:",
    ...group.expansionTargets.map((line) => `- ${line}`),
    "",
  ]),
  "## Policy Implications",
  "",
  ...report.policyImplications.map((line) => `- ${line}`),
  "",
  "## Owner Questions",
  "",
  ...report.ownerQuestions.map((line) => `- ${line}`),
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
      category: report.category,
      dryRunRows: report.metrics.dryRunRows,
      dryRunFailedRows: report.metrics.dryRunFailedRows,
      fixtureGroups: report.metrics.fixtureGroups,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
