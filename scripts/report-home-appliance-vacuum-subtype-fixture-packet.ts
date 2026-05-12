import fs from "node:fs";
import path from "node:path";

type DryRun = {
  metrics: Record<string, number>;
  rows: Array<Record<string, unknown>>;
};

const dryRun = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "reports", "home-appliance-no-mutation-runtime-dry-run-latest.json"), "utf8"),
) as DryRun;

const fixtureGroups = [
  {
    group: "stick_handheld_model_ready_references",
    examples: ["LG 코드제로 A9 무선청소기", "다이슨 V10 무선청소기", "다이슨 V7 무선청소기", "삼성 비스포크 제트 무선청소기"],
    decision: "reference_only_not_runtime_candidate",
    requiredBeforeCandidate: [
      "exact model or series identity resolved",
      "stick/handheld subtype confirmed",
      "battery/charger/stand/accessory-only wording absent",
      "official model source attached for selected subset",
    ],
  },
  {
    group: "robot_vacuum_separate_axis",
    examples: ["클리엔 R9 로봇청소기", "NARWAL FREO 나르왈 프레오 로봇청소기", "샤오미 미지아 프로 물걸레 로봇청소기"],
    decision: "separate_subtype_hold_only",
    requiredBeforeCandidate: [
      "robot vacuum model identity resolved",
      "dock/base-station/water-mop package axis defined",
      "battery/new consumable replacement not treated as full-unit proof",
      "robot subtype kept separate from stick/handheld vacuum comparable keys",
    ],
  },
  {
    group: "bedding_or_generic_cleaner_holds",
    examples: ["퀸메이드 침구청소기", "침구청소기", "삼성 침구 청소기 판매", "샤오미 휴대용 미니 청소기 화이트"],
    decision: "negative_hold_only",
    requiredBeforeCandidate: [
      "bedding cleaner category separated from vacuum model-ready subset",
      "brand-only or generic cleaner wording remains hold",
      "bathroom/portable mini cleaner rows excluded unless exact supported subtype exists",
    ],
  },
  {
    group: "parts_accessory_logistics_exclusions",
    examples: ["다이슨 청소기 충전기 어댑터 205720-02", "filter/battery/brush/stand accessory-only rows", "delivery/install/removal logistics rows"],
    decision: "negative_hold_only",
    requiredBeforeCandidate: [
      "adapter/charger/battery/filter/brush/stand rows stay accessory-only",
      "logistics/install/removal wording remains outside product comparable keys",
      "row-level logistics examples still need export before regression fixtures",
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
  category: "home_appliance_tech_discovered",
  scope: "home appliance vacuum subtype fixture expansion packet",
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
    "Home appliance should not advance as a broad category; exact vacuum subtype/model subsets are the only viable path.",
    "Robot vacuum requires a separate dock/base-station/package axis before candidate review.",
    "Brand-only and generic vacuum rows are evidence for holds, not model-ready candidates.",
    "Parts/accessory/logistics rows must stay out of product comparable keys.",
  ],
  nextEvidenceNeeded: [
    "Official model sources for LG CodeZero A9, Dyson V7/V10, Samsung Bespoke Jet selected subset.",
    "Robot vacuum dock/base-station examples with exact model identity.",
    "Row-level logistics examples for delivery/install/removal exclusion fixtures.",
  ],
  nextAction:
    "Create home-appliance artifact consistency audit, then generate final pass-category expansion rollup.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "home-appliance-vacuum-subtype-fixture-packet-latest.json");
const mdPath = path.join(reportsDir, "home-appliance-vacuum-subtype-fixture-packet-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Home Appliance Vacuum Subtype Fixture Packet",
  "",
  `- generatedAt: ${report.generatedAt}`,
  "- category: home_appliance_tech_discovered",
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
    `- examples: ${group.examples.join(" / ")}`,
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
