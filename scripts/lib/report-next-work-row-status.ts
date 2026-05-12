import type { NextWorkBaseRow } from "./report-next-work-context";

export type NextWorkQueueStatus =
  | "queued_report_only"
  | "completed_report_only"
  | "followup_completed_report_only"
  | "readiness_completed_report_only"
  | "post_readiness_completed_report_only"
  | "evidence_completed_report_only";

export type MaterializedNextWorkRow = NextWorkBaseRow & {
  queueStatus: NextWorkQueueStatus;
  registryGroupKey: string | null;
  registryScopeSummary: string;
  completedReport: string | null;
  followupCompletedReport: string | null;
  readinessCompletedReport: string | null;
  postReadinessCompletedReport: string | null;
  evidenceCompletedReport: string | null;
  nextSafeReportOnlyTask: string;
  guideCoverageSummary: string;
  registryBacklogSummary: string;
};

export async function materializeNextWorkRows(
  baseRows: readonly NextWorkBaseRow[],
  fileExists: (file: string) => Promise<boolean>,
): Promise<MaterializedNextWorkRow[]> {
  const rows: MaterializedNextWorkRow[] = [];

  for (const row of baseRows) {
    const completed = await fileExists(row.completedReport);
    const followupCompleted = await fileExists(row.followupCompletedReport);
    const readinessCompleted = await fileExists(row.readinessCompletedReport);
    const postReadinessCompleted = await fileExists(row.postReadinessCompletedReport);
    const evidenceCompleted = row.evidenceCompletedReport ? await fileExists(row.evidenceCompletedReport) : false;

    rows.push({
      ...row,
      queueStatus: evidenceCompleted
        ? "evidence_completed_report_only"
        : postReadinessCompleted
          ? "post_readiness_completed_report_only"
          : readinessCompleted
            ? "readiness_completed_report_only"
            : followupCompleted
              ? "followup_completed_report_only"
              : completed
                ? "completed_report_only"
                : "queued_report_only",
      registryScopeSummary:
        row.registryFamily && row.registryPhase
          ? `${row.registryFamily} / ${row.registryPhase}`
          : row.registryFamily
            ? row.registryFamily
            : row.registryCategory,
      completedReport: completed ? row.completedReport : null,
      followupCompletedReport: followupCompleted ? row.followupCompletedReport : null,
      readinessCompletedReport: readinessCompleted ? row.readinessCompletedReport : null,
      postReadinessCompletedReport: postReadinessCompleted ? row.postReadinessCompletedReport : null,
      evidenceCompletedReport: evidenceCompleted ? row.evidenceCompletedReport : null,
      nextSafeReportOnlyTask: evidenceCompleted && row.nextAfterEvidenceTask
        ? row.nextAfterEvidenceTask
        : postReadinessCompleted
          ? row.nextAfterPostReadinessTask
          : readinessCompleted
            ? row.nextAfterReadinessTask
            : followupCompleted
              ? row.nextAfterFollowupTask
              : completed
                ? row.followupReportOnlyTask
                : row.nextReportOnlyTask,
      guideCoverageSummary: row.guideCoverage
        ? `direct ${row.guideCoverage.direct}/${row.guideCoverage.total}, adjacent ${row.guideCoverage.adjacent}/${row.guideCoverage.total}, fully_covered ${row.guideCoverage.fullyCovered}/${row.guideCoverage.total}`
        : "n/a",
      registryBacklogSummary: row.registryBacklogTopSignal
        ? `${row.registryBacklogTopSignal.family} / ${row.registryBacklogTopSignal.phase} / ${row.registryBacklogTopSignal.lane} / score ${row.registryBacklogTopSignal.severityScore}`
        : "n/a",
    });
  }

  return rows;
}
