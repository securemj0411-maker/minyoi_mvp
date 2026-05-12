import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Wave3Report = {
  reportOnly: boolean;
  category: string;
  lane: string;
  conclusion: string;
  boundary: Boundary;
  metrics: {
    queriedRows: number;
    reviewedRows: number;
    positiveRows: number;
    manualRows: number;
    holdRows: number;
    positiveFamilyGroups: number;
    contaminationBuckets: Record<string, number>;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
    evidenceGoalMet: boolean;
  };
  rows: Array<{
    caseId: string;
    title: string;
    contaminationBucket: string;
    decision: string;
    modelKey: string | null;
    completeSetSignal: string;
  }>;
};

type Boundary = {
  reportOnly: boolean;
  runtimeApprovedRows: number;
  publicPromotionRows: number;
  candidatePoolRows: number;
  runtimeApplyRows: number;
  runtimeCatalogApply: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
};

type GenericBoundaryReport = {
  metrics: {
    evidenceRows?: number;
    modelReadyVacuumRows?: number;
    expandedGenericVacuumRows?: number;
    genericClassCounts?: Array<{ key: string; count: number }>;
    runtimeApprovedRows: number;
  };
};

type EvidenceSource = {
  label: string;
  url: string;
  sourceType: "official_product" | "official_support_pdf" | "official_manual" | "official_newsroom" | "reliable_secondary";
  supports: string[];
  statusNote: string;
};

type LaneEvidence = {
  lane: "stick_vacuum_complete_set" | "robot_vacuum" | "wet_dry_mop" | "portable_cleaner";
  recommendation: "pause" | "split_hold" | "pivot_candidate";
  evidenceQuality: "strong" | "medium" | "thin";
  marketSignal: string;
  sourceEvidence: EvidenceSource[];
  boundaryRule: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const inputFiles = [
  "reports/subagent-source-backfill-wave-2026-05-12.md",
  "reports/home-appliance-stick-vacuum-targeted-acquisition-wave3-latest.md",
  "reports/home-appliance-stick-vacuum-targeted-acquisition-wave3-latest.json",
  "reports/home-appliance-stick-vacuum-targeted-acquisition-wave2-latest.json",
  "reports/home-appliance-stick-vacuum-targeted-acquisition-latest.json",
  "reports/home-appliance-stick-vacuum-complete-set-contract-latest.json",
  "reports/home-appliance-vacuum-subtype-boundary-evidence-latest.json",
  "reports/home-appliance-vacuum-subtype-split-prep-latest.json",
  "reports/home-appliance-generic-vacuum-exclusion-readiness-latest.json",
];

const globalBoundary = {
  reportOnly: true,
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

const sourceBackfill: LaneEvidence[] = [
  {
    lane: "stick_vacuum_complete_set",
    recommendation: "pause",
    evidenceQuality: "medium",
    marketSignal:
      "Wave3 found 0 strict positives and Samsung Bespoke Jet rows repeatedly carried wet/mop or sold-only contamination.",
    boundaryRule:
      "Keep stick-vacuum complete-set as a held sublane until exact model, main unit, charger/station, and head/tool evidence are present without mop/wet-dry or sold-only contamination.",
    sourceEvidence: [
      {
        label: "Samsung Bespoke Jet official product page",
        url: "https://www.samsung.com/us/home-appliances/vacuums/bespoke/bespoke-jet-pet-cordless-stick-vacuum-with-all-in-one-clean-station-in-misty-white-vs20a9582vw-aa",
        sourceType: "official_product",
        supports: ["Bespoke Jet identity", "cordless stick vacuum class", "All-in-One Clean Station axis"],
        statusNote: "Official product evidence supports model family and station axis, but wave3 market rows were not clean strict positives.",
      },
      {
        label: "LG CordZero A9 official product page",
        url: "https://www.lg.com/us/vacuum-cleaners/lg-a913bm-stick-vacuum/",
        sourceType: "official_product",
        supports: ["CordZero A9 identity", "cordless stick vacuum class"],
        statusNote: "Official evidence supports stick-vacuum identity; prior waves already leaned on Dyson/LG and wave3 intentionally excluded them.",
      },
      {
        label: "Dyson V10 official user manual",
        url: "https://www.dyson.com/content/dam/dyson/maintenance/user-guides/en_US/vacuumcleaners/cordlessstickvacuums/sv10/Dyson%20V10%20User%20Manual.pdf",
        sourceType: "official_manual",
        supports: ["Dyson V10 identity", "cordless vacuum class", "attachment/component axes"],
        statusNote: "Useful for component/complete-set expectations, but not a reason to reopen broad stick-vacuum runtime scope.",
      },
    ],
  },
  {
    lane: "robot_vacuum",
    recommendation: "pivot_candidate",
    evidenceQuality: "strong",
    marketSignal:
      "Wave3 contamination had 9 robot-vacuum rows, the largest single bucket; subtype reports already keep robot vacuum as a separate held axis.",
    boundaryRule:
      "Robot vacuum should be a separate lane with brand/model plus dock/base/mop station axes; never merge into stick/handheld complete-set keys.",
    sourceEvidence: [
      {
        label: "Narwal Freo Korea official product page",
        url: "https://kr.narwal.com/products/narwal-freo",
        sourceType: "official_product",
        supports: ["Narwal Freo identity", "robot vacuum class", "mop/base station boundary"],
        statusNote: "Official regional product page supports robot-vacuum/mop separation.",
      },
      {
        label: "Roborock S8 official support manual",
        url: "https://support.roborock.com/hc/en-us/article_attachments/46135352812697",
        sourceType: "official_support_pdf",
        supports: ["Roborock S8 identity", "robotic vacuum cleaner class"],
        statusNote: "Official support/manual evidence supports robot model identity and separate lane treatment.",
      },
      {
        label: "LG CordZero R9 ThinQ official product experience page",
        url: "https://www.lg.com/us/lg-thinq-appliances/m/products/lg-cordzero-r9-thinq/index.html",
        sourceType: "official_product",
        supports: ["LG CordZero R9 identity", "robot vacuum class"],
        statusNote: "Official LG evidence supports R9 as robot vacuum, not stick vacuum.",
      },
    ],
  },
  {
    lane: "wet_dry_mop",
    recommendation: "split_hold",
    evidenceQuality: "medium",
    marketSignal:
      "Wave3 had 7 wet-dry/mop rows, often overlapping Samsung Jet wording and complete-set terms.",
    boundaryRule:
      "Wet-dry/mop rows must be split from dry stick-vacuum complete-set rows and require explicit wet/mop model class evidence before any observation lane.",
    sourceEvidence: [
      {
        label: "BISSELL CrossWave Cordless Max official product page",
        url: "https://www.bissell.com/en-us/product/crosswave-cordless-max-multi-surface-wet-dry-vac-2554A.html",
        sourceType: "official_product",
        supports: ["CrossWave Cordless Max identity", "wet dry vacuum class", "multi-surface cleaner axis"],
        statusNote: "Official product evidence supports wet-dry class separation.",
      },
      {
        label: "Samsung Bespoke Jet AI official PDF",
        url: "https://image-us.samsung.com/SamsungUS/home/05242023/VS28C9762UK_Bespoke_JetAI_National_V10.pdf",
        sourceType: "official_support_pdf",
        supports: ["Bespoke Jet AI identity", "stick vacuum class", "wet accessory caveat"],
        statusNote: "Official PDF notes wet function is accessory-dependent, reinforcing mop/wet accessory boundary risk.",
      },
    ],
  },
  {
    lane: "portable_cleaner",
    recommendation: "split_hold",
    evidenceQuality: "medium",
    marketSignal:
      "Subtype boundary evidence has stick/handheld generic rows and missing model identity; portable mini cleaners are cleaner than broad stick terms but still need exact-model samples.",
    boundaryRule:
      "Portable/handheld mini cleaners need their own exact-model lane; do not combine with full-size stick complete sets or accessory-only rows.",
    sourceEvidence: [
      {
        label: "Xiaomi Mi Vacuum Cleaner Mini official product page",
        url: "https://www.mi.com/es/product/mi-vacuum-cleaner-mini-eu/",
        sourceType: "official_product",
        supports: ["Mi Vacuum Cleaner Mini identity", "portable/mini cleaner class"],
        statusNote: "Official regional page supports a portable-cleaner subtype, but current market rows are too thin for next-lane recommendation.",
      },
    ],
  },
];

function mdEscape(value: unknown): string {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function table(headers: string[], rows: unknown[][]): string {
  return [
    `| ${headers.map(mdEscape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
  ].join("\n");
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(appDir, relativePath), "utf8");
}

function contaminationRows(wave3: Wave3Report): Array<{ bucket: string; rows: number }> {
  return Object.entries(wave3.metrics.contaminationBuckets)
    .map(([bucket, rows]) => ({ bucket, rows }))
    .sort((a, b) => b.rows - a.rows);
}

function countEvidenceSources(sourceType: EvidenceSource["sourceType"]): number {
  return sourceBackfill.flatMap((lane) => lane.sourceEvidence).filter((source) => source.sourceType === sourceType).length;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [workOrderMd, wave3, subtypeBoundary, genericReadiness] = await Promise.all([
    readText("reports/subagent-source-backfill-wave-2026-05-12.md"),
    readJson<Wave3Report>("reports/home-appliance-stick-vacuum-targeted-acquisition-wave3-latest.json"),
    readJson<GenericBoundaryReport>("reports/home-appliance-vacuum-subtype-boundary-evidence-latest.json"),
    readJson<GenericBoundaryReport>("reports/home-appliance-generic-vacuum-exclusion-readiness-latest.json"),
  ]);

  const contamination = contaminationRows(wave3);
  const robotRows = wave3.metrics.contaminationBuckets.robot_vacuum ?? 0;
  const wetDryRows = wave3.metrics.contaminationBuckets.wet_dry_or_mop ?? 0;
  const strictStickPositiveRows = wave3.metrics.positiveRows;
  const recommendation = strictStickPositiveRows === 0 && robotRows > wetDryRows
    ? "pause_broad_stick_vacuum_split_boundaries_pivot_robot_vacuum_source_backfill"
    : "pause_broad_stick_vacuum_split_boundaries_continue_source_review";

  const checks = [
    {
      id: "HOME-SCOPE-01",
      status: workOrderMd.includes("Home Appliance Scope Redefinition Source Backfill") ? "pass" : "fail",
      check: "governing work order includes this lane",
      detail: "subagent-source-backfill-wave-2026-05-12.md",
    },
    {
      id: "HOME-SCOPE-02",
      status: wave3.metrics.evidenceGoalMet === false && wave3.metrics.positiveRows === 0 ? "pass" : "fail",
      check: "wave3 stick-vacuum acquisition failed strict positive goal",
      detail: `positiveRows=${wave3.metrics.positiveRows}, evidenceGoalMet=${wave3.metrics.evidenceGoalMet}`,
    },
    {
      id: "HOME-SCOPE-03",
      status: robotRows >= 1 && wetDryRows >= 1 ? "pass" : "fail",
      check: "wave3 supports robot and wet-dry/mop boundary split",
      detail: `robot=${robotRows}, wetDry=${wetDryRows}`,
    },
    {
      id: "HOME-SCOPE-04",
      status: sourceBackfill.every((lane) => lane.sourceEvidence.length > 0) ? "pass" : "fail",
      check: "each proposed lane has official/reliable source evidence",
      detail: `sourceEvidenceRows=${sourceBackfill.flatMap((lane) => lane.sourceEvidence).length}`,
    },
    {
      id: "HOME-SCOPE-05",
      status: wave3.boundary.runtimeApprovedRows === 0 &&
        wave3.boundary.publicPromotionRows === 0 &&
        wave3.boundary.candidatePoolRows === 0 &&
        wave3.boundary.runtimeApplyRows === 0
        ? "pass"
        : "fail",
      check: "wave3 boundary rows remain closed",
      detail: "runtime/public/candidate/runtimeApply=0/0/0/0",
    },
  ];
  const failedChecks = checks.filter((check) => check.status === "fail");

  const report = {
    generatedAt,
    category: wave3.category,
    lane: "home_appliance_scope_redefinition_source_backfill",
    reportOnly: true,
    conclusion: failedChecks.length === 0
      ? recommendation
      : "home_appliance_scope_redefinition_source_backfill_blocked",
    recommendedNextLane: "robot_vacuum_model_dock_source_backfill",
    broadStickVacuumDecision: "pause",
    splitDecision: "split vacuum into stick_complete_set, robot_vacuum, wet_dry_mop, and portable_cleaner evidence lanes",
    pivotDecision: "pivot to robot vacuum source backfill first because wave3 robot contamination is strongest and official model/dock evidence is cleanly separable",
    boundary: globalBoundary,
    metrics: {
      wave3QueriedRows: wave3.metrics.queriedRows,
      wave3ReviewedRows: wave3.metrics.reviewedRows,
      wave3PositiveRows: wave3.metrics.positiveRows,
      wave3ManualRows: wave3.metrics.manualRows,
      wave3HoldRows: wave3.metrics.holdRows,
      wave3EvidenceGoalMet: wave3.metrics.evidenceGoalMet,
      robotVacuumContaminationRows: robotRows,
      wetDryOrMopContaminationRows: wetDryRows,
      soldOnlyRows: wave3.metrics.contaminationBuckets.sold_only_or_title_sold ?? 0,
      missingExactModelRows: wave3.metrics.contaminationBuckets.missing_exact_model ?? 0,
      subtypeBoundaryEvidenceRows: subtypeBoundary.metrics.evidenceRows ?? subtypeBoundary.metrics.expandedGenericVacuumRows ?? 0,
      genericVacuumRows: genericReadiness.metrics.expandedGenericVacuumRows ?? 0,
      laneEvidenceRows: sourceBackfill.length,
      sourceEvidenceRows: sourceBackfill.flatMap((lane) => lane.sourceEvidence).length,
      officialProductSources: countEvidenceSources("official_product"),
      officialManualOrPdfSources: countEvidenceSources("official_manual") + countEvidenceSources("official_support_pdf"),
      reliableSecondarySources: countEvidenceSources("reliable_secondary"),
      checks: checks.length,
      failedChecks: failedChecks.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    contaminationBuckets: contamination,
    laneEvidence: sourceBackfill,
    boundaryFindings: [
      "Stick vacuum complete-set evidence exists, but wave3 broad acquisition produced 0 positives and should pause until exact-model complete-set samples are cleaner.",
      "Robot vacuum appeared as the dominant wave3 contamination bucket and should be split into a separate robot brand/model/dock lane.",
      "Wet-dry/mop rows are common enough to require their own held boundary; do not let mop/wet accessory evidence satisfy dry stick-vacuum complete-set policy.",
      "Portable/handheld mini cleaners have official model evidence but need exact live market samples before they become the next lane.",
    ],
    blockedHoldBoundaries: [
      "sold-only/title-sold rows",
      "missing exact model rows",
      "brand-only vacuum rows",
      "robot vacuum rows inside stick-vacuum searches",
      "wet-dry/mop rows inside stick-vacuum searches",
      "bedding cleaner rows",
      "accessory/filter/battery/stand rows",
      "generic appliance or unrelated full-set rows",
    ],
    checks,
    failedChecks,
    inputFiles,
    nextAction:
      "Pause broad stick-vacuum acquisition; create a report-only robot vacuum model/dock source-backfill lane before any internal observation or runtime discussion.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "home-appliance-scope-redefinition-source-backfill-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const md = [
    "# Home Appliance Scope Redefinition Source Backfill",
    "",
    `- generatedAt: ${generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    `- recommendedNextLane: ${report.recommendedNextLane}`,
    `- broadStickVacuumDecision: ${report.broadStickVacuumDecision}`,
    "- public gate closed: true",
    "- runtime/candidate/public apply: false",
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: false/false/false/false",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "",
    "## Wave3 Failure Summary",
    "",
    table(
      ["metric", "value"],
      [
        ["queriedRows", report.metrics.wave3QueriedRows],
        ["reviewedRows", report.metrics.wave3ReviewedRows],
        ["positiveRows", report.metrics.wave3PositiveRows],
        ["manualRows", report.metrics.wave3ManualRows],
        ["holdRows", report.metrics.wave3HoldRows],
        ["evidenceGoalMet", report.metrics.wave3EvidenceGoalMet],
      ],
    ),
    "",
    "## Contamination Buckets",
    "",
    table(
      ["bucket", "rows"],
      contamination.map((row) => [row.bucket, row.rows]),
    ),
    "",
    "## Scope Decision",
    "",
    `- ${report.splitDecision}`,
    `- ${report.pivotDecision}`,
    "",
    "## Lane Source Evidence",
    "",
    table(
      ["lane", "recommendation", "quality", "marketSignal", "boundaryRule"],
      sourceBackfill.map((lane) => [
        lane.lane,
        lane.recommendation,
        lane.evidenceQuality,
        lane.marketSignal,
        lane.boundaryRule,
      ]),
    ),
    "",
    "## Source Evidence Details",
    "",
    table(
      ["lane", "sourceType", "label", "url", "supports", "statusNote"],
      sourceBackfill.flatMap((lane) =>
        lane.sourceEvidence.map((source) => [
          lane.lane,
          source.sourceType,
          source.label,
          source.url,
          source.supports.join("; "),
          source.statusNote,
        ]),
      ),
    ),
    "",
    "## Boundary Findings",
    "",
    ...report.boundaryFindings.map((item) => `- ${item}`),
    "",
    "## Blocked / Hold Boundaries",
    "",
    ...report.blockedHoldBoundaries.map((item) => `- ${item}`),
    "",
    "## Checks",
    "",
    table(
      ["id", "status", "check", "detail"],
      checks.map((check) => [check.id, check.status, check.check, check.detail]),
    ),
    "",
    "## Inputs Read",
    "",
    ...inputFiles.map((file) => `- ${file}`),
    "",
    "## Next Action",
    "",
    report.nextAction,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-scope-redefinition-source-backfill-latest.md"), md);

  console.log(JSON.stringify({
    report: "reports/home-appliance-scope-redefinition-source-backfill-latest",
    conclusion: report.conclusion,
    recommendedNextLane: report.recommendedNextLane,
    broadStickVacuumDecision: report.broadStickVacuumDecision,
    wave3PositiveRows: report.metrics.wave3PositiveRows,
    robotVacuumContaminationRows: report.metrics.robotVacuumContaminationRows,
    wetDryOrMopContaminationRows: report.metrics.wetDryOrMopContaminationRows,
    sourceEvidenceRows: report.metrics.sourceEvidenceRows,
    failedChecks: report.metrics.failedChecks,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
