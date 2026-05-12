import fs from "node:fs";
import path from "node:path";

type DryRunReport = {
  category: string;
  conclusion: string;
  metrics: Record<string, number>;
  failedRows?: Array<Record<string, unknown>>;
};

const files = [
  "runtime-gap-expanded-audit-latest.json",
  "headphone-no-mutation-runtime-dry-run-latest.json",
  "monitor-no-mutation-runtime-dry-run-latest.json",
  "game-console-no-mutation-runtime-dry-run-latest.json",
  "desktop-no-mutation-runtime-dry-run-latest.json",
  "speaker-no-mutation-runtime-dry-run-latest.json",
  "camera-no-mutation-runtime-dry-run-latest.json",
  "home-appliance-no-mutation-runtime-dry-run-latest.json",
];

function readReport(file: string): DryRunReport {
  const fullPath = path.join(process.cwd(), "reports", file);
  const raw = JSON.parse(fs.readFileSync(fullPath, "utf8")) as DryRunReport;
  return {
    category: raw.category ?? file.replace(/-no-mutation-runtime-dry-run-latest\.json$/, ""),
    conclusion: raw.conclusion,
    metrics: raw.metrics ?? {},
    failedRows: raw.failedRows ?? [],
  };
}

const reports = files.map((file) => ({ file, ...readReport(file) }));
const totals = reports.reduce(
  (acc, report) => {
    acc.rows += Number(report.metrics.rows ?? report.metrics.probes ?? 0);
    acc.failedRows += Number(report.metrics.failedRows ?? report.metrics.leaks ?? 0);
    acc.candidatePositiveOnlyRows += Number(report.metrics.candidatePositiveOnlyRows ?? 0);
    acc.runtimeApprovedRows += Number(report.metrics.runtimeApprovedRows ?? 0);
    acc.publicPromotionRows += Number(report.metrics.publicPromotionRows ?? 0);
    acc.candidatePoolWiringRows += Number(report.metrics.candidatePoolWiringRows ?? 0);
    return acc;
  },
  {
    rows: 0,
    failedRows: 0,
    candidatePositiveOnlyRows: 0,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
);

const patchReviewQueue = reports
  .filter((report) => (report.failedRows?.length ?? 0) > 0)
  .map((report, index) => ({
    priority: index + 1,
    category: report.category,
    reason: `${report.failedRows?.length ?? 0} dry-run row(s) still require owner/main-agent policy review`,
    sourceReports: [
      report.file.replace(/\.json$/, ".md"),
    ],
    owner: "main-agent",
  }));

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  scope: "no-mutation runtime dry-run rollup across parser/prep queue",
  totals,
  reports,
  patchReviewQueue,
  conclusion: patchReviewQueue.length > 0
    ? "queue_completed_report_only_patch_review_items_identified"
    : "queue_completed_no_patch_review_items_remaining",
  nextAction: patchReviewQueue.length > 0
    ? "Review remaining dry-run failures before any additional runtime patch."
    : "Patch queue is clear; continue report-only readiness expansion or return to operational observation.",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "no-mutation-runtime-dry-run-rollup-latest.json");
const mdPath = path.join(reportsDir, "no-mutation-runtime-dry-run-rollup-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# No-Mutation Runtime Dry-Run Rollup",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "- directThirtyDayPlanEdit: false",
  "",
  "## Totals",
  "",
  `- rows/probes: ${totals.rows}`,
  `- failed/leak rows: ${totals.failedRows}`,
  `- candidatePositiveOnlyRows observed: ${totals.candidatePositiveOnlyRows}`,
  `- runtimeApproved/public/candidatePool rows: ${totals.runtimeApprovedRows}/${totals.publicPromotionRows}/${totals.candidatePoolWiringRows}`,
  "",
  "## Reports",
  "",
  "| file | category | conclusion | rows/probes | failed/leaks | candidatePositiveOnly |",
  "| --- | --- | --- | ---: | ---: | ---: |",
  ...reports.map((row) => `| ${row.file} | ${row.category} | ${row.conclusion} | ${row.metrics.rows ?? row.metrics.probes ?? 0} | ${row.metrics.failedRows ?? row.metrics.leaks ?? 0} | ${row.metrics.candidatePositiveOnlyRows ?? 0} |`),
  "",
  "## Patch Review Queue",
  "",
  ...patchReviewQueue.map((row) => `- P${row.priority} ${row.category}: ${row.reason} (owner=${row.owner})`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  rows: totals.rows,
  failedRows: totals.failedRows,
  patchReviewItems: patchReviewQueue.length,
  jsonPath,
  mdPath,
}, null, 2));
