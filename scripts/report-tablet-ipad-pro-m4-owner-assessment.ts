import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type LiveRead = {
  metrics: {
    freshLiveCandidates: number;
    manualReviewRows: number;
    holdRows: number;
    comparableKeys: number;
  };
  freshRows: Array<{
    pid: string;
    title: string;
    price: number;
    model: string | null;
    storageGb: number | null;
    connectivity: string | null;
    comparableKey: string | null;
  }>;
  manualRows: Array<{ reason: string }>;
  holdRows: Array<{ reason: string }>;
};

type SourceBackfill = {
  rows: Array<{
    modelCode: string;
    storagesGb: number[];
    connectivity: string[];
    sourceConfidence: string;
  }>;
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
  const live = await readJson<LiveRead>("tablet-ipad-pro-m4-live-read-wave-latest.json");
  const targetedLive = await readJson<LiveRead>("tablet-ipad-pro-m4-targeted-live-read-wave-latest.json");
  const source = await readJson<SourceBackfill>("tablet-ipad-pro-m4-source-backfill-latest.json");
  const sourceRows = source.rows.filter((row) => row.sourceConfidence === "high");
  const freshByPid = new Map<string, LiveRead["freshRows"][number]>();
  for (const row of [...live.freshRows, ...targetedLive.freshRows]) {
    freshByPid.set(row.pid, row);
  }
  const combinedFreshRows = [...freshByPid.values()];

  const rowsByKey = new Map<string, LiveRead["freshRows"]>();
  for (const row of combinedFreshRows) {
    if (!row.comparableKey) continue;
    rowsByKey.set(row.comparableKey, [...(rowsByKey.get(row.comparableKey) ?? []), row]);
  }
  const keyRows = [...rowsByKey.entries()].map(([key, rows]) => {
    const sample = rows[0];
    const sourceBacked = sourceRows.some((sourceRow) =>
      sourceRow.modelCode === sample.model
      && sourceRow.storagesGb.includes(Number(sample.storageGb))
      && sourceRow.connectivity.includes(String(sample.connectivity)),
    );
    return {
      comparableKey: key,
      model: sample.model,
      storageGb: sample.storageGb,
      connectivity: sample.connectivity,
      rows: rows.length,
      sourceBacked,
      pids: rows.map((row) => row.pid),
      medianPrice: rows.map((row) => row.price).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? null,
    };
  });

  const ownerReadyKeys = keyRows.filter((row) => row.rows >= 4 && row.sourceBacked);
  const promisingKeys = keyRows.filter((row) => row.rows >= 2 && row.sourceBacked && row.rows < 4);
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "tablet_discovered",
    target: "apple-ipad-pro-11-m4",
    sourceReports: [
      "tablet-ipad-pro-m4-live-read-wave-latest.json",
      "tablet-ipad-pro-m4-targeted-live-read-wave-latest.json",
      "tablet-ipad-pro-m4-source-backfill-latest.json",
    ],
    metrics: {
      firstWaveFreshLiveCandidates: live.metrics.freshLiveCandidates,
      targetedWaveFreshLiveCandidates: targetedLive.metrics.freshLiveCandidates,
      combinedUniqueFreshLiveCandidates: combinedFreshRows.length,
      manualReviewRows: live.metrics.manualReviewRows + targetedLive.metrics.manualReviewRows,
      holdRows: live.metrics.holdRows + targetedLive.metrics.holdRows,
      comparableKeys: keyRows.length,
      highConfidenceSourceRows: sourceRows.length,
      ownerReadyKeys: ownerReadyKeys.length,
      promisingKeys: promisingKeys.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    keyRows,
    ownerReadyKeys,
    promisingKeys,
    riskNotes: [
      "Do not aggregate Wi-Fi and Cellular rows.",
      "Do not aggregate 256GB, 512GB, 1TB, and 2TB rows.",
      "Apple Pencil, Magic Keyboard, case, cover, film, pouch, and plus signs stay manual-review unless body-only pricing is proven.",
      "13-inch M4 and iPad Air M4 must remain separate from iPad Pro 11-inch M4.",
    ],
    conclusion:
      ownerReadyKeys.length > 0
        ? "tablet_ipad_pro_11_m4_owner_assessment_ready_report_only"
        : "tablet_ipad_pro_11_m4_owner_assessment_promising_but_not_ready_report_only",
    nextStep:
      ownerReadyKeys.length > 0
        ? "Prepare execution checklist after a second no-write wave confirms key density."
        : "Keep tablet report-only; run a second targeted wave for 256GB Wi-Fi and 256GB Cellular before owner-ready.",
  };

  const jsonPath = path.join(reportsDir, "tablet-ipad-pro-m4-owner-assessment-latest.json");
  const mdPath = path.join(reportsDir, "tablet-ipad-pro-m4-owner-assessment-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Tablet iPad Pro M4 Owner Assessment",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- runtime/public/candidate wiring: false/false/false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- firstWaveFreshLiveCandidates: ${report.metrics.firstWaveFreshLiveCandidates}`,
    `- targetedWaveFreshLiveCandidates: ${report.metrics.targetedWaveFreshLiveCandidates}`,
    `- combinedUniqueFreshLiveCandidates: ${report.metrics.combinedUniqueFreshLiveCandidates}`,
    `- comparableKeys: ${report.metrics.comparableKeys}`,
    `- highConfidenceSourceRows: ${report.metrics.highConfidenceSourceRows}`,
    `- ownerReadyKeys: ${report.metrics.ownerReadyKeys}`,
    `- promisingKeys: ${report.metrics.promisingKeys}`,
    "",
    "## Key Rows",
    "",
    mdTable(
      ["key", "model", "storage", "connectivity", "rows", "sourceBacked", "medianPrice", "pids"],
      keyRows.map((row) => [row.comparableKey, row.model, row.storageGb, row.connectivity, row.rows, row.sourceBacked, row.medianPrice ?? "-", row.pids.join(", ")]),
    ),
    "",
    "## Risk Notes",
    "",
    ...report.riskNotes.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    freshLiveCandidates: report.metrics.combinedUniqueFreshLiveCandidates,
    ownerReadyKeys: report.metrics.ownerReadyKeys,
    promisingKeys: report.metrics.promisingKeys,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
