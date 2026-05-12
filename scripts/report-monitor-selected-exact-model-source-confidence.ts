import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceTier = "official_product" | "official_support" | "official_manual" | "trusted_secondary" | "source_not_confirmed";
type ObservationReadiness = "safe_internal_no_write_observation" | "manual_observation_only" | "hold_required";

type ModelConfidenceRow = {
  caseId: string;
  modelCode: string;
  brandModel: string;
  titleExample: string | null;
  sourceTier: SourceTier;
  sourceUrl: string | null;
  sourceConfidence: "high" | "medium" | "low";
  sourceVerifiedSpec: {
    size: string;
    resolution: string;
    refresh: string;
    panel: string;
    shape: string;
  };
  existingReportBucket: string;
  observationReadiness: ObservationReadiness;
  holdReason: string | null;
  noWriteObservationRule: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
  runtimeApply: false;
};

type JsonReport = Record<string, unknown>;

type Report = {
  generatedAt: string;
  reportOnly: true;
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  directThirtyDayPlanEdit: false;
  category: "monitor_discovered";
  lane: "monitor_selected_exact_model_source_confidence";
  inputFiles: string[];
  inputReadSummary: Record<string, unknown>;
  metrics: {
    modelRows: number;
    safeInternalNoWriteObservationRows: number;
    manualObservationOnlyRows: number;
    holdRequiredRows: number;
    officialProductRows: number;
    officialSupportRows: number;
    officialManualRows: number;
    trustedSecondaryRows: number;
    sourceNotConfirmedRows: number;
    runtimeApprovedRows: 0;
    publicPromotionRows: 0;
    candidatePoolRows: 0;
    runtimeApplyRows: 0;
  };
  rows: ModelConfidenceRow[];
  observationReadinessSummary: string[];
  blockedOwnerDecisions: string[];
  conclusion: string;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "monitor-selected-exact-model-source-confidence-latest.json");
const outputMdPath = path.join(reportsDir, "monitor-selected-exact-model-source-confidence-latest.md");

const inputFiles = [
  "../인수인계.md",
  "reports/monitor-selected-model-backfill-latest.json",
  "reports/monitor-model-code-spec-evidence-packet-latest.json",
  "reports/monitor-pending-model-spec-evidence-latest.json",
  "reports/monitor-selected-model-runtime-dry-run-latest.json",
  "reports/monitor-no-mutation-runtime-dry-run-latest.json",
  "reports/category-orchestration-status-latest.json",
  "reports/orchestration-boundary-audit-latest.json",
];

const rows: ModelConfidenceRow[] = [
  {
    caseId: "MONITOR-SOURCE-CONF-01",
    modelCode: "xl2540k",
    brandModel: "BenQ ZOWIE XL2540K",
    titleExample: "벤큐 XL2540K 240hz 게이밍 모니터",
    sourceTier: "official_product",
    sourceUrl: "https://zowie.benq.eu/en-uk/monitor/xl2540k.html",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "24.5in", resolution: "1920x1080", refresh: "240hz", panel: "tn", shape: "flat" },
    existingReportBucket: "runtime_candidate_after_main_review",
    observationReadiness: "safe_internal_no_write_observation",
    holdReason: null,
    noWriteObservationRule: "Count only active listings with title-visible XL2540K and monitor body context; reject accessories, sold/buying, or damaged rows.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-02",
    modelCode: "27us550",
    brandModel: "LG 27US550-W",
    titleExample: "LG전자 27US550 판매합니다",
    sourceTier: "official_product",
    sourceUrl: "https://www.lg.com/us/monitors/lg-27us550-w-4k-uhd-monitor",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "27in", resolution: "3840x2160", refresh: "60hz", panel: "ips", shape: "flat" },
    existingReportBucket: "runtime_candidate_after_main_review",
    observationReadiness: "safe_internal_no_write_observation",
    holdReason: null,
    noWriteObservationRule: "Count 27US550/27US550-W exact-code rows only; keep 27UL/27UP adjacent LG codes separate.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-03",
    modelCode: "ls27f354fhk",
    brandModel: "Samsung S27F354FHK / LS27F354FHKXKR",
    titleExample: "(미개봉)삼성전자 27인치 모니터 LS27F354FHK",
    sourceTier: "official_support",
    sourceUrl: "https://www.samsung.com/sec/support/model/LS27F354FHKXKR/",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "27in", resolution: "1920x1080", refresh: "60hz", panel: "pls", shape: "flat" },
    existingReportBucket: "runtime_candidate_after_main_review",
    observationReadiness: "safe_internal_no_write_observation",
    holdReason: null,
    noWriteObservationRule: "Count exact LS27F354FHK/S27F354FHK rows; preserve PLS literally until owner decides panel-family mapping.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-04",
    modelCode: "39gx900a",
    brandModel: "LG 39GX900A-B",
    titleExample: "lg 39gx900a",
    sourceTier: "official_product",
    sourceUrl: "https://www.lg.com/us/monitors/lg-39gx900a-b-gaming-monitor",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "39in", resolution: "3440x1440", refresh: "240hz", panel: "oled", shape: "curved_ultrawide" },
    existingReportBucket: "runtime_candidate_after_main_review",
    observationReadiness: "safe_internal_no_write_observation",
    holdReason: null,
    noWriteObservationRule: "Count exact 39GX900A/39GX900A-B rows, but keep curved ultrawide/OLED shape as an explicit observation axis.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-05",
    modelCode: "aw2525hm",
    brandModel: "Dell Alienware AW2525HM",
    titleExample: "aw2525hm",
    sourceTier: "official_product",
    sourceUrl: "https://www.dell.com/en-us/shop/alienware-25-320hz-gaming-monitor-aw2525hm/apd/210-bryk/monitors-monitor-accessories",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "25in", resolution: "1920x1080", refresh: "320hz", panel: "fast_ips", shape: "flat" },
    existingReportBucket: "runtime_candidate_after_main_review",
    observationReadiness: "safe_internal_no_write_observation",
    holdReason: null,
    noWriteObservationRule: "Count exact AW2525HM rows, including model-code-only Korean titles, but require active saleStatus and monitor body context.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-06",
    modelCode: "27gl650f",
    brandModel: "LG UltraGear 27GL650F-B",
    titleExample: "LG 27GL650F / 27GL650F-B exact-code row",
    sourceTier: "official_product",
    sourceUrl: "https://www.lg.com/us/monitors/lg-27gl650f-b-gaming-monitor",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "27in", resolution: "1920x1080", refresh: "144hz", panel: "ips", shape: "flat" },
    existingReportBucket: "runtime_candidate_after_main_review",
    observationReadiness: "safe_internal_no_write_observation",
    holdReason: null,
    noWriteObservationRule: "Count exact 27GL650F/27GL650F-B rows only; keep other LG 27GL/27GN gaming models separate.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-07",
    modelCode: "u2412mb",
    brandModel: "Dell UltraSharp U2412M / U2412Mb",
    titleExample: "델 24인치 피벗 모니터 u2412mb",
    sourceTier: "official_manual",
    sourceUrl: "https://downloads.dell.com/Manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitors/dell-u2412m_User%27s-Guide_en-us.pdf",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "24in", resolution: "1920x1200", refresh: "60hz", panel: "ips", shape: "flat" },
    existingReportBucket: "manual_review_supporting_evidence",
    observationReadiness: "manual_observation_only",
    holdReason: "Official manual resolves spec, but selected exact-model acceptance policy has not promoted U2412Mb into the selected candidate set.",
    noWriteObservationRule: "Allow manual no-write observation calibration only; do not count as selected candidate until owner adds this model code.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-08",
    modelCode: "275qf",
    brandModel: "MSI MAG 275QF",
    titleExample: "MSI MAG 275QF title with 200Hz conflict",
    sourceTier: "official_product",
    sourceUrl: "https://www.msi.com/Monitor/MAG-275QF",
    sourceConfidence: "high",
    sourceVerifiedSpec: { size: "27in", resolution: "2560x1440", refresh: "180hz", panel: "rapid_ips", shape: "flat" },
    existingReportBucket: "manual_review_needed",
    observationReadiness: "hold_required",
    holdReason: "Existing report flags title-vs-official refresh conflict; observed title 200Hz conflicts with official 180Hz evidence.",
    noWriteObservationRule: "Hold from selected observation counts until owner defines conflict handling for title refresh vs official spec.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-09",
    modelCode: "ct2210ips",
    brandModel: "Camel CT2210IPS",
    titleExample: "카멜 CT2210IPS 54cm 안드로이드 터치모니터",
    sourceTier: "trusted_secondary",
    sourceUrl: "https://prod.danawa.com/info/?pcode=9860196",
    sourceConfidence: "medium",
    sourceVerifiedSpec: { size: "21.5in", resolution: "1920x1080", refresh: "unknown_refresh", panel: "ips_or_lcd", shape: "touch_android" },
    existingReportBucket: "manual_review_marketplace_only",
    observationReadiness: "hold_required",
    holdReason: "Official manufacturer source is not confirmed, refresh remains unknown, and Android touch/signage device-class risk is unresolved.",
    noWriteObservationRule: "Hold from ordinary monitor observation; use only as touch/signage boundary evidence.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
  {
    caseId: "MONITOR-SOURCE-CONF-10",
    modelCode: "32rtx950",
    brandModel: "CrossOver 32RTX950",
    titleExample: "크로스오버 32RTX950 UHD 4K 160HZ 모니터",
    sourceTier: "source_not_confirmed",
    sourceUrl: null,
    sourceConfidence: "low",
    sourceVerifiedSpec: { size: "32in", resolution: "title_claim_uhd_4k", refresh: "title_claim_160hz", panel: "unknown_panel", shape: "unknown_shape" },
    existingReportBucket: "official_source_not_confirmed",
    observationReadiness: "hold_required",
    holdReason: "Official or durable trusted source evidence is missing; title spec tokens alone are insufficient.",
    noWriteObservationRule: "Hold until official/support/manual or high-confidence trusted secondary source confirms the model specs.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePoolReady: false,
    runtimeApply: false,
  },
];

async function readSummary(file: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path.join(appDir, file), "utf8");
  if (!file.endsWith(".json")) {
    return { path: file, kind: "markdown", bytes: raw.length };
  }
  const parsed = JSON.parse(raw) as JsonReport;
  return {
    path: file,
    kind: "json",
    bytes: raw.length,
    topLevelKeys: Object.keys(parsed),
    metrics: parsed.metrics ?? null,
    conclusion: parsed.conclusion ?? null,
  };
}

async function inputSummaries(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(inputFiles.map(async (file) => [file, await readSummary(file)] as const));
  return Object.fromEntries(entries);
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

function mdCell(value: unknown): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function buildMarkdown(report: Report): string {
  const lines = [
    "# Monitor Selected Exact-Model Source Confidence",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- category: ${report.category}`,
    `- lane: ${report.lane}`,
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    "- reportOnly: true",
    "- runtimeCatalogApply: false",
    "- runtimeApply: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    "- productionDbMutation: false",
    "- directThirtyDayPlanEdit: false",
    "- runtimeApprovedRows/publicPromotionRows/candidatePoolRows/runtimeApplyRows: 0/0/0/0",
    "",
    "## Metrics",
    "",
    `- modelRows: ${report.metrics.modelRows}`,
    `- safeInternalNoWriteObservationRows: ${report.metrics.safeInternalNoWriteObservationRows}`,
    `- manualObservationOnlyRows: ${report.metrics.manualObservationOnlyRows}`,
    `- holdRequiredRows: ${report.metrics.holdRequiredRows}`,
    `- officialProductRows: ${report.metrics.officialProductRows}`,
    `- officialSupportRows: ${report.metrics.officialSupportRows}`,
    `- officialManualRows: ${report.metrics.officialManualRows}`,
    `- trustedSecondaryRows: ${report.metrics.trustedSecondaryRows}`,
    `- sourceNotConfirmedRows: ${report.metrics.sourceNotConfirmedRows}`,
    "",
    "## Model Source Confidence",
    "",
    "| caseId | modelCode | sourceTier | confidence | readiness | spec | holdReason | source |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.rows.map((row) =>
      `| ${row.caseId} | ${row.modelCode} | ${row.sourceTier} | ${row.sourceConfidence} | ${row.observationReadiness} | ${mdCell(`${row.sourceVerifiedSpec.size}, ${row.sourceVerifiedSpec.resolution}, ${row.sourceVerifiedSpec.refresh}, ${row.sourceVerifiedSpec.panel}, ${row.sourceVerifiedSpec.shape}`)} | ${mdCell(row.holdReason)} | ${mdCell(row.sourceUrl)} |`,
    ),
    "",
    "## Observation Readiness",
    "",
    ...report.observationReadinessSummary.map((item) => `- ${item}`),
    "",
    "## Blocked Owner Decisions",
    "",
    ...report.blockedOwnerDecisions.map((item) => `- ${item}`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const sourceTierCounts = countBy(rows.map((row) => row.sourceTier));
  const readinessCounts = countBy(rows.map((row) => row.observationReadiness));
  const report: Report = {
    generatedAt,
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "monitor_discovered",
    lane: "monitor_selected_exact_model_source_confidence",
    inputFiles,
    inputReadSummary: await inputSummaries(),
    metrics: {
      modelRows: rows.length,
      safeInternalNoWriteObservationRows: readinessCounts.safe_internal_no_write_observation ?? 0,
      manualObservationOnlyRows: readinessCounts.manual_observation_only ?? 0,
      holdRequiredRows: readinessCounts.hold_required ?? 0,
      officialProductRows: sourceTierCounts.official_product ?? 0,
      officialSupportRows: sourceTierCounts.official_support ?? 0,
      officialManualRows: sourceTierCounts.official_manual ?? 0,
      trustedSecondaryRows: sourceTierCounts.trusted_secondary ?? 0,
      sourceNotConfirmedRows: sourceTierCounts.source_not_confirmed ?? 0,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      runtimeApplyRows: 0,
    },
    rows,
    observationReadinessSummary: [
      "Safe for internal no-write observation: xl2540k, 27us550, ls27f354fhk, 39gx900a, aw2525hm, and 27gl650f.",
      "Manual observation only: u2412mb, because official manual evidence is strong but selected-model acceptance is not approved.",
      "Hold required: 275qf, ct2210ips, and 32rtx950 due to refresh conflict, secondary-only/incomplete source evidence, touch/signage risk, or missing durable source evidence.",
      "No row is runtime-approved, public-ready, candidate-pool-ready, or runtime-apply-ready.",
    ],
    blockedOwnerDecisions: [
      "Confirm whether the six official-backed selected exact-model rows may be used in a future no-write observation wave.",
      "Decide whether Dell U2412Mb joins selected exact-model observation or remains manual calibration only.",
      "Resolve MSI MAG 275QF title refresh conflict before using it as a selected observation row.",
      "Create or confirm a split for Android/touch/signage monitors before CT2210IPS can leave hold.",
      "Require durable official/support/manual or trusted secondary evidence before 32RTX950 can enter observation.",
      "Keep public promotion, candidate pool, runtime apply, DB writes, and 30-day-plan edits closed.",
    ],
    conclusion: "six_monitor_exact_models_safe_for_internal_no_write_observation_three_hold_one_manual",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(outputMdPath, buildMarkdown(report));
  JSON.parse(await readFile(outputJsonPath, "utf8")) as Report;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
