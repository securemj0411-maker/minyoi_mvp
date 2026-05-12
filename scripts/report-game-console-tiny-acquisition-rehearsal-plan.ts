import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const gateProposalPath = path.join(reportsDir, "game-console-detail-gate-proposal-latest.json");

type GateProposal = {
  allowedNoWriteRehearsalRows: Array<{
    pid: number;
    title: string;
    price: number;
    comparableKey: string | null;
    saleStatus: string;
  }>;
};

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
  const byComparableKey = countBy(rows, (row) => row.comparableKey ?? "unknown");

  const rehearsalSteps = [
    "Use only rows that passed live detail gate: SELLING, stable comparableKey, no sold/bundle/accessory/parts signal.",
    "Re-fetch detail immediately before any future write-cap rehearsal; stale detail result cannot be reused for production.",
    "If a row becomes SOLD_OUT/RESERVED or description changes into bundle/accessory/parts, drop it from rehearsal.",
    "Keep output as a report-only acquisition payload draft; do not upsert mvp_raw_listings or candidate pool.",
    "Require owner/main-agent approval before converting this plan into any DB-writing script.",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "game_console_body_narrow",
    sourceReport: "reports/game-console-detail-gate-proposal-latest.json",
    metrics: {
      allowedRows: rows.length,
      comparableKeys: Object.keys(byComparableKey).length,
      maxFutureWriteCap: Math.min(rows.length, 10),
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
      dbMutationRows: 0,
    },
    byComparableKey,
    rehearsalSteps,
    payloadDraft: rows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      comparableKey: row.comparableKey,
      saleStatus: row.saleStatus,
      requiredPreWriteChecks: [
        "fresh_detail_refetch",
        "sale_status_still_selling",
        "same_comparable_key",
        "no_bundle_accessory_parts_sold_text",
      ],
    })),
    conclusion: rows.length >= 8
      ? "game_console_tiny_no_write_acquisition_rehearsal_plan_ready"
      : "game_console_tiny_no_write_acquisition_rehearsal_needs_more_clean_rows",
    nextStep: "Owner/main-agent can review this plan; implementation must stay no-write unless explicitly approved.",
  };

  const jsonPath = path.join(reportsDir, "game-console-tiny-acquisition-rehearsal-plan-latest.json");
  const mdPath = path.join(reportsDir, "game-console-tiny-acquisition-rehearsal-plan-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console Tiny Acquisition Rehearsal Plan",
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
    `- comparableKeys: ${report.metrics.comparableKeys}`,
    `- maxFutureWriteCap: ${report.metrics.maxFutureWriteCap}`,
    "",
    "## Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(byComparableKey)),
    "",
    "## Rehearsal Steps",
    "",
    ...rehearsalSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Payload Draft",
    "",
    mdTable(
      ["pid", "title", "price", "key", "saleStatus"],
      rows.map((row) => [row.pid, compact(row.title), row.price, row.comparableKey ?? "", row.saleStatus]),
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
        comparableKeys: report.metrics.comparableKeys,
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
