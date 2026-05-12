import fs from "node:fs";
import path from "node:path";

type ReadinessBoard = {
  rows: Array<{
    category: string;
    status: string;
    rows: number;
    failedRows: number;
    candidatePositiveOnlyRows: number;
  }>;
};

const board = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "reports", "category-runtime-readiness-board-latest.json"), "utf8"),
) as ReadinessBoard;

const expansionPolicies: Record<
  string,
  {
    whyStillReportOnly: string;
    fixtureExpansionTargets: string[];
    holdCriteria: string[];
    nextReportOnlyArtifact: string;
  }
> = {
  monitor_discovered: {
    whyStillReportOnly: "Model-code rows are parser-ready, but runtime remains unwired and public approval is not in subagent scope.",
    fixtureExpansionTargets: [
      "LG/Samsung model-code positive rows with inch/refresh/resolution tokens",
      "monitor arm/stand/cable/adapter accessory-only negatives",
      "TV/tablet/laptop contamination negatives",
      "ambiguous panel-only or cracked-panel manual-review rows",
    ],
    holdCriteria: [
      "No public promotion until runtime patch and regression test are main-agent owned.",
      "Do not treat generic `모니터` without model-code/spec anchor as positive.",
    ],
    nextReportOnlyArtifact: "monitor fixture expansion and model-code spec evidence packet",
  },
  desktop_pc_discovered: {
    whyStillReportOnly: "CPU/GPU title-token parser evidence is useful, but full-unit versus part-only split needs broader fixture proof.",
    fixtureExpansionTargets: [
      "full desktop tower positives with CPU/GPU/RAM/storage bundle tokens",
      "CPU/GPU/RAM/SSD part-only negatives",
      "custom build partial-spec manual-review rows",
      "brand desktop model positives where official specs can verify model family",
    ],
    holdCriteria: [
      "No candidate-pool wiring until full-unit/part-only gate has regression coverage.",
      "Do not promote model family without enough spec and package-state evidence.",
    ],
    nextReportOnlyArtifact: "desktop full-unit versus part-only fixture expansion packet",
  },
  speaker_audio_discovered: {
    whyStillReportOnly: "Device-class split passes dry-run, but generic speaker and portable model overlap need more evidence.",
    fixtureExpansionTargets: [
      "JBL/Bose/Sony model-family positive rows with exact model tokens",
      "case/stand/cable/charger accessory-only negatives",
      "generic Bluetooth speaker rows as hold/manual-review",
      "soundbar versus portable speaker class split rows",
    ],
    holdCriteria: [
      "Do not accept generic speaker titles as matched-SKU positives.",
      "Keep device-class split report-only until model-family fixture set is denser.",
    ],
    nextReportOnlyArtifact: "speaker model-family and device-class fixture expansion packet",
  },
  camera_discovered: {
    whyStillReportOnly: "Camera package split passes dry-run, but lens/body/bundle false merge risk remains high.",
    fixtureExpansionTargets: [
      "body-only positives with model token and shutter/package condition",
      "lens-only negatives with mount/focal-length tokens",
      "body+lens kit manual-review rows",
      "accessory-only negatives for grip/battery/strap/case",
    ],
    holdCriteria: [
      "No public or runtime approval until body-only/lens-only/package split has stronger regression coverage.",
      "Treat kit and bundle rows as manual-review unless exact comparable-key policy exists.",
    ],
    nextReportOnlyArtifact: "camera body/lens/package false-merge regression packet",
  },
  home_appliance_tech_discovered: {
    whyStillReportOnly: "Vacuum subtype split passes dry-run, but appliance logistics/generic overlap needs more policy evidence.",
    fixtureExpansionTargets: [
      "robot vacuum model positives with exact model codes",
      "stick vacuum model positives with subtype tokens",
      "filter/battery/brush/stand accessory-only negatives",
      "generic appliance/logistics rows as hold/manual-review",
    ],
    holdCriteria: [
      "Do not promote broad appliance category; only exact model/subtype subsets can advance.",
      "Keep logistics/delivery/removal phrasing out of positive fixtures.",
    ],
    nextReportOnlyArtifact: "home-appliance vacuum subtype fixture expansion packet",
  },
};

const passRows = board.rows.filter((row) => row.status === "report_only_pass");
const queue = passRows.map((row, index) => ({
  priority: index + 1,
  category: row.category,
  rows: row.rows,
  failedRows: row.failedRows,
  candidatePositiveOnlyRows: row.candidatePositiveOnlyRows,
  ...expansionPolicies[row.category],
}));

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  scope: "fixture expansion queue for dry-run pass categories",
  metrics: {
    passCategoriesQueued: queue.length,
    ownerPatchItemsExcluded: board.rows.filter((row) => row.status === "owner_review_needed").length,
    blockedCategories: board.rows.filter((row) => row.status === "blocked").length,
  },
  queue,
  conclusion: "pass_category_fixture_expansion_queue_ready_report_only",
  nextAction:
    "Start with monitor model-code spec evidence packet, then desktop full-unit/part-only packet, while runtime patches remain main-agent owned.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "pass-category-fixture-expansion-queue-latest.json");
const mdPath = path.join(reportsDir, "pass-category-fixture-expansion-queue-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Pass Category Fixture Expansion Queue",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- passCategoriesQueued: ${report.metrics.passCategoriesQueued}`,
  `- ownerPatchItemsExcluded: ${report.metrics.ownerPatchItemsExcluded}`,
  `- blockedCategories: ${report.metrics.blockedCategories}`,
  "",
  "## Queue",
  "",
  ...queue.flatMap((item) => [
    `### P${item.priority} ${item.category}`,
    "",
    `- dry-run rows/failed: ${item.rows}/${item.failedRows}`,
    `- candidatePositiveOnlyRows: ${item.candidatePositiveOnlyRows}`,
    `- whyStillReportOnly: ${item.whyStillReportOnly}`,
    `- nextReportOnlyArtifact: ${item.nextReportOnlyArtifact}`,
    "",
    "Fixture expansion targets:",
    ...item.fixtureExpansionTargets.map((line) => `- ${line}`),
    "",
    "Hold criteria:",
    ...item.holdCriteria.map((line) => `- ${line}`),
    "",
  ]),
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      passCategoriesQueued: report.metrics.passCategoriesQueued,
      ownerPatchItemsExcluded: report.metrics.ownerPatchItemsExcluded,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
