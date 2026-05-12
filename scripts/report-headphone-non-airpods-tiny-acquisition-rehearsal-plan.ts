import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const gateProposalPath = path.join(reportsDir, "headphone-non-airpods-detail-gate-proposal-latest.json");

type GateProposal = {
  allowedNoWriteRehearsalRows: Array<{
    pid: number;
    title: string;
    price: number;
    skuId: string | null;
    comparableKey: string | null;
    saleStatus: string;
  }>;
  stillBySku: Record<string, number>;
};

const STRICT_LANES = new Set([
  "sennheiser-accentum",
  "bose-qc-ultra",
  "sony-wh-ch720n",
  "sennheiser-hd569",
  "beats-solo4",
]);

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 78) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const gate = JSON.parse(await readFile(gateProposalPath, "utf-8")) as GateProposal;
  const rows = gate.allowedNoWriteRehearsalRows;
  const bySku = countBy(rows, (row) => row.skuId ?? "unknown");
  const strictRows = rows.filter((row) => row.skuId && STRICT_LANES.has(row.skuId));
  const lowRiskRows = rows.filter((row) => !row.skuId || !STRICT_LANES.has(row.skuId));

  const commonPreWriteChecks = [
    "fresh_detail_refetch",
    "sale_status_still_selling",
    "same_target_sku",
    "same_comparable_key",
    "no_buying_sold_reserved_text",
    "no_parts_accessory_cable_pad_earcap_damage_text",
    "no_counterfeit_or_compatible_text",
  ];
  const strictLaneExtraChecks = [
    "no_earbuds_true_wireless_open_ear_wording",
    "explicit_headphone_or_headset_context_required",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-detail-gate-proposal-latest.json",
    metrics: {
      allowedRows: rows.length,
      skuLanes: Object.keys(bySku).length,
      strictLaneRows: strictRows.length,
      lowerRiskRows: lowRiskRows.length,
      maxFutureWriteCap: Math.min(rows.length, 24),
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
      dbMutationRows: 0,
    },
    bySku,
    strictLanes: [...STRICT_LANES],
    commonPreWriteChecks,
    strictLaneExtraChecks,
    payloadDraft: rows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      skuId: row.skuId,
      comparableKey: row.comparableKey,
      saleStatus: row.saleStatus,
      laneRisk: row.skuId && STRICT_LANES.has(row.skuId) ? "strict" : "standard",
      requiredPreWriteChecks: row.skuId && STRICT_LANES.has(row.skuId)
        ? [...commonPreWriteChecks, ...strictLaneExtraChecks]
        : commonPreWriteChecks,
    })),
    conclusion: rows.length >= 24 && Object.keys(bySku).length >= 8
      ? "headphone_non_airpods_tiny_no_write_acquisition_rehearsal_plan_ready"
      : "headphone_non_airpods_tiny_no_write_acquisition_rehearsal_needs_more_clean_rows",
    nextStep: "Owner/main-agent can review this plan; implementation must stay no-write unless explicitly approved.",
  };

  const jsonPath = path.join(reportsDir, "headphone-non-airpods-tiny-acquisition-rehearsal-plan-latest.json");
  const mdPath = path.join(reportsDir, "headphone-non-airpods-tiny-acquisition-rehearsal-plan-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Non-AirPods Tiny Acquisition Rehearsal Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- allowedRows: ${report.metrics.allowedRows}`,
    `- skuLanes: ${report.metrics.skuLanes}`,
    `- strictLaneRows: ${report.metrics.strictLaneRows}`,
    `- lowerRiskRows: ${report.metrics.lowerRiskRows}`,
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    "",
    "## SKU Lanes",
    "",
    mdTable(["sku", "count"], Object.entries(bySku)),
    "",
    "## Strict Lanes",
    "",
    ...report.strictLanes.map((lane) => `- ${lane}`),
    "",
    "## Required Checks",
    "",
    "### Common",
    "",
    ...commonPreWriteChecks.map((check) => `- ${check}`),
    "",
    "### Strict Lane Extra",
    "",
    ...strictLaneExtraChecks.map((check) => `- ${check}`),
    "",
    "## Payload Draft",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key", "laneRisk"],
      report.payloadDraft.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        row.comparableKey ?? "",
        row.laneRisk,
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.conclusion,
        allowedRows: rows.length,
        skuLanes: report.metrics.skuLanes,
        strictLaneRows: report.metrics.strictLaneRows,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
