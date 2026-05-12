import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type ScopeRow = {
  pid: number;
  title: string;
  price: number | null;
  runtimeSkuId: string | null;
  ruleMatchSkuId: string | null;
  comparableKey: string | null;
  needsReview: boolean;
  decision: "candidate_positive" | "manual_review" | "negative_hold" | "out_of_scope";
  riskFlags: string[];
  lastSeenAt: string | null;
  detailEnrichedAt: string | null;
};

type RealRawScopeReport = {
  generatedAt: string;
  metrics: {
    rawFetchedUnique: number;
    candidatePositive: number;
    manualReview: number;
    negativeHold: number;
    outOfScope: number;
    candidateRiskRows: number;
  };
  candidateRows: ScopeRow[];
  candidateRiskRows: ScopeRow[];
  decision: string;
};

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 64) {
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

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const source = await readJson<RealRawScopeReport>("reports/headphone-real-raw-runtime-scope-latest.json");
  const generatedAt = new Date().toISOString();
  const eligibleRows = source.candidateRows
    .filter((row) => row.decision === "candidate_positive")
    .filter((row) => !source.candidateRiskRows.some((risk) => risk.pid === row.pid))
    .filter((row) => row.runtimeSkuId === "airpods-max" || row.ruleMatchSkuId === "airpods-max")
    .sort((a, b) => String(b.lastSeenAt ?? "").localeCompare(String(a.lastSeenAt ?? "")));

  const batchSize = 25;
  const batches = [];
  for (let i = 0; i < eligibleRows.length; i += batchSize) {
    const rows = eligibleRows.slice(i, i + batchSize);
    batches.push({
      batchNo: batches.length + 1,
      size: rows.length,
      pids: rows.map((row) => row.pid),
      comparableKeys: countBy(rows, (row) => row.comparableKey ?? "null"),
    });
  }

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    scope: "internal no-mutation reparse/backfill scope plan from real raw AirPods Max rows",
    sourceReport: "reports/headphone-real-raw-runtime-scope-latest.json",
    sourceGeneratedAt: source.generatedAt,
    sourceMetrics: source.metrics,
    eligibleRows: eligibleRows.length,
    byComparableKey: countBy(eligibleRows, (row) => row.comparableKey ?? "null"),
    batchSize,
    batches,
    sampleRows: eligibleRows.slice(0, 60),
    decision:
      eligibleRows.length >= 50 && source.metrics.candidateRiskRows === 0
        ? "airpods_max_headphone_internal_reparse_scope_ready_for_dry_run_apply_design"
        : "headphone_internal_reparse_scope_not_ready",
    nextStep:
      eligibleRows.length >= 50 && source.metrics.candidateRiskRows === 0
        ? "Draft a no-mutation apply rehearsal that snapshots these pids and computes patch diffs only; do not write candidate pool or public catalog."
        : "Collect more real rows or strengthen guardrails before any apply rehearsal.",
  };

  await writeFile(path.join(reportsDir, "headphone-internal-reparse-scope-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Internal Reparse Scope Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Scope",
    "",
    "- Category lane: `headphone_discovered`",
    "- Current eligible runtime lane: `AirPods Max` only",
    "- Reason: the real raw sample produced clean AirPods Max rows, but did not produce enough Sony/Bose non-AirPods rows to generalize broad headphone.",
    "",
    "## Metrics",
    "",
    `- source rawFetchedUnique: ${source.metrics.rawFetchedUnique}`,
    `- source candidatePositive: ${source.metrics.candidatePositive}`,
    `- source candidateRiskRows: ${source.metrics.candidateRiskRows}`,
    `- eligibleRows: ${eligibleRows.length}`,
    `- batchSize: ${batchSize}`,
    `- batches: ${batches.length}`,
    "",
    "## Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(report.byComparableKey)),
    "",
    "## Batch Plan",
    "",
    mdTable(
      ["batch", "size", "comparableKeys", "pidSample"],
      batches.map((batch) => [
        batch.batchNo,
        batch.size,
        JSON.stringify(batch.comparableKeys),
        batch.pids.slice(0, 8).join(", "),
      ]),
    ),
    "",
    "## Sample Rows",
    "",
    mdTable(
      ["pid", "title", "price", "comparableKey", "lastSeenAt"],
      eligibleRows.slice(0, 30).map((row) => [row.pid, compact(row.title), row.price, row.comparableKey, row.lastSeenAt]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-internal-reparse-scope-plan-latest.md"), `${md}\n`);
  console.log(`headphone internal reparse scope: eligible=${eligibleRows.length}, batches=${batches.length}, decision=${report.decision}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
