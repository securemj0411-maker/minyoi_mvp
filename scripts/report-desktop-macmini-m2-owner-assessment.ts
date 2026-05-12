import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type LiveReadReport = {
  metrics: {
    freshLiveCandidates: number;
    manualReviewRows: number;
    holdRows: number;
    comparableKeys: number;
  };
  comparableKeys: string[];
  freshRows: Array<{
    pid: string;
    title: string;
    price: number;
    model: string | null;
    comparableKey: string | null;
    ramGb: number | null;
    storageGb: number | null;
    reason: string;
  }>;
  manualRows: Array<{ reason: string }>;
  holdRows: Array<{ reason: string }>;
};

type SourceBackfillReport = {
  metrics: {
    sourceRows: number;
    officialRows: number;
  };
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
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
  const live = await readJson<LiveReadReport>("desktop-macmini-m2-live-read-wave-latest.json");
  const targeted = await readJson<LiveReadReport>("desktop-macmini-m2-targeted-live-read-wave-latest.json");
  const source = await readJson<SourceBackfillReport>("desktop-macmini-m2-source-backfill-latest.json");
  const rowsByKey = new Map<string, LiveReadReport["freshRows"]>();
  for (const row of [...live.freshRows, ...targeted.freshRows]) {
    if (!row.comparableKey) continue;
    const rows = rowsByKey.get(row.comparableKey) ?? [];
    if (!rows.some((existing) => existing.pid === row.pid)) {
      rowsByKey.set(row.comparableKey, [...rows, row]);
    }
  }
  const keyRows = [...rowsByKey.entries()].map(([key, rows]) => ({
    comparableKey: key,
    rows: rows.length,
    pids: rows.map((row) => row.pid),
    medianPrice: rows.map((row) => row.price).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? null,
  }));
  const largestKeyRows = Math.max(0, ...keyRows.map((row) => row.rows));
  const ownerReady = source.metrics.officialRows >= 2 && largestKeyRows >= 4;
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "desktop_pc_discovered",
    target: "apple-mac-mini-m2-family",
    sourceReports: [
      "desktop-macmini-m2-live-read-wave-latest.json",
      "desktop-macmini-m2-targeted-live-read-wave-latest.json",
      "desktop-macmini-m2-source-backfill-latest.json",
    ],
    metrics: {
      broadFreshLiveCandidates: live.metrics.freshLiveCandidates,
      targetedFreshLiveCandidates: targeted.metrics.freshLiveCandidates,
      freshLiveCandidates: [...new Set([...live.freshRows, ...targeted.freshRows].map((row) => row.pid))].length,
      comparableKeys: live.metrics.comparableKeys,
      targetedComparableKeys: targeted.metrics.comparableKeys,
      largestComparableKeyRows: largestKeyRows,
      manualReviewRows: live.metrics.manualReviewRows,
      holdRows: live.metrics.holdRows,
      officialSourceRows: source.metrics.officialRows,
      ownerReady,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    keyRows,
    riskNotes: [
      "Mac mini M2 and M2 Pro must be separate model lanes.",
      "RAM and SSD are price-critical axes; do not compare rows without both.",
      "Bundle rows with docks, hubs, keyboards, mice, or monitor context must stay manual-review.",
      "The combined broad+targeted waves show demand, but the largest comparable key still has fewer than 4 unique rows.",
    ],
    conclusion: ownerReady
      ? "desktop_macmini_m2_owner_assessment_ready_report_only"
      : "desktop_macmini_m2_owner_assessment_promising_but_key_rows_thin_report_only",
    nextStep: ownerReady
      ? "Prepare a tiny internal-only owner packet after P0 stabilization; do not execute."
      : "Run one more targeted no-write wave for M2 16/512 and M2 Pro 16/512, then consider owner packet if either key reaches 4 rows.",
  };

  const jsonPath = path.join(reportsDir, "desktop-macmini-m2-owner-assessment-latest.json");
  const mdPath = path.join(reportsDir, "desktop-macmini-m2-owner-assessment-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Desktop Mac mini M2 Owner Assessment",
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
    `- broadFreshLiveCandidates: ${report.metrics.broadFreshLiveCandidates}`,
    `- targetedFreshLiveCandidates: ${report.metrics.targetedFreshLiveCandidates}`,
    `- uniqueFreshLiveCandidates: ${report.metrics.freshLiveCandidates}`,
    `- comparableKeys: ${report.metrics.comparableKeys}`,
    `- targetedComparableKeys: ${report.metrics.targetedComparableKeys}`,
    `- largestComparableKeyRows: ${report.metrics.largestComparableKeyRows}`,
    `- officialSourceRows: ${report.metrics.officialSourceRows}`,
    `- ownerReady: ${report.metrics.ownerReady}`,
    "",
    "## Comparable Key Rows",
    "",
    mdTable(
      ["comparableKey", "rows", "medianPrice", "pids"],
      keyRows.map((row) => [row.comparableKey, row.rows, row.medianPrice ?? "-", row.pids.join(", ")]),
    ),
    "",
    "## Risk Notes",
    "",
    ...report.riskNotes.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    freshLiveCandidates: report.metrics.freshLiveCandidates,
    comparableKeys: report.metrics.comparableKeys,
    largestComparableKeyRows: report.metrics.largestComparableKeyRows,
    ownerReady: report.metrics.ownerReady,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
