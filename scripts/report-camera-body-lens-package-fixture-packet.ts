import fs from "node:fs";
import path from "node:path";

type DryRun = {
  metrics: Record<string, number>;
  rows: Array<Record<string, unknown>>;
};

const dryRun = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "reports", "camera-no-mutation-runtime-dry-run-latest.json"), "utf8"),
) as DryRun;

const fixtureGroups = [
  {
    group: "body_only_references",
    currentRows: ["소니 A7 풀프레임 미러리스 바디 ILCE-7 입문용", "소니 A7S2 풀프레임 미러리스 바디 (ILCE-7SM2)", "소니 a9 전투용바디 + 세로그립 판매합니다"],
    decision: "reference_only_not_runtime_candidate",
    mustNotMergeWith: ["lens_kit", "full_box_unknown_lens", "accessory_bundle"],
    requiredBeforeCandidate: [
      "body-only wording or model/body identity is explicit",
      "lens identity absent or explicitly excluded",
      "grip/battery/card/case accessories treated as extras, not lens-kit proof",
      "official model taxonomy is attached for selected body family",
    ],
  },
  {
    group: "true_lens_kit_references",
    currentRows: ["캐논 EOS Rebel T7 더블줌 키트"],
    decision: "reference_only_not_runtime_candidate",
    mustNotMergeWith: ["body_only", "full_box_without_lens_identity"],
    requiredBeforeCandidate: [
      "explicit lens-kit token exists",
      "lens identity or kit family is recoverable",
      "body model and kit configuration are both known",
    ],
  },
  {
    group: "full_box_or_accessory_bundle_manual",
    currentRows: ["소니 A7M3 풀프레임 카메라 풀박스 가격인하", "소니 NEX-5t화이트 + 배터리 SD카드 포함"],
    decision: "manual_or_hold_only",
    mustNotMergeWith: ["true_lens_kit"],
    requiredBeforeCandidate: [
      "full-box is packaging state, not lens-kit proof",
      "battery/card/case bundle is accessory inclusion, not kit lens proof",
      "manual review until package policy distinguishes full_box from lens_kit",
    ],
  },
  {
    group: "lens_or_accessory_hard_holds",
    currentRows: ["삼성 NX 20-50 부품용 렌즈", "마이크로포써드용 바디캡 + 렌즈 뒷캡"],
    decision: "negative_hold_only",
    mustNotMergeWith: ["camera_body_candidate"],
    requiredBeforeCandidate: [
      "lens-only rows require separate lens category policy",
      "cap/grip/battery/strap/case accessory rows stay out of camera body comparison",
      "damaged/parts wording remains hard hold",
    ],
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
  category: "camera_discovered",
  scope: "camera body/lens/package false-merge regression fixture packet",
  metrics: {
    dryRunRows: dryRun.metrics.rows,
    dryRunFailedRows: dryRun.metrics.failedRows,
    candidatePositiveOnlyRows: dryRun.metrics.candidatePositiveOnlyRows,
    fixtureGroups: fixtureGroups.length,
    runtimeApprovedRows: 0,
  },
  fixtureGroups,
  dryRunRows: dryRun.rows,
  policyImplications: [
    "Full-box/package wording must not be recovered as lens-kit without explicit lens identity.",
    "Body-only references must not merge with true lens-kit references.",
    "Lens-only resale and accessory-only rows need separate category policy or hard holds.",
    "Camera package_config should remain report-only until owner approves body/kit/full-box taxonomy.",
  ],
  nextEvidenceNeeded: [
    "Official body model taxonomy for selected Sony/Canon/Panasonic references.",
    "Explicit lens identity examples where listings include lens model names.",
    "Fixed-lens camera family packet separate from interchangeable-lens body/kit policy.",
  ],
  nextAction:
    "Create camera artifact consistency audit, then continue to home-appliance vacuum subtype fixture expansion packet.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "camera-body-lens-package-fixture-packet-latest.json");
const mdPath = path.join(reportsDir, "camera-body-lens-package-fixture-packet-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Camera Body Lens Package Fixture Packet",
  "",
  `- generatedAt: ${report.generatedAt}`,
  "- category: camera_discovered",
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- dryRunRows: ${report.metrics.dryRunRows}`,
  `- dryRunFailedRows: ${report.metrics.dryRunFailedRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  "",
  "## Fixture Groups",
  "",
  ...fixtureGroups.flatMap((group) => [
    `### ${group.group}`,
    "",
    `- decision: ${group.decision}`,
    `- currentRows: ${group.currentRows.join(" / ")}`,
    `- mustNotMergeWith: ${group.mustNotMergeWith.join(", ")}`,
    "",
    "Required before candidate:",
    ...group.requiredBeforeCandidate.map((line) => `- ${line}`),
    "",
  ]),
  "## Policy Implications",
  "",
  ...report.policyImplications.map((line) => `- ${line}`),
  "",
  "## Next Evidence Needed",
  "",
  ...report.nextEvidenceNeeded.map((line) => `- ${line}`),
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
