import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type StatusRollup = {
  metrics: {
    repeatDryRunRows: number;
    repeatDryRunPassedRows: number;
    repeatDryRunFailedRows: number;
    brandSkuGuardrailRows: number;
    brandSkuGuardrailPassedRows: number;
    brandSkuGuardrailFailedRows: number;
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolWiringRows: number;
  };
  currentConclusion: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const rollup = await readJson<StatusRollup>(path.join(reportsDir, "headphone-report-only-status-rollup-latest.json"));

  const decisionOptions = [
    {
      option: "keep_report_only",
      allowedNow: true,
      requiresOwnerApproval: false,
      upside: "Safest; preserves evidence and avoids premature runtime work.",
      risk: "Does not improve runtime behavior.",
      nextAction: "Archive current headphone report-only evidence as ready for future review.",
    },
    {
      option: "broader_sample_mining",
      allowedNow: true,
      requiresOwnerApproval: false,
      upside: "Improves confidence for Razer/Beats and other branded headphone SKUs without runtime mutation.",
      risk: "Needs more local/Bunjang sample rows; current API/sample coverage may be thin.",
      nextAction: "Create a report-only mining target list for Razer, Beats, B&O, Logitech, Corsair, Dali, and other headphone brands.",
    },
    {
      option: "request_narrow_runtime_review",
      allowedNow: false,
      requiresOwnerApproval: true,
      upside: "Could convert stable report-only candidate behavior into real implementation after approval.",
      risk: "Would touch forbidden runtime/parser/catalog/candidate-pool surfaces unless separately authorized.",
      nextAction: "Stop and get explicit owner/main-agent approval for runtime review scope.",
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Owner decision brief for headphone report-only status",
    inputFiles: ["reports/headphone-report-only-status-rollup-latest.json"],
    metrics: {
      repeatDryRunRows: rollup.metrics.repeatDryRunRows,
      repeatDryRunPassedRows: rollup.metrics.repeatDryRunPassedRows,
      repeatDryRunFailedRows: rollup.metrics.repeatDryRunFailedRows,
      brandSkuGuardrailRows: rollup.metrics.brandSkuGuardrailRows,
      brandSkuGuardrailPassedRows: rollup.metrics.brandSkuGuardrailPassedRows,
      brandSkuGuardrailFailedRows: rollup.metrics.brandSkuGuardrailFailedRows,
      decisionOptions: decisionOptions.length,
      allowedNowOptions: decisionOptions.filter((row) => row.allowedNow).length,
      ownerApprovalRequiredOptions: decisionOptions.filter((row) => row.requiresOwnerApproval).length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    currentConclusion: rollup.currentConclusion,
    decisionOptions,
    recommendation: "Continue with broader_sample_mining if staying within report-only boundaries; request_narrow_runtime_review requires separate explicit approval.",
    nextStep: "Create headphone broader sample mining target plan for report-only evidence expansion.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-report-only-owner-decision-brief-latest.json"), JSON.stringify(report, null, 2));

  const rows = decisionOptions.map((row) => `| ${row.option} | ${row.allowedNow ? "yes" : "no"} | ${row.requiresOwnerApproval ? "yes" : "no"} | ${row.upside} | ${row.risk} | ${row.nextAction} |`);
  const md = [
    "# Headphone Report-Only Owner Decision Brief",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only owner decision brief for headphone_discovered. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- repeat dry-run rows/pass/fail: ${report.metrics.repeatDryRunRows}/${report.metrics.repeatDryRunPassedRows}/${report.metrics.repeatDryRunFailedRows}`,
    `- brand/SKU guardrail rows/pass/fail: ${report.metrics.brandSkuGuardrailRows}/${report.metrics.brandSkuGuardrailPassedRows}/${report.metrics.brandSkuGuardrailFailedRows}`,
    `- allowed-now / owner-required options: ${report.metrics.allowedNowOptions}/${report.metrics.ownerApprovalRequiredOptions}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Decision Options",
    "",
    "| option | allowed_now | owner_approval_required | upside | risk | next_action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Recommendation",
    "",
    report.recommendation,
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-report-only-owner-decision-brief-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-report-only-owner-decision-brief-latest.json");
  console.log("wrote reports/headphone-report-only-owner-decision-brief-latest.md");
  console.log(`headphone owner decision brief: options=${decisionOptions.length}, allowed_now=${report.metrics.allowedNowOptions}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
