import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type Board = {
  entries: Array<{
    category: string;
    target: string;
    status: string;
    score: number;
    allowedRows: number;
    maxFutureWriteCap: number;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function exists(file: string): boolean {
  return Boolean(file) && existsSync(path.join(reportsDir, file));
}

function fileMap(category: string) {
  switch (category) {
    case "game_console_body_narrow":
      return {
        ownerPacket: "game-console-ps5-owner-assessment-latest.json",
        executionChecklist: "game-console-ps5-execution-readiness-checklist-latest.json",
        runtimeReviewRequest: "game-console-ps5-runtime-review-request-draft-latest.json",
      };
    case "monitor_discovered":
      return {
        ownerPacket: "monitor-xl2540k-owner-review-packet-latest.json",
        executionChecklist: "monitor-xl2540k-execution-readiness-checklist-latest.json",
        runtimeReviewRequest: null,
      };
    case "headphone_discovered":
      return {
        ownerPacket: "headphone-sony-first-wave-owner-review-packet-latest.json",
        executionChecklist: "headphone-sony-first-wave-execution-readiness-checklist-latest.json",
        runtimeReviewRequest: "headphone-runtime-review-request-draft-latest.json",
      };
    case "speaker_audio_discovered":
      return {
        ownerPacket: "speaker-jbl-flip6-owner-review-packet-latest.json",
        executionChecklist: "speaker-jbl-flip6-execution-readiness-checklist-latest.json",
        runtimeReviewRequest: null,
      };
    case "tablet_discovered":
      return {
        ownerPacket: "tablet-ipad-pro-m4-owner-assessment-latest.json",
        executionChecklist: "tablet-ipad-pro-m4-execution-readiness-checklist-latest.json",
        runtimeReviewRequest: null,
      };
    case "camera_discovered":
      return {
        ownerPacket: "camera-sony-a7m3-owner-review-packet-latest.json",
        executionChecklist: "camera-sony-a7m3-execution-readiness-checklist-latest.json",
        runtimeReviewRequest: null,
      };
    default:
      return {
        ownerPacket: null,
        executionChecklist: null,
        runtimeReviewRequest: null,
      };
  }
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
  const board = await readJson<Board>("acquisition-owner-readiness-board-latest.json");

  const rows = board.entries.map((entry) => {
    const files = fileMap(entry.category);
    const hasOwnerPacket = exists(files.ownerPacket ?? "");
    const hasExecutionChecklist = exists(files.executionChecklist ?? "");
    const hasRuntimeReviewRequest = exists(files.runtimeReviewRequest ?? "");
    const approvalBoundary = entry.status === "owner_review_ready"
      ? hasOwnerPacket && hasExecutionChecklist && (hasRuntimeReviewRequest || ["monitor_discovered", "speaker_audio_discovered", "tablet_discovered"].includes(entry.category))
      : hasOwnerPacket && hasExecutionChecklist;
    const nextBoundaryStep = entry.status !== "owner_review_ready"
      ? "blocked_until_more_clean_rows"
      : hasRuntimeReviewRequest
        ? "ready_for_owner_review_after_p0"
        : "owner_packet_exists_add_runtime_request_if_selected";
    return {
      ...entry,
      ownerPacket: files.ownerPacket,
      executionChecklist: files.executionChecklist,
      runtimeReviewRequest: files.runtimeReviewRequest,
      hasOwnerPacket,
      hasExecutionChecklist,
      hasRuntimeReviewRequest,
      approvalBoundary,
      nextBoundaryStep,
    };
  });

  const missingHardBoundaryRows = rows.filter((row) => row.status === "owner_review_ready" && (!row.hasOwnerPacket || !row.hasExecutionChecklist));
  const missingRuntimeRequestRows = rows.filter((row) => row.status === "owner_review_ready" && !row.hasRuntimeReviewRequest);
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    sourceReports: ["acquisition-owner-readiness-board-latest.json"],
    metrics: {
      rows: rows.length,
      ownerReviewReadyRows: rows.filter((row) => row.status === "owner_review_ready").length,
      blockedRows: rows.filter((row) => row.status === "blocked").length,
      missingHardBoundaryRows: missingHardBoundaryRows.length,
      missingRuntimeRequestRows: missingRuntimeRequestRows.length,
    },
    rows,
    conclusion: missingHardBoundaryRows.length === 0
      ? "acquisition_approval_boundary_matrix_ready_report_only"
      : "acquisition_approval_boundary_matrix_missing_hard_boundary_report_only",
    nextStep:
      missingRuntimeRequestRows.length > 0
        ? "If a monitor or speaker lane is selected for runtime review, generate a narrow runtime-review request draft before touching runtime code."
        : "Proceed to owner review only after P0 stabilization; no runtime changes in this report-only wave.",
  };

  const jsonPath = path.join(reportsDir, "acquisition-approval-boundary-matrix-latest.json");
  const mdPath = path.join(reportsDir, "acquisition-approval-boundary-matrix-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Acquisition Approval Boundary Matrix",
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
    `- rows: ${report.metrics.rows}`,
    `- ownerReviewReadyRows: ${report.metrics.ownerReviewReadyRows}`,
    `- blockedRows: ${report.metrics.blockedRows}`,
    `- missingHardBoundaryRows: ${report.metrics.missingHardBoundaryRows}`,
    `- missingRuntimeRequestRows: ${report.metrics.missingRuntimeRequestRows}`,
    "",
    "## Rows",
    "",
    mdTable(
      ["status", "category", "target", "score", "rows", "cap", "owner", "checklist", "runtimeRequest", "next"],
      rows.map((row) => [
        row.status,
        row.category,
        row.target,
        row.score,
        row.allowedRows,
        row.maxFutureWriteCap,
        row.hasOwnerPacket ? "yes" : "no",
        row.hasExecutionChecklist ? "yes" : "no",
        row.hasRuntimeReviewRequest ? "yes" : "no",
        row.nextBoundaryStep,
      ]),
    ),
    "",
    "## Next Step",
    "",
    report.nextStep,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    ownerReviewReadyRows: report.metrics.ownerReviewReadyRows,
    missingHardBoundaryRows: report.metrics.missingHardBoundaryRows,
    missingRuntimeRequestRows: report.metrics.missingRuntimeRequestRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
