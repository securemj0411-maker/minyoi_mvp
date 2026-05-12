import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonReport = {
  metrics?: Record<string, number>;
  decision?: string;
  nextStep?: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const inputs = [
  {
    file: "reports/headphone-repeat-dry-run-review-packet-latest.json",
    label: "repeat dry-run review",
  },
  {
    file: "reports/headphone-broader-brand-sku-evidence-plan-latest.json",
    label: "broader brand/SKU evidence plan",
  },
  {
    file: "reports/headphone-broader-brand-sku-source-backfill-latest.json",
    label: "broader brand/SKU source backfill",
  },
  {
    file: "reports/headphone-brand-sku-guardrail-fixture-plan-latest.json",
    label: "brand/SKU guardrail fixture plan",
  },
  {
    file: "reports/headphone-brand-sku-guardrail-dry-run-result-latest.json",
    label: "brand/SKU guardrail dry-run result",
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), file), "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const rows = [];
  for (const input of inputs) {
    const report = await readJson<JsonReport>(input.file);
    rows.push({
      ...input,
      metrics: report.metrics ?? {},
      decision: report.decision ?? null,
      nextStep: report.nextStep ?? null,
    });
  }

  const repeat = rows.find((row) => row.label === "repeat dry-run review")?.metrics ?? {};
  const guardrail = rows.find((row) => row.label === "brand/SKU guardrail dry-run result")?.metrics ?? {};

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Headphone report-only status rollup after repeat dry-run and brand/SKU guardrails",
    metrics: {
      repeatDryRunRows: repeat.rows ?? 0,
      repeatDryRunPassedRows: repeat.passedRows ?? 0,
      repeatDryRunFailedRows: repeat.failedRows ?? 0,
      brandSkuGuardrailRows: guardrail.rows ?? 0,
      brandSkuGuardrailPassedRows: guardrail.passedRows ?? 0,
      brandSkuGuardrailFailedRows: guardrail.failedRows ?? 0,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    rows,
    currentConclusion: [
      "Headphone repeat dry-run is stable report-only: 14 rows passed, 0 failed.",
      "Razer/Beats broader brand/SKU evidence is backfilled but remains non-positive.",
      "AirPods Max connector/generation ambiguity remains manual-review.",
      "No runtime approval, public promotion, candidate-pool wiring, or DB work is present.",
    ],
    nextStep: "Owner/main-agent can either keep report-only, request broader brand/SKU sample mining, or separately approve narrow runtime review.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-report-only-status-rollup-latest.json"), JSON.stringify(report, null, 2));

  const tableRows = rows.map((row) => {
    const metricSummary = Object.entries(row.metrics)
      .slice(0, 6)
      .map(([key, value]) => `${key}=${value}`)
      .join("<br>");
    return `| ${row.label} | ${row.file} | ${row.decision ?? "-"} | ${metricSummary} |`;
  });

  const md = [
    "# Headphone Report-Only Status Rollup",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only rollup for headphone_discovered after repeat dry-run and broader brand/SKU guardrails. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- repeat dry-run rows/pass/fail: ${report.metrics.repeatDryRunRows}/${report.metrics.repeatDryRunPassedRows}/${report.metrics.repeatDryRunFailedRows}`,
    `- brand/SKU guardrail rows/pass/fail: ${report.metrics.brandSkuGuardrailRows}/${report.metrics.brandSkuGuardrailPassedRows}/${report.metrics.brandSkuGuardrailFailedRows}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Artifact Rows",
    "",
    "| label | file | decision | metric_summary |",
    "| --- | --- | --- | --- |",
    ...tableRows,
    "",
    "## Current Conclusion",
    "",
    ...report.currentConclusion.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-report-only-status-rollup-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-report-only-status-rollup-latest.json");
  console.log("wrote reports/headphone-report-only-status-rollup-latest.md");
  console.log(`headphone status rollup: repeat_pass=${report.metrics.repeatDryRunPassedRows}, guardrail_pass=${report.metrics.brandSkuGuardrailPassedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
