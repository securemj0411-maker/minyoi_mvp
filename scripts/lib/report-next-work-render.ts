import type { MaterializedNextWorkRow } from "./report-next-work-row-status";

type RegistryBacklogSignalRow = {
  key: string;
  category: string;
  family: string;
  phase: string;
  lane: string;
  packets: number;
  severityScore: number;
};

export function renderNextWorkQueueTable(rows: readonly MaterializedNextWorkRow[]): string {
  return [
    "| priority | queue_status | category | registry_scope | kind | metric | blocker_report | guide_coverage_summary | registry_backlog_summary | completed_report | followup_completed_report | readiness_completed_report | post_readiness_completed_report | evidence_completed_report | next_safe_report_only_task | stop_condition |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.priority} | ${row.queueStatus} | ${row.category} | ${row.registryScopeSummary} | ${row.kind} | ${row.metric} | ${row.blockerReport} | ${row.guideCoverageSummary} | ${row.registryBacklogSummary} | ${row.completedReport ?? "-"} | ${row.followupCompletedReport ?? "-"} | ${row.readinessCompletedReport ?? "-"} | ${row.postReadinessCompletedReport ?? "-"} | ${row.evidenceCompletedReport ?? "-"} | ${row.nextSafeReportOnlyTask} | ${row.stopCondition} |`,
    ),
  ].join("\n");
}

export function renderGuideSignalRows(rows: readonly MaterializedNextWorkRow[]): string[] {
  return rows.flatMap((row) =>
    row.guideSignals.map((signal) =>
      `| ${row.category} | ${signal.guideKey} | ${signal.weakestCoverage} | ${signal.weakestAxes.join(", ") || "-"} | ${signal.recommendation} |`,
    ),
  );
}

export function renderRegistrySignalRows(rows: readonly RegistryBacklogSignalRow[]): string[] {
  return rows.map(
    (row) =>
      `| ${row.key} | ${row.category} | ${row.family} | ${row.phase} | ${row.lane} | ${row.packets} | ${row.severityScore} |`,
  );
}

export function renderNextWorkQueueMarkdown(params: {
  generatedAt: string;
  guideHintsReferenceReport: string;
  rows: readonly MaterializedNextWorkRow[];
  registryRows: readonly RegistryBacklogSignalRow[];
  notQueuedReason: readonly string[];
  guardrails: readonly string[];
}): string {
  const table = renderNextWorkQueueTable(params.rows);
  const guideSignalRows = renderGuideSignalRows(params.rows);
  const registrySignalRows = renderRegistrySignalRows(params.registryRows);

  return [
    "# Parser Next Work Queue",
    "",
    `Generated: ${params.generatedAt}`,
    "",
    "Report-only queue for next safe parser/readiness work. This is not runtime wiring and not public promotion.",
    "",
    `Guide hints reference: \`${params.guideHintsReferenceReport}\``,
    "",
    table,
    "",
    "## Guide Coverage Backlog Signals",
    "",
    "| category | guide_key | weakest_coverage | weakest_axes | recommendation |",
    "| --- | --- | --- | --- | --- |",
    ...(guideSignalRows.length > 0 ? guideSignalRows : ["| - | - | - | - | no guide-linked backlog signals |"]),
    "",
    "## Registry Backlog Signals",
    "",
    "| key | category | family | phase | lane | packets | score |",
    "| --- | --- | --- | --- | --- | ---: | ---: |",
    ...(registrySignalRows.length > 0 ? registrySignalRows : ["| - | - | - | - | - | - | - |"]),
    "",
    "## Not Queued",
    "",
    ...params.notQueuedReason.map((line) => `- ${line}`),
    "",
    "## Guardrails",
    "",
    ...params.guardrails.map((line) => `- ${line}`),
    "",
  ].join("\n");
}
