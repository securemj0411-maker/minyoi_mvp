import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadReadinessRows } from "./lib/report-category-status-context";
import { buildNextWorkBaseRows, type GuideGapAudit, type SuiteStatus } from "./lib/report-next-work-context";
import { materializeNextWorkRows } from "./lib/report-next-work-row-status";
import { renderNextWorkQueueMarkdown } from "./lib/report-next-work-render";
import { nextWorkGuardrails, nextWorkNotQueuedReasons, nextWorkReportMode } from "./lib/report-next-work-static-spec";

type RegistryBacklogSignals = {
  rows: Array<{
    key: string;
    category: string;
    family: string;
    phase: string;
    lane: string;
    packets: number;
    severityScore: number;
  }>;
};

const reportsDir = path.join(process.cwd(), "reports");



async function fileExists(file: string): Promise<boolean> {
  try {
    await access(path.join(reportsDir, file));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const suite = JSON.parse(await readFile(path.join(reportsDir, "parser-suite-status-latest.json"), "utf8")) as SuiteStatus;
  const readinessRows = await loadReadinessRows(reportsDir);
  const guideGap = JSON.parse(await readFile(path.join(reportsDir, "model-guide-parser-gap-audit-latest.json"), "utf8")) as GuideGapAudit;
  const registryBacklog = JSON.parse(
    await readFile(path.join(reportsDir, "parser-registry-backlog-signals-latest.json"), "utf8"),
  ) as RegistryBacklogSignals;
  const baseRows = buildNextWorkBaseRows({
    suite,
    readinessRows,
    guideGap,
    registryBacklogRows: registryBacklog.rows,
  });
  const rows = await materializeNextWorkRows(baseRows, fileExists);
  const queued = rows.filter((row) => row.queueStatus === "queued_report_only");
  const completed = rows.filter((row) => row.queueStatus !== "queued_report_only");
  const followupCompleted = rows.filter((row) => row.queueStatus === "followup_completed_report_only");
  const readinessCompleted = rows.filter((row) => row.queueStatus === "readiness_completed_report_only");
  const postReadinessCompleted = rows.filter((row) => row.queueStatus === "post_readiness_completed_report_only");
  const evidenceCompleted = rows.filter((row) => row.queueStatus === "evidence_completed_report_only");

  const report = {
    generatedAt: new Date().toISOString(),
    ...nextWorkReportMode,
    rows,
    completedCount: completed.length,
    followupCompletedCount: followupCompleted.length,
    readinessCompletedCount: readinessCompleted.length,
    postReadinessCompletedCount: postReadinessCompleted.length,
    evidenceCompletedCount: evidenceCompleted.length,
    queuedCount: queued.length,
    notQueuedReason: nextWorkNotQueuedReasons,
    guardrails: nextWorkGuardrails,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-next-work-queue-latest.json"), JSON.stringify(report, null, 2));

  const md = renderNextWorkQueueMarkdown({
    generatedAt: report.generatedAt,
    guideHintsReferenceReport: report.guideHintsReferenceReport,
    rows,
    registryRows: registryBacklog.rows,
    notQueuedReason: report.notQueuedReason,
    guardrails: report.guardrails,
  });

  await writeFile(path.join(reportsDir, "parser-next-work-queue-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-next-work-queue-latest.json");
  console.log("wrote reports/parser-next-work-queue-latest.md");
  console.log(
    `next work queue: rows=${rows.length}, queued=${queued.length}, completed=${completed.length}, followup_completed=${followupCompleted.length}, readiness_completed=${readinessCompleted.length}, post_readiness_completed=${postReadinessCompleted.length}, evidence_completed=${evidenceCompleted.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
