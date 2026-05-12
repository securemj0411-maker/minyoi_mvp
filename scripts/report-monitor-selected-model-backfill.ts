import fs from "node:fs";
import path from "node:path";

type ReviewBucket = "runtime_candidate_after_main_review" | "manual_review_needed" | "hold_or_exclusion";

type SelectedRow = {
  caseId: string;
  sourcePid: string | null;
  title: string;
  observedHint: string;
  brand: string;
  model: string;
  bucket: ReviewBucket;
  evidenceStatus: "official_backfilled" | "support_backfilled" | "marketplace_only" | "no_exact_model_code";
  sourceType: string;
  sourceUrl: string | null;
  resolved: {
    size: string;
    resolution: string;
    refresh: string;
    panel: string;
    shape: string;
  };
  hybridRisks: string[];
  runtimeApproved: false;
  candidatePoolReady: false;
  publicReady: false;
  reviewNote: string;
};

const selectedRows: SelectedRow[] = [
  {
    caseId: "MONITOR-SELECTED-01",
    sourcePid: "407163451",
    title: "벤큐 XL2540K 240hz 게이밍 모니터",
    observedHint: "xl2540k",
    brand: "BenQ ZOWIE",
    model: "XL2540K",
    bucket: "runtime_candidate_after_main_review",
    evidenceStatus: "official_backfilled",
    sourceType: "official_product_page",
    sourceUrl: "https://zowie.benq.eu/en-uk/monitor/xl2540k.html",
    resolved: {
      size: "24.5in",
      resolution: "1920x1080",
      refresh: "240hz",
      panel: "tn",
      shape: "flat",
    },
    hybridRisks: [],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Exact model-code row with official ZOWIE specs. Keep as selected review candidate only; no runtime/catalog/pool approval is implied.",
  },
  {
    caseId: "MONITOR-SELECTED-02",
    sourcePid: "407321422",
    title: "LG전자 27US550 판매합니다",
    observedHint: "27us550",
    brand: "LG",
    model: "27US550-W",
    bucket: "runtime_candidate_after_main_review",
    evidenceStatus: "official_backfilled",
    sourceType: "official_product_page",
    sourceUrl: "https://www.lg.com/us/monitors/lg-27us550-w-4k-uhd-monitor",
    resolved: {
      size: "27in",
      resolution: "3840x2160",
      refresh: "60hz",
      panel: "ips",
      shape: "flat",
    },
    hybridRisks: [],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Exact model-code row with official LG specs. Suitable for main review as a narrow model-code fixture, not whole monitor readiness.",
  },
  {
    caseId: "MONITOR-SELECTED-03",
    sourcePid: "407315730",
    title: "(미개봉)삼성전자 27인치 모니터 LS27F354FHK",
    observedHint: "ls27f354fhk",
    brand: "Samsung",
    model: "S27F354FHK",
    bucket: "runtime_candidate_after_main_review",
    evidenceStatus: "official_backfilled",
    sourceType: "official_support_page",
    sourceUrl: "https://www.samsung.com/sec/support/model/LS27F354FHKXKR/",
    resolved: {
      size: "27in",
      resolution: "1920x1080",
      refresh: "60hz",
      panel: "pls",
      shape: "flat",
    },
    hybridRisks: [],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Exact support model code backs size/resolution/refresh/panel. Main review still needs to decide whether PLS maps to panel family or stays literal.",
  },
  {
    caseId: "MONITOR-SELECTED-04",
    sourcePid: "405700328",
    title: "lg 39gx900a",
    observedHint: "39gx900a",
    brand: "LG",
    model: "39GX900A-B",
    bucket: "runtime_candidate_after_main_review",
    evidenceStatus: "official_backfilled",
    sourceType: "official_product_page",
    sourceUrl: "https://www.lg.com/us/monitors/lg-39gx900a-b-gaming-monitor",
    resolved: {
      size: "39in",
      resolution: "3440x1440",
      refresh: "240hz",
      panel: "oled",
      shape: "curved_ultrawide",
    },
    hybridRisks: ["ultrawide_shape_axis"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Exact LG model-code row, but curved ultrawide OLED should keep shape as a key axis before any runtime comparison.",
  },
  {
    caseId: "MONITOR-SELECTED-05",
    sourcePid: "405611963",
    title: "aw2525hm",
    observedHint: "aw2525hm",
    brand: "Dell Alienware",
    model: "AW2525HM",
    bucket: "runtime_candidate_after_main_review",
    evidenceStatus: "official_backfilled",
    sourceType: "official_product_page",
    sourceUrl: "https://www.dell.com/en-us/shop/alienware-25-320hz-gaming-monitor-aw2525hm/apd/210-bqkh/monitors-monitor-accessories",
    resolved: {
      size: "25in",
      resolution: "1920x1080",
      refresh: "320hz",
      panel: "ips",
      shape: "flat",
    },
    hybridRisks: [],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Exact Alienware model-code row from the monitor catalog. Needs main review because the listing title is model-code only and lacks Korean product context.",
  },
  {
    caseId: "MONITOR-SELECTED-06",
    sourcePid: "404513930",
    title: "LG 울트라기어 27GL650F 144Hz 게이밍 모니터",
    observedHint: "27gl650f",
    brand: "LG UltraGear",
    model: "27GL650F-B",
    bucket: "runtime_candidate_after_main_review",
    evidenceStatus: "official_backfilled",
    sourceType: "official_product_page",
    sourceUrl: "https://www.lg.com/us/monitors/lg-27gl650f-b-gaming-monitor",
    resolved: {
      size: "27in",
      resolution: "1920x1080",
      refresh: "144hz",
      panel: "ips",
      shape: "flat",
    },
    hybridRisks: [],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Exact LG UltraGear code with title refresh token and official source. Good regression candidate after main review.",
  },
  {
    caseId: "MONITOR-SELECTED-07",
    sourcePid: "406951053",
    title: "새제품 MSI 275QF QHD 200HZ 게이밍모니터",
    observedHint: "275qf",
    brand: "MSI",
    model: "MAG 275QF",
    bucket: "manual_review_needed",
    evidenceStatus: "official_backfilled",
    sourceType: "official_product_page",
    sourceUrl: "https://www.msi.com/Monitor/MAG-275QF",
    resolved: {
      size: "27in",
      resolution: "2560x1440",
      refresh: "180hz_or_200hz_title_conflict",
      panel: "rapid_ips",
      shape: "flat",
    },
    hybridRisks: ["title_official_refresh_conflict"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Model family is exact enough, but observed title says 200Hz while official MAG 275QF evidence should be rechecked by owner before parser policy.",
  },
  {
    caseId: "MONITOR-SELECTED-08",
    sourcePid: "405921652",
    title: "카멜 CT2210IPS 54cm 안드로이드 터치모니터",
    observedHint: "ct2210ips",
    brand: "Camel",
    model: "CT2210IPS",
    bucket: "manual_review_needed",
    evidenceStatus: "marketplace_only",
    sourceType: "marketplace_spec",
    sourceUrl: "https://prod.danawa.com/info/?pcode=9860196",
    resolved: {
      size: "21.5in",
      resolution: "1920x1080",
      refresh: "unknown_refresh",
      panel: "ips",
      shape: "touch_android",
    },
    hybridRisks: ["android_touch_signage"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote:
      "Android touch monitor is a device-class boundary row. Keep manual until touch/signage policy is split from ordinary monitor comparisons.",
  },
];

const holdRows: SelectedRow[] = [
  {
    caseId: "MONITOR-HYBRID-HOLD-01",
    sourcePid: "381870454",
    title: "13.3인치 OLED 휴대용 모니터 ㅡ미개공",
    observedHint: "generic_portable_oled",
    brand: "unknown",
    model: "unknown",
    bucket: "hold_or_exclusion",
    evidenceStatus: "no_exact_model_code",
    sourceType: "observed_listing_only",
    sourceUrl: null,
    resolved: {
      size: "13.3in",
      resolution: "unknown_resolution",
      refresh: "unknown_refresh",
      panel: "oled",
      shape: "portable_monitor",
    },
    hybridRisks: ["portable_monitor", "generic_no_model_code"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote: "Portable monitor without model-code should remain hold/manual, not generic OLED monitor candidate.",
  },
  {
    caseId: "MONITOR-HYBRID-HOLD-02",
    sourcePid: "407326597",
    title: "카멜 PMA-2 고중량 모니터 거치대",
    observedHint: "pma-2",
    brand: "Camel",
    model: "PMA-2",
    bucket: "hold_or_exclusion",
    evidenceStatus: "no_exact_model_code",
    sourceType: "observed_listing_only",
    sourceUrl: null,
    resolved: {
      size: "not_monitor",
      resolution: "not_monitor",
      refresh: "not_monitor",
      panel: "not_monitor",
      shape: "monitor_arm_accessory",
    },
    hybridRisks: ["monitor_arm_accessory"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote: "Monitor arm/accessory row must be an exclusion even when title includes monitor-compatible size wording.",
  },
  {
    caseId: "MONITOR-HYBRID-HOLD-03",
    sourcePid: null,
    title: "LG 28인치 티비 모니터",
    observedHint: "tv_monitor_boundary",
    brand: "LG",
    model: "unknown_tv_monitor",
    bucket: "hold_or_exclusion",
    evidenceStatus: "no_exact_model_code",
    sourceType: "prior_dry_run_fixture",
    sourceUrl: null,
    resolved: {
      size: "28in",
      resolution: "unknown_resolution",
      refresh: "unknown_refresh",
      panel: "unknown_panel",
      shape: "tv_monitor_boundary",
    },
    hybridRisks: ["tv_monitor_hybrid"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote: "TV/monitor hybrid terms need a device-class split and should not enter monitor model-code candidates.",
  },
  {
    caseId: "MONITOR-HYBRID-HOLD-04",
    sourcePid: null,
    title: "게임용 본체 / 게이밍 모니터 / 컴퓨터 풀세트",
    observedHint: "pc_bundle_monitor",
    brand: "unknown",
    model: "unknown_bundle",
    bucket: "hold_or_exclusion",
    evidenceStatus: "no_exact_model_code",
    sourceType: "cluster_review_fixture",
    sourceUrl: null,
    resolved: {
      size: "bundle_unknown",
      resolution: "bundle_unknown",
      refresh: "bundle_unknown",
      panel: "bundle_unknown",
      shape: "pc_bundle",
    },
    hybridRisks: ["pc_bundle"],
    runtimeApproved: false,
    candidatePoolReady: false,
    publicReady: false,
    reviewNote: "PC bundle/full-set wording must remain out of monitor standalone comparisons.",
  },
];

const allRows = [...selectedRows, ...holdRows];
const bucketCounts = allRows.reduce<Record<ReviewBucket, number>>(
  (counts, row) => ({
    ...counts,
    [row.bucket]: counts[row.bucket] + 1,
  }),
  {
    runtime_candidate_after_main_review: 0,
    manual_review_needed: 0,
    hold_or_exclusion: 0,
  },
);

const hybridRiskRegister = [
  {
    risk: "tv_monitor_hybrid",
    rows: ["MONITOR-HYBRID-HOLD-03"],
    action: "Keep hold until TV/monitor device-class split exists.",
  },
  {
    risk: "portable_monitor",
    rows: ["MONITOR-HYBRID-HOLD-01"],
    action: "Keep separate from desktop/gaming monitor model-code candidates unless exact model policy exists.",
  },
  {
    risk: "android_touch_signage",
    rows: ["MONITOR-SELECTED-08"],
    action: "Manual review; split Android/touch/signage devices from ordinary monitor comparisons.",
  },
  {
    risk: "monitor_arm_accessory",
    rows: ["MONITOR-HYBRID-HOLD-02"],
    action: "Hard exclusion from monitor standalone comparable keys.",
  },
  {
    risk: "pc_bundle",
    rows: ["MONITOR-HYBRID-HOLD-04"],
    action: "Hard exclusion or separate bundle policy; never standalone monitor comparable key.",
  },
];

const sourceUrls = Array.from(new Set(allRows.map((row) => row.sourceUrl).filter((url): url is string => Boolean(url))));

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "monitor_discovered",
  scope: "selected monitor model-code evidence backfill and no-runtime review packet",
  sourceContext: [
    "reports/monitor-model-code-spec-evidence-packet-latest.md",
    "reports/monitor-model-code-implementation-prep-latest.md",
    "reports/monitor-no-mutation-runtime-dry-run-latest.md",
    "reports/monitor-artifact-consistency-audit-latest.md",
    "category-intelligence/monitor_discovered/*",
  ],
  metrics: {
    selectedModelRows: selectedRows.length,
    totalRows: allRows.length,
    runtimeCandidateAfterMainReview: bucketCounts.runtime_candidate_after_main_review,
    manualReviewNeeded: bucketCounts.manual_review_needed,
    holdOrExclusion: bucketCounts.hold_or_exclusion,
    officialBackfilledRows: allRows.filter((row) => row.evidenceStatus === "official_backfilled").length,
    runtimeApprovedRows: 0,
    candidatePoolReadyRows: 0,
    publicReadyRows: 0,
  },
  selectedRows,
  holdRows,
  hybridRiskRegister,
  sourceUrls,
  policyNotes: [
    "This packet selects model-code evidence only; it does not approve whole monitor_discovered.",
    "runtime_candidate_after_main_review means evidence is good enough for main-agent review, not runtime approval.",
    "Generic, portable, Android/touch, TV-monitor, accessory, and PC-bundle rows remain manual or hold.",
    "Shape/panel/refresh conflicts must stay explicit comparable-key axes before any parser/catalog work.",
  ],
  nextOwnerDecisions: [
    "Confirm whether the six official-backed exact model rows may become runtime fixtures in a later main-agent patch.",
    "Decide whether Samsung PLS should remain literal or map to a broader panel family in tests.",
    "Resolve MSI MAG 275QF title refresh conflict before using it as a positive fixture.",
    "Create explicit split policy for portable monitors and Android/touch/signage monitors.",
  ],
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "monitor-selected-model-backfill-latest.json");
const mdPath = path.join(reportsDir, "monitor-selected-model-backfill-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const escapeCell = (value: string | null) => (value ?? "-").replaceAll("|", "\\|");
const rowLine = (row: SelectedRow) =>
  [
    row.caseId,
    row.bucket,
    row.observedHint,
    `${row.brand} ${row.model}`,
    row.resolved.size,
    row.resolved.resolution,
    row.resolved.refresh,
    row.resolved.panel,
    row.resolved.shape,
    row.hybridRisks.length ? row.hybridRisks.join(", ") : "-",
    row.sourceUrl ?? "-",
  ]
    .map(escapeCell)
    .join(" | ");

const md = [
  "# Monitor Selected Model Backfill",
  "",
  `- generatedAt: ${report.generatedAt}`,
  "- category: monitor_discovered",
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- selectedModelRows: ${report.metrics.selectedModelRows}`,
  `- totalRows: ${report.metrics.totalRows}`,
  `- runtime_candidate_after_main_review: ${report.metrics.runtimeCandidateAfterMainReview}`,
  `- manual_review_needed: ${report.metrics.manualReviewNeeded}`,
  `- hold_or_exclusion: ${report.metrics.holdOrExclusion}`,
  `- officialBackfilledRows: ${report.metrics.officialBackfilledRows}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  `- candidatePoolReadyRows: ${report.metrics.candidatePoolReadyRows}`,
  `- publicReadyRows: ${report.metrics.publicReadyRows}`,
  "",
  "## Selected Model-Code Rows",
  "",
  "| caseId | bucket | hint | brand/model | size | resolution | refresh | panel | shape | hybrid risks | source |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...selectedRows.map((row) => `| ${rowLine(row)} |`),
  "",
  "## Hold / Exclusion Boundary Rows",
  "",
  "| caseId | bucket | hint | brand/model | size | resolution | refresh | panel | shape | hybrid risks | source |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...holdRows.map((row) => `| ${rowLine(row)} |`),
  "",
  "## Review Notes",
  "",
  ...allRows.map((row) => `- ${row.caseId}: ${row.reviewNote}`),
  "",
  "## Hybrid Risk Register",
  "",
  "| risk | rows | action |",
  "| --- | --- | --- |",
  ...hybridRiskRegister.map((risk) => `| ${risk.risk} | ${risk.rows.join(", ")} | ${risk.action} |`),
  "",
  "## Cited Sources",
  "",
  ...sourceUrls.map((url) => `- ${url}`),
  "",
  "## Policy Notes",
  "",
  ...report.policyNotes.map((note) => `- ${note}`),
  "",
  "## Next Owner Decisions",
  "",
  ...report.nextOwnerDecisions.map((decision) => `- ${decision}`),
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      category: report.category,
      selectedModelRows: report.metrics.selectedModelRows,
      runtimeCandidateAfterMainReview: report.metrics.runtimeCandidateAfterMainReview,
      manualReviewNeeded: report.metrics.manualReviewNeeded,
      holdOrExclusion: report.metrics.holdOrExclusion,
      runtimeApprovedRows: report.metrics.runtimeApprovedRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
