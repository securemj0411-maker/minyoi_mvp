import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type Board = {
  entries: Array<{
    category: string;
    target: string;
    status: string;
    allowedRows: number;
    maxFutureWriteCap: number;
    passChecks: number;
    warningChecks: number;
    failedChecks: number;
    score: number | null;
    nextStep: string;
  }>;
};

type Boundary = {
  rows: Array<{
    category: string;
    target: string;
    hasOwnerPacket: boolean;
    hasExecutionChecklist: boolean;
    hasRuntimeReviewRequest: boolean;
    nextBoundaryStep: string;
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

function safetyClass(category: string) {
  if (category === "monitor_discovered") return "safest_exact_model";
  if (category === "speaker_audio_discovered") return "safe_but_thin";
  if (category === "tablet_discovered") return "single_key_safe_but_option_sensitive";
  if (category === "headphone_discovered") return "medium_parts_and_sku_boundary";
  if (category === "game_console_body_narrow") return "high_volume_but_bundle_edition_sensitive";
  return "blocked_or_unknown";
}

function recommendedOrder(category: string) {
  switch (category) {
    case "monitor_discovered":
      return 1;
    case "game_console_body_narrow":
      return 2;
    case "headphone_discovered":
      return 3;
    case "tablet_discovered":
      return 4;
    case "speaker_audio_discovered":
      return 5;
    default:
      return 99;
  }
}

function reasonFor(category: string) {
  switch (category) {
    case "monitor_discovered":
      return "Best first runtime-review candidate because exact model code is clean and option surface is narrow.";
    case "game_console_body_narrow":
      return "Best volume candidate, but must stay Disc/Digital only and exclude Slim/Pro/accessory/game/account bundles.";
    case "headphone_discovered":
      return "Good row count, but SKU/parts/accessory leakage risk is higher than monitor.";
    case "tablet_discovered":
      return "Now checklist-ready only for one storage/connectivity key; do not generalize to tablet category.";
    case "speaker_audio_discovered":
      return "Checklist-ready but thin; useful low-risk later pass, not the best first signal.";
    default:
      return "Blocked until more rows or cleaner boundaries exist.";
  }
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const board = await readJson<Board>("acquisition-owner-readiness-board-latest.json");
  const boundary = await readJson<Boundary>("acquisition-approval-boundary-matrix-latest.json");
  const boundaryByKey = new Map(boundary.rows.map((row) => [`${row.category}|${row.target}`, row]));
  const ready = board.entries
    .filter((entry) => entry.status === "owner_review_ready")
    .map((entry) => {
      const boundaryRow = boundaryByKey.get(`${entry.category}|${entry.target}`);
      const order = recommendedOrder(entry.category);
      return {
        ...entry,
        recommendedOrder: order,
        safetyClass: safetyClass(entry.category),
        hasOwnerPacket: boundaryRow?.hasOwnerPacket ?? false,
        hasExecutionChecklist: boundaryRow?.hasExecutionChecklist ?? false,
        hasRuntimeReviewRequest: boundaryRow?.hasRuntimeReviewRequest ?? false,
        nextBoundaryStep: boundaryRow?.nextBoundaryStep ?? "missing_boundary_row",
        reviewReason: reasonFor(entry.category),
      };
    })
    .sort((left, right) => left.recommendedOrder - right.recommendedOrder);

  const blocked = board.entries.filter((entry) => entry.status !== "owner_review_ready");
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    sourceReports: [
      "acquisition-owner-readiness-board-latest.json",
      "acquisition-approval-boundary-matrix-latest.json",
      "next-acquisition-readiness-ranking-latest.json",
    ],
    metrics: {
      readyRows: ready.length,
      blockedRows: blocked.length,
      runtimeRequestAlreadyPrepared: ready.filter((entry) => entry.hasRuntimeReviewRequest).length,
      runtimeRequestNeededIfSelected: ready.filter((entry) => !entry.hasRuntimeReviewRequest).length,
    },
    ready,
    blocked,
    recommendation: [
      "Do not patch runtime while P0 Supabase/runtime stabilization is still active.",
      "When runtime review resumes, start with Monitor XL2540K for the safest exact-model slice.",
      "Use PS5 Disc/Digital as the strongest volume candidate after the first monitor rehearsal proves the workflow.",
      "Keep every lane internal/no-public until fresh-detail refetch and lifecycle checks pass.",
    ],
    conclusion: "acquisition_runtime_review_ordering_packet_prepared_report_only",
    nextStep: "Wait for P0 stabilization; if owner chooses a lane, generate or verify its runtime-review request draft before any runtime code change.",
  };

  const jsonPath = path.join(reportsDir, "acquisition-runtime-review-ordering-packet-latest.json");
  const mdPath = path.join(reportsDir, "acquisition-runtime-review-ordering-packet-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Acquisition Runtime Review Ordering Packet",
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
    `- readyRows: ${report.metrics.readyRows}`,
    `- blockedRows: ${report.metrics.blockedRows}`,
    `- runtimeRequestAlreadyPrepared: ${report.metrics.runtimeRequestAlreadyPrepared}`,
    `- runtimeRequestNeededIfSelected: ${report.metrics.runtimeRequestNeededIfSelected}`,
    "",
    "## Recommended Review Order",
    "",
    mdTable(
      ["order", "category", "target", "rows", "cap", "score", "safety", "runtimeRequest", "reason"],
      ready.map((entry) => [
        entry.recommendedOrder,
        entry.category,
        entry.target,
        entry.allowedRows,
        entry.maxFutureWriteCap,
        entry.score ?? "-",
        entry.safetyClass,
        entry.hasRuntimeReviewRequest ? "yes" : "if-selected",
        entry.reviewReason,
      ]),
    ),
    "",
    "## Blocked",
    "",
    mdTable(
      ["category", "target", "rows", "cap", "score", "next"],
      blocked.map((entry) => [entry.category, entry.target, entry.allowedRows, entry.maxFutureWriteCap, entry.score ?? "-", entry.nextStep]),
    ),
    "",
    "## Recommendation",
    "",
    ...report.recommendation.map((line) => `- ${line}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    readyRows: report.metrics.readyRows,
    blockedRows: report.metrics.blockedRows,
    firstRecommended: ready[0]?.target,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
