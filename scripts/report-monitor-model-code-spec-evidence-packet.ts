import fs from "node:fs";
import path from "node:path";

const officialSpecRows = [
  {
    caseId: "MONITOR-SPLIT-01",
    hint: "xl2540k",
    brand: "BenQ ZOWIE",
    model: "XL2540K",
    sourceType: "official_product_page",
    sourceUrl: "https://zowie.benq.eu/en-uk/monitor/xl2540k.html",
    resolved: {
      size: "24.5in",
      resolution: "1920x1080",
      refresh: "240hz",
      panel: "tn",
    },
    reportOnlyDecision: "split_only_candidate_after_owner_review",
    runtimeApproved: false,
    evidenceNote: "Official ZOWIE specs list 24.5 inch, 240 Hz, 1920 x 1080 at 240Hz, and TN panel.",
  },
  {
    caseId: "MONITOR-SPLIT-02",
    hint: "27us550",
    brand: "LG",
    model: "27US550-W",
    sourceType: "official_product_page",
    sourceUrl: "https://www.lg.com/us/monitors/lg-27us550-w-4k-uhd-monitor",
    resolved: {
      size: "27in",
      resolution: "3840x2160",
      refresh: "60hz",
      panel: "ips",
    },
    reportOnlyDecision: "split_only_candidate_after_owner_review",
    runtimeApproved: false,
    evidenceNote: "Official LG specs list 27 inch, IPS display type, 60Hz refresh rate, and 3840 x 2160 resolution.",
  },
  {
    caseId: "MONITOR-SPLIT-03",
    hint: "ls27f354fhk",
    brand: "Samsung",
    model: "S27F354FHK",
    sourceType: "official_support_page",
    sourceUrl: "https://www.samsung.com/sec/support/model/LS27F354FHKXKR/",
    resolved: {
      size: "27in",
      resolution: "1920x1080",
      refresh: "60hz",
      panel: "pls",
    },
    reportOnlyDecision: "split_only_candidate_after_owner_review",
    runtimeApproved: false,
    evidenceNote: "Official Samsung Korea support specs list 27 inch, PLS panel, 1920 x 1080 resolution, and 60Hz refresh rate.",
  },
];

const supportingRows = [
  {
    caseId: "MONITOR-SPLIT-04",
    hint: "32rtx950",
    sourceType: "official_source_not_confirmed",
    sourceUrl: null,
    reportOnlyDecision: "keep_split_only_not_candidate",
    runtimeApproved: false,
    reason: "Marketplace/title tokens suggest 32in 4K 160Hz, but official or sufficiently durable spec evidence is not confirmed.",
  },
  {
    caseId: "MONITOR-MANUAL-01",
    hint: "u2412mb",
    sourceType: "official_manual",
    sourceUrl:
      "https://downloads.dell.com/Manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitors/dell-u2412m_User%27s-Guide_en-us.pdf",
    reportOnlyDecision: "manual_review_supporting_evidence",
    runtimeApproved: false,
    reason: "Existing report has official manual evidence, but row remains manual until owner chooses exact model-code acceptance policy.",
  },
  {
    caseId: "MONITOR-MANUAL-02",
    hint: "ct2210ips",
    sourceType: "marketplace_spec",
    sourceUrl: "https://prod.danawa.com/info/?pcode=9860196",
    reportOnlyDecision: "manual_review_marketplace_only",
    runtimeApproved: false,
    reason: "Marketplace spec resolves some display details, but official source and refresh evidence remain insufficient.",
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
  category: "monitor_discovered",
  scope: "official/spec evidence packet for monitor model-code fixtures",
  metrics: {
    officialSpecRows: officialSpecRows.length,
    supportingRows: supportingRows.length,
    runtimeApprovedRows: 0,
    confirmedPublicCandidates: 0,
  },
  officialSpecRows,
  supportingRows,
  policyImplications: [
    "Official model-code evidence can support future regression tests, but it is not runtime approval.",
    "Rows with official source evidence should still stay split-only until main-agent owns runtime parser/catalog changes.",
    "Marketplace-only or official-source-missing rows must remain manual/supporting evidence, not candidates.",
    "Generic monitor titles without model-code/spec anchor remain hold.",
  ],
  proposedRegressionTargets: [
    "BenQ XL2540K: parser key should preserve 24.5in/FHD/240Hz/TN from title or official-backed fixture.",
    "LG 27US550: parser key should preserve 27in/UHD_4K/60Hz/IPS.",
    "Samsung LS27F354FHK: parser key should preserve 27in/FHD/60Hz/PLS or mapped panel family after owner review.",
    "CrossOver 32RTX950 and Camel CT2210IPS remain manual/supporting evidence until stronger source confirmation exists.",
  ],
  nextAction:
    "Create monitor artifact consistency audit, then continue to desktop full-unit versus part-only fixture expansion packet.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "monitor-model-code-spec-evidence-packet-latest.json");
const mdPath = path.join(reportsDir, "monitor-model-code-spec-evidence-packet-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Monitor Model-Code Spec Evidence Packet",
  "",
  `- generatedAt: ${report.generatedAt}`,
  "- category: monitor_discovered",
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- officialSpecRows: ${report.metrics.officialSpecRows}`,
  `- supportingRows: ${report.metrics.supportingRows}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  `- confirmedPublicCandidates: ${report.metrics.confirmedPublicCandidates}`,
  "",
  "## Official Spec Rows",
  "",
  "| caseId | hint | brand/model | size | resolution | refresh | panel | decision | source |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...officialSpecRows.map(
    (row) =>
      `| ${row.caseId} | ${row.hint} | ${row.brand} ${row.model} | ${row.resolved.size} | ${row.resolved.resolution} | ${row.resolved.refresh} | ${row.resolved.panel} | ${row.reportOnlyDecision} | ${row.sourceUrl} |`,
  ),
  "",
  "## Supporting / Hold Rows",
  "",
  "| caseId | hint | sourceType | decision | reason | source |",
  "| --- | --- | --- | --- | --- | --- |",
  ...supportingRows.map(
    (row) =>
      `| ${row.caseId} | ${row.hint} | ${row.sourceType} | ${row.reportOnlyDecision} | ${row.reason} | ${row.sourceUrl ?? "-"} |`,
  ),
  "",
  "## Policy Implications",
  "",
  ...report.policyImplications.map((line) => `- ${line}`),
  "",
  "## Proposed Regression Targets",
  "",
  ...report.proposedRegressionTargets.map((line) => `- ${line}`),
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
      officialSpecRows: report.metrics.officialSpecRows,
      supportingRows: report.metrics.supportingRows,
      runtimeApprovedRows: report.metrics.runtimeApprovedRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
