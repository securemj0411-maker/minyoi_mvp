import fs from "node:fs";
import path from "node:path";

type RuntimeReport = {
  category: string;
  conclusion: string;
  metrics: Record<string, number>;
  failedRows?: Array<Record<string, unknown>>;
};

const runtimeReportFiles = [
  "headphone-no-mutation-runtime-dry-run-latest.json",
  "monitor-no-mutation-runtime-dry-run-latest.json",
  "game-console-no-mutation-runtime-dry-run-latest.json",
  "desktop-no-mutation-runtime-dry-run-latest.json",
  "speaker-no-mutation-runtime-dry-run-latest.json",
  "camera-no-mutation-runtime-dry-run-latest.json",
  "home-appliance-no-mutation-runtime-dry-run-latest.json",
];

function readRuntimeReport(file: string): RuntimeReport {
  const fullPath = path.join(process.cwd(), "reports", file);
  return JSON.parse(fs.readFileSync(fullPath, "utf8")) as RuntimeReport;
}

function statusFor(report: RuntimeReport): "report_only_pass" | "owner_review_needed" | "blocked" {
  const failedRows = Number(report.metrics.failedRows ?? 0);
  const leaks = Number(report.metrics.leaks ?? 0);
  const forbiddenRuntimeRows =
    Number(report.metrics.runtimeApprovedRows ?? 0) +
    Number(report.metrics.publicPromotionRows ?? 0) +
    Number(report.metrics.candidatePoolWiringRows ?? 0);

  if (forbiddenRuntimeRows > 0) {
    return "blocked";
  }
  if (failedRows > 0 || leaks > 0) {
    return "owner_review_needed";
  }
  return "report_only_pass";
}

const rows = runtimeReportFiles.map((file) => {
  const report = readRuntimeReport(file);
  return {
    file,
    category: report.category,
    conclusion: report.conclusion,
    rows: Number(report.metrics.rows ?? report.metrics.probes ?? 0),
    failedRows: Number(report.metrics.failedRows ?? report.metrics.leaks ?? 0),
    candidatePositiveOnlyRows: Number(report.metrics.candidatePositiveOnlyRows ?? 0),
    runtimeApprovedRows: Number(report.metrics.runtimeApprovedRows ?? 0),
    publicPromotionRows: Number(report.metrics.publicPromotionRows ?? 0),
    candidatePoolWiringRows: Number(report.metrics.candidatePoolWiringRows ?? 0),
    status: statusFor(report),
    failedCaseIds: (report.failedRows ?? []).map((row) => String(row.caseId ?? row.probeId ?? "unknown")),
  };
});

const statusCounts = rows.reduce(
  (acc, row) => {
    acc[row.status] += 1;
    return acc;
  },
  {
    report_only_pass: 0,
    owner_review_needed: 0,
    blocked: 0,
  },
);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  scope: "category runtime readiness board from no-mutation dry-run artifacts",
  metrics: {
    categoriesChecked: rows.length,
    reportOnlyPass: statusCounts.report_only_pass,
    ownerReviewNeeded: statusCounts.owner_review_needed,
    blocked: statusCounts.blocked,
    passRate: `${Math.round((statusCounts.report_only_pass / rows.length) * 100)}%`,
  },
  rows,
  interpretation: [
    "report_only_pass means dry-run/parser evidence currently has no failed rows and no forbidden runtime/public/candidate-pool flags.",
    "owner_review_needed means report-only evidence found a real parser/classification policy gap, but subagent must not patch runtime directly.",
    "blocked would mean forbidden approval/mutation flags appeared in report artifacts.",
  ],
  nextQueue: [
    {
      priority: 1,
      category: "headphone_discovered",
      action: "main-agent review for accessory gate and AirPods Max manual-review policy tension",
    },
    {
      priority: 2,
      category: "game_console_body_narrow",
      action: "main-agent review for Switch 2 manual-review gate",
    },
    {
      priority: 3,
      category: "monitor/desktop/speaker/camera/home_appliance",
      action: "continue report-only artifact consistency and fixture policy expansion; no runtime patch needed from current dry-runs",
    },
  ],
  conclusion:
    statusCounts.blocked === 0
      ? "category_runtime_readiness_board_completed_no_forbidden_flags"
      : "category_runtime_readiness_board_blocked_forbidden_flags_found",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "category-runtime-readiness-board-latest.json");
const mdPath = path.join(reportsDir, "category-runtime-readiness-board-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Category Runtime Readiness Board",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- categoriesChecked: ${report.metrics.categoriesChecked}`,
  `- reportOnlyPass: ${report.metrics.reportOnlyPass}`,
  `- ownerReviewNeeded: ${report.metrics.ownerReviewNeeded}`,
  `- blocked: ${report.metrics.blocked}`,
  `- passRate: ${report.metrics.passRate}`,
  "",
  "## Board",
  "",
  "| category | status | rows | failed | candidatePositiveOnly | runtime/public/candidatePool | failedCaseIds |",
  "| --- | --- | ---: | ---: | ---: | --- | --- |",
  ...rows.map(
    (row) =>
      `| ${row.category} | ${row.status} | ${row.rows} | ${row.failedRows} | ${row.candidatePositiveOnlyRows} | ${row.runtimeApprovedRows}/${row.publicPromotionRows}/${row.candidatePoolWiringRows} | ${row.failedCaseIds.join(", ") || "-"} |`,
  ),
  "",
  "## Interpretation",
  "",
  ...report.interpretation.map((line) => `- ${line}`),
  "",
  "## Next Queue",
  "",
  ...report.nextQueue.map((row) => `- P${row.priority} ${row.category}: ${row.action}`),
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      categoriesChecked: report.metrics.categoriesChecked,
      reportOnlyPass: report.metrics.reportOnlyPass,
      ownerReviewNeeded: report.metrics.ownerReviewNeeded,
      blocked: report.metrics.blocked,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
