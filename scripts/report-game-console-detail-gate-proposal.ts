import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const detailSamplePath = path.join(reportsDir, "game-console-live-detail-sample-latest.json");

type DetailSample = {
  metrics: {
    sampledCandidateRows: number;
    stillCandidateRows: number;
    downgradedHoldRows: number;
    downgradeRate: number;
  };
  downgradedRows: Array<{
    pid: number;
    title: string;
    price: number;
    comparableKey: string | null;
    detailComparableKey: string | null;
    decision: string;
    holdSignal: string | null;
    detailReasons: string[];
  }>;
  rows: Array<{
    pid: number;
    title: string;
    price: number;
    comparableKey: string | null;
    detailComparableKey: string | null;
    decision: string;
    saleStatus: string;
    holdSignal: string | null;
    detailReasons: string[];
  }>;
};

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 72) {
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
  const downgradeByHoldSignal = countBy(sample.downgradedRows, (row) => row.holdSignal ?? "unknown");
  const stillRows = sample.rows.filter((row) => row.decision === "still_candidate");

  const gateRules = [
    {
      stage: "pre_acquisition_detail_required",
      rule: "Do not acquire game-console search-only positives without a fresh detail fetch.",
      reason: "The latest sample downgraded 67.5% of title-only positives after detail fetch.",
    },
    {
      stage: "hard_hold",
      rule: "Reject inactive saleStatus values such as SOLD_OUT or RESERVED.",
      reason: "Inactive detail saleStatus was the dominant downgrade source.",
    },
    {
      stage: "hard_hold",
      rule: "Reject explicit sold/buying/damaged/parts/accessory-only text found in title or description.",
      reason: "Sellers often update title/description or detail state without search rows being enough.",
    },
    {
      stage: "manual_review_or_hold",
      rule: "Treat game-title/software bundle, chip-included, many-title, and accessory-heavy rows as not comparable to clean body/full-set rows.",
      reason: "Bundle rows distorted Switch OLED full-set pricing and should not enter body-only/full-set lanes directly.",
    },
    {
      stage: "candidate_subset",
      rule: "Only rows with SELLING + stable comparableKey + no hold signal may proceed to tiny no-write acquisition rehearsal.",
      reason: "This keeps expansion conservative while allowing market data collection design to move forward.",
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
    category: "game_console_body_narrow",
    sourceReport: "reports/game-console-live-detail-sample-latest.json",
    metrics: {
      sampledCandidateRows: sample.metrics.sampledCandidateRows,
      stillCandidateRows: sample.metrics.stillCandidateRows,
      downgradedHoldRows: sample.metrics.downgradedHoldRows,
      downgradeRate: sample.metrics.downgradeRate,
      proposedGateRules: gateRules.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    downgradeByHoldSignal,
    gateRules,
    allowedNoWriteRehearsalRows: stillRows.map((row) => ({
      pid: row.pid,
      title: row.title,
      price: row.price,
      comparableKey: row.detailComparableKey ?? row.comparableKey,
      saleStatus: row.saleStatus,
    })),
    conclusion: "game_console_detail_gate_required_before_any_db_acquisition_or_public_promotion",
    nextStep: "Run a tiny no-write acquisition rehearsal only on allowedNoWriteRehearsalRows; do not write DB or candidate pool.",
  };

  const jsonPath = path.join(reportsDir, "game-console-detail-gate-proposal-latest.json");
  const mdPath = path.join(reportsDir, "game-console-detail-gate-proposal-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console Detail Gate Proposal",
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
    `- proposedGateRules: ${report.metrics.proposedGateRules}`,
    "",
    "## Downgrade by Hold Signal",
    "",
    mdTable(["holdSignal", "count"], Object.entries(downgradeByHoldSignal)),
    "",
    "## Proposed Gate Rules",
    "",
    mdTable(
      ["stage", "rule", "reason"],
      gateRules.map((rule) => [rule.stage, rule.rule, rule.reason]),
    ),
    "",
    "## Allowed No-Write Rehearsal Rows",
    "",
    mdTable(
      ["pid", "title", "price", "key", "saleStatus"],
      report.allowedNoWriteRehearsalRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.comparableKey ?? "",
        row.saleStatus,
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
        proposedGateRules: gateRules.length,
        allowedNoWriteRehearsalRows: report.allowedNoWriteRehearsalRows.length,
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
