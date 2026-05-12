import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const detailSamplePath = path.join(reportsDir, "headphone-non-airpods-live-detail-sample-latest.json");

type DetailSample = {
  metrics: {
    sampledCandidateRows: number;
    stillCandidateRows: number;
    downgradedHoldRows: number;
    downgradeRate: number;
    stillCandidateSkus: number;
  };
  rows: Array<{
    pid: number;
    title: string;
    price: number;
    detailSkuId: string | null;
    detailComparableKey: string | null;
    saleStatus: string;
    holdSignal: string | null;
    decision: string;
  }>;
  downgradedRows: Array<{
    pid: number;
    title: string;
    price: number;
    detailSkuId: string | null;
    detailComparableKey: string | null;
    holdSignal: string | null;
    decision: string;
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
  const sample = JSON.parse(await readFile(detailSamplePath, "utf-8")) as DetailSample;
  const stillRows = sample.rows.filter((row) => row.decision === "still_candidate");

  const gateRules = [
    {
      stage: "pre_acquisition_detail_required",
      rule: "Do not acquire non-AirPods headphone search positives without a fresh detail fetch.",
      reason: "The latest balanced detail sample still downgraded 19/60 rows after detail fetch.",
    },
    {
      stage: "hard_hold",
      rule: "Reject inactive saleStatus values such as SOLD_OUT or RESERVED.",
      reason: "Sold/reserved rows remain present in search results.",
    },
    {
      stage: "hard_hold",
      rule: "Reject buying, sold text, damaged/parts, counterfeit/compatible, accessory-only, earcap/pad/cable-only rows.",
      reason: "These rows can share exact model tokens but are not comparable to full headphones.",
    },
    {
      stage: "hard_hold",
      rule: "Reject earbuds / true wireless / open-ear rows even when brand or family token overlaps.",
      reason: "Bose QC Ultra and Sennheiser Accentum families can include headphone and earbud/open variants.",
    },
    {
      stage: "candidate_subset",
      rule: "Only rows with target headphone SKU + stable comparableKey + SELLING + no hold signal may enter tiny no-write rehearsal.",
      reason: "This keeps model-lane acquisition conservative while retaining useful non-AirPods coverage.",
    },
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
    sourceReport: "reports/headphone-non-airpods-live-detail-sample-latest.json",
    metrics: {
      sampledCandidateRows: sample.metrics.sampledCandidateRows,
      stillCandidateRows: sample.metrics.stillCandidateRows,
      downgradedHoldRows: sample.metrics.downgradedHoldRows,
      downgradeRate: sample.metrics.downgradeRate,
      stillCandidateSkus: sample.metrics.stillCandidateSkus,
      proposedGateRules: gateRules.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    downgradeByHoldSignal: countBy(sample.downgradedRows, (row) => row.holdSignal ?? "unknown"),
    stillBySku: countBy(stillRows, (row) => row.detailSkuId ?? "unknown"),
    gateRules,
    allowedNoWriteRehearsalRows: stillRows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      skuId: row.detailSkuId,
      comparableKey: row.detailComparableKey,
      saleStatus: row.saleStatus,
    })),
    conclusion: "headphone_non_airpods_detail_gate_ready_for_tiny_no_write_rehearsal",
    nextStep: "Create a tiny no-write acquisition rehearsal plan by SKU lane; do not write DB or candidate pool.",
  };

  const jsonPath = path.join(reportsDir, "headphone-non-airpods-detail-gate-proposal-latest.json");
  const mdPath = path.join(reportsDir, "headphone-non-airpods-detail-gate-proposal-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Non-AirPods Detail Gate Proposal",
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
    `- sampledCandidateRows: ${report.metrics.sampledCandidateRows}`,
    `- stillCandidateRows: ${report.metrics.stillCandidateRows}`,
    `- downgradedHoldRows: ${report.metrics.downgradedHoldRows}`,
    `- downgradeRate: ${report.metrics.downgradeRate}`,
    `- stillCandidateSkus: ${report.metrics.stillCandidateSkus}`,
    "",
    "## Downgrade by Hold Signal",
    "",
    mdTable(["holdSignal", "count"], Object.entries(report.downgradeByHoldSignal)),
    "",
    "## Still Candidate by SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.stillBySku)),
    "",
    "## Proposed Gate Rules",
    "",
    mdTable(["stage", "rule", "reason"], gateRules.map((rule) => [rule.stage, rule.rule, rule.reason])),
    "",
    "## Allowed No-Write Rehearsal Rows",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key"],
      report.allowedNoWriteRehearsalRows.slice(0, 80).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        row.comparableKey ?? "",
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
        stillCandidateRows: report.metrics.stillCandidateRows,
        stillCandidateSkus: report.metrics.stillCandidateSkus,
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
