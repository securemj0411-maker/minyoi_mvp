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
  freshRows: Array<{
    pid: string;
    title: string;
    price: number;
    model: string | null;
    comparableKey: string | null;
    reason: string;
  }>;
  manualRows: Array<{ reason: string; model: string | null }>;
  holdRows: Array<{ reason: string }>;
};

type SourceBackfillReport = {
  rows: Array<{
    modelCode: string;
    sourceConfidence: string;
  }>;
  metrics: {
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
  const live = await readJson<LiveReadReport>("game-console-ps5-live-read-wave-latest.json");
  const source = await readJson<SourceBackfillReport>("game-console-ps5-source-backfill-latest.json");
  const sourceModels = new Set(source.rows.filter((row) => row.sourceConfidence === "high").map((row) => row.modelCode));
  const rowsByKey = new Map<string, LiveReadReport["freshRows"]>();
  for (const row of live.freshRows) {
    if (!row.comparableKey) continue;
    rowsByKey.set(row.comparableKey, [...(rowsByKey.get(row.comparableKey) ?? []), row]);
  }
  const keyRows = [...rowsByKey.entries()].map(([key, rows]) => {
    const modelCode = key.replace(/^game_console\|/, "").replace(/\|body$/, "").replaceAll("_", "-");
    return {
      comparableKey: key,
      modelCode,
      rows: rows.length,
      sourceBacked: sourceModels.has(modelCode) || (modelCode.startsWith("playstation-5-slim") && sourceModels.has("playstation-5-slim-family")),
      pids: rows.map((row) => row.pid),
      medianPrice: rows.map((row) => row.price).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? null,
    };
  });
  const ownerReadyKeys = keyRows.filter((row) => row.rows >= 4 && row.sourceBacked && !row.modelCode.includes("slim"));
  const slimPromisingKeys = keyRows.filter((row) => row.modelCode.includes("slim") && row.rows >= 2);
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "game_console_body_narrow",
    target: "playstation-5-body-family",
    sourceReports: [
      "game-console-ps5-live-read-wave-latest.json",
      "game-console-ps5-source-backfill-latest.json",
    ],
    metrics: {
      freshLiveCandidates: live.metrics.freshLiveCandidates,
      manualReviewRows: live.metrics.manualReviewRows,
      holdRows: live.metrics.holdRows,
      comparableKeys: live.metrics.comparableKeys,
      officialSourceRows: source.metrics.officialRows,
      ownerReadyKeys: ownerReadyKeys.length,
      slimPromisingKeys: slimPromisingKeys.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
    },
    keyRows,
    ownerReadyKeys,
    slimPromisingKeys,
    riskNotes: [
      "Do not use broad game-console evidence as readiness; only PS5 body exact-edition rows count here.",
      "Disc, Digital, Slim Disc, Slim Digital, Pro, and standalone disc-drive accessory are separate lanes.",
      "Game/account/bundle rows stay manual-review even when the console body is present.",
      "Slim lanes look promising but need separate source and more row density before owner-ready.",
    ],
    conclusion:
      ownerReadyKeys.length >= 2
        ? "game_console_ps5_owner_assessment_disc_digital_ready_report_only"
        : "game_console_ps5_owner_assessment_needs_more_gates_report_only",
    nextStep:
      ownerReadyKeys.length >= 2
        ? "Prepare a PS5 Disc/Digital owner review packet after P0 stabilization; keep Slim lanes as promising only."
        : "Keep PS5 report-only and collect more exact-edition rows.",
  };

  const jsonPath = path.join(reportsDir, "game-console-ps5-owner-assessment-latest.json");
  const mdPath = path.join(reportsDir, "game-console-ps5-owner-assessment-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console PS5 Owner Assessment",
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
    `- freshLiveCandidates: ${report.metrics.freshLiveCandidates}`,
    `- comparableKeys: ${report.metrics.comparableKeys}`,
    `- officialSourceRows: ${report.metrics.officialSourceRows}`,
    `- ownerReadyKeys: ${report.metrics.ownerReadyKeys}`,
    `- slimPromisingKeys: ${report.metrics.slimPromisingKeys}`,
    "",
    "## Key Rows",
    "",
    mdTable(
      ["key", "modelCode", "rows", "sourceBacked", "medianPrice", "pids"],
      keyRows.map((row) => [row.comparableKey, row.modelCode, row.rows, row.sourceBacked, row.medianPrice ?? "-", row.pids.join(", ")]),
    ),
    "",
    "## Owner Ready Keys",
    "",
    ...ownerReadyKeys.map((row) => `- ${row.comparableKey} (${row.rows} rows)`),
    "",
    "## Slim Promising Keys",
    "",
    ...slimPromisingKeys.map((row) => `- ${row.comparableKey} (${row.rows} rows)`),
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
    ownerReadyKeys: report.metrics.ownerReadyKeys,
    slimPromisingKeys: report.metrics.slimPromisingKeys,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
