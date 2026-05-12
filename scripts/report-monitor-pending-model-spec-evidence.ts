import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PendingEvidence = {
  rows: Array<{
    hint: string;
    count: number;
    pid?: string | number | null;
    title?: string;
    comparableKey?: string | null;
    criticalUnknown: string[];
    testCandidateStatus: string;
  }>;
};

type SpecEvidence = {
  hint: string;
  sourceName: string;
  sourceType: "official_manual" | "marketplace_spec";
  sourceUrl: string;
  sourceLines: string;
  resolvedResolution: string | null;
  resolvedRefresh: string | null;
  resolvedPanel: string | null;
  evidenceConfidence: "high" | "medium";
  reportOnlyDecision: string;
  notes: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

const specEvidence: SpecEvidence[] = [
  {
    hint: "u2412mb",
    sourceName: "Dell U2412M/U2412MWh User's Guide",
    sourceType: "official_manual",
    sourceUrl:
      "https://downloads.dell.com/Manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitors/dell-u2412m_User%27s-Guide_en-us.pdf",
    sourceLines: "Model U2412Mb/U2412Mc; maximum preset resolution 1920 x 1200 at 60 Hz",
    resolvedResolution: "1920x1200",
    resolvedRefresh: "60hz",
    resolvedPanel: "ips",
    evidenceConfidence: "high",
    reportOnlyDecision: "external_spec_resolves_resolution_refresh_but_not_runtime_approved",
    notes: ["Listing token u2412mb aligns with Dell U2412M/U2412Mb manual family.", "Still report-only; no monitor parser rule is applied."],
  },
  {
    hint: "ct2210ips",
    sourceName: "Danawa/SSG CT2210IPS product specs",
    sourceType: "marketplace_spec",
    sourceUrl: "https://prod.danawa.com/info/?pcode=9860196",
    sourceLines: "CT2210IPS; 54.6cm/21.5in; 1920x1080; Android touch monitor / digital display",
    resolvedResolution: "1920x1080",
    resolvedRefresh: null,
    resolvedPanel: "lcd_or_ips_listed",
    evidenceConfidence: "medium",
    reportOnlyDecision: "external_spec_resolves_resolution_only_refresh_still_unknown",
    notes: [
      "Source confirms CT2210IPS resolution, but refresh rate remains unconfirmed.",
      "Product class is Android touch/digital signage-like, so keep monitor parser candidate blocked.",
    ],
  },
];

function normalizeHint(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const pending = JSON.parse(
    await readFile(path.join(reportsDir, "monitor-pending-model-code-evidence-latest.json"), "utf8"),
  ) as PendingEvidence;

  const specByHint = new Map(specEvidence.map((row) => [normalizeHint(row.hint), row]));
  const rows = pending.rows.map((row) => {
    const spec = specByHint.get(normalizeHint(row.hint)) ?? null;
    return {
      ...row,
      specEvidence: spec,
      resolutionStatus: spec?.resolvedResolution ? "externally_resolved_report_only" : "still_unknown",
      refreshStatus: spec?.resolvedRefresh ? "externally_resolved_report_only" : "still_unknown",
      runtimeApproved: false,
      confirmedTestCandidate: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "monitor_discovered",
    decision: "monitor_pending_model_spec_evidence_report_only",
    sourceReports: ["monitor-pending-model-code-evidence-latest.json"],
    metrics: {
      pendingRows: rows.length,
      rowsWithExternalSpecEvidence: rows.filter((row) => row.specEvidence).length,
      externallyResolvedResolutionRows: rows.filter((row) => row.resolutionStatus === "externally_resolved_report_only").length,
      externallyResolvedRefreshRows: rows.filter((row) => row.refreshStatus === "externally_resolved_report_only").length,
      refreshStillUnknownRows: rows.filter((row) => row.refreshStatus === "still_unknown").length,
      officialSourceRows: rows.filter((row) => row.specEvidence?.sourceType === "official_manual").length,
      marketplaceSourceRows: rows.filter((row) => row.specEvidence?.sourceType === "marketplace_spec").length,
      confirmedTestCandidates: rows.filter((row) => row.confirmedTestCandidate).length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      decisionCounts: countBy(rows.map((row) => row.specEvidence?.reportOnlyDecision ?? "no_external_spec_evidence")),
    },
    rows,
    policyImplications: [
      "External specs can reduce manual ambiguity, but this report does not approve runtime monitor parser rules.",
      "u2412mb has official resolution/refresh evidence; keep as report-only evidence until main-approved wiring review.",
      "ct2210ips resolves resolution but not refresh, and remains blocked by product-class ambiguity.",
      "Confirmed monitor test candidates remain zero.",
    ],
    nextReportOnlyExperiments: [
      "store source URLs and source type beside pending hints for later human review",
      "prefer official manuals when available; marketplace specs are supporting evidence only",
      "keep refreshStillUnknownRows out of parser candidates",
    ],
    doNotDo: [
      "Do not public-promote monitor_discovered",
      "Do not add u2412mb or ct2210ips to runtime catalog",
      "Do not wire monitor candidate pool policy from external spec evidence",
      "Do not treat marketplace spec evidence as public approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "monitor-pending-model-spec-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| hint | source_type | resolution | refresh | decision | runtime_approved | source |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => {
      const spec = row.specEvidence;
      return `| ${row.hint} | ${spec?.sourceType ?? "-"} | ${spec?.resolvedResolution ?? "-"} | ${spec?.resolvedRefresh ?? "-"} | ${spec?.reportOnlyDecision ?? "no_external_spec_evidence"} | no | ${spec?.sourceUrl ?? "-"} |`;
    }),
  ].join("\n");

  const md = [
    "# Monitor Pending Model Spec Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only external spec evidence for pending monitor model-code hints. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- pending rows: ${report.metrics.pendingRows}`,
    `- external spec evidence rows: ${report.metrics.rowsWithExternalSpecEvidence}`,
    `- externally resolved resolution rows: ${report.metrics.externallyResolvedResolutionRows}`,
    `- externally resolved refresh rows: ${report.metrics.externallyResolvedRefreshRows}`,
    `- refresh still unknown rows: ${report.metrics.refreshStillUnknownRows}`,
    `- confirmed test candidates: ${report.metrics.confirmedTestCandidates}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "monitor-pending-model-spec-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/monitor-pending-model-spec-evidence-latest.json");
  console.log("wrote reports/monitor-pending-model-spec-evidence-latest.md");
  console.log(
    `monitor pending model spec evidence: rows=${rows.length}, resolved_resolution=${report.metrics.externallyResolvedResolutionRows}, resolved_refresh=${report.metrics.externallyResolvedRefreshRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
