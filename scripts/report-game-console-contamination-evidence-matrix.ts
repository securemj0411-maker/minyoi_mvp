import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = {
  key: string;
  count: number;
};

type ExampleRow = {
  pid?: string | number | null;
  title?: string;
  price?: number | null;
  gate?: string;
  model?: string | null;
  comparableKey?: string | null;
  needsReview?: boolean;
  reasons?: string[];
};

type NarrowingReport = {
  category: string;
  total: number;
  consoleCandidateRate: number;
  knownModelCandidateRate: number;
  gateCounts: CountRow[];
  topModels: CountRow[];
  examples: Record<string, ExampleRow[]>;
};

type ContaminationBlockers = {
  decision: string;
  currentMetrics: {
    broad: {
      total: number;
      consoleCandidateRate: number;
      knownModelCandidateRate: number;
      gateCounts: CountRow[];
      topModels: CountRow[];
    };
    bodyNarrow: {
      total: number;
      consoleCandidateRate: number;
      knownModelCandidateRate: number;
      gateCounts: CountRow[];
    };
    strictParser: {
      parserReadyRate: number;
      normalParserReadyRate: number;
    };
  };
};

type EvidenceRow = {
  gate: string;
  count: number;
  evidenceClass: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const reportsDir = path.join(process.cwd(), "reports");

function evidenceClassForGate(gate: string): string {
  if (gate === "console_candidate") return "broad_console_candidate_not_ready_source";
  if (gate === "game_title") return "game_title_media_exclusion_pressure";
  if (gate === "buying") return "buying_post_exclusion_pressure";
  if (gate === "accessory") return "accessory_controller_exclusion_pressure";
  if (gate === "multi_bundle") return "multi_bundle_exclusion_pressure";
  return "unknown_body_or_model_hold_pressure";
}

function actionForGate(gate: string): string {
  if (gate === "console_candidate") return "keep as broad reference only; use body_narrow report for body evidence";
  if (gate === "game_title") return "exclude from hardware body readiness and keep as media/title contamination";
  if (gate === "buying") return "exclude from selling-listing parser readiness";
  if (gate === "accessory") return "hold outside body parser as accessory/controller-only risk";
  if (gate === "multi_bundle") return "hold as bundle risk until package policy is separately reviewed";
  return "hold as unknown body/model contamination";
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function cleanTitle(title: string | undefined): string {
  return (title ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const broad = JSON.parse(await readFile(path.join(reportsDir, "game-console-narrowing-latest.json"), "utf8")) as NarrowingReport;
  const blockers = JSON.parse(await readFile(path.join(reportsDir, "game-console-contamination-blockers-latest.json"), "utf8")) as ContaminationBlockers;

  const evidenceRows: EvidenceRow[] = blockers.currentMetrics.broad.gateCounts.map((row) => {
    const examples = broad.examples[row.key] ?? [];
    return {
      gate: row.key,
      count: row.count,
      evidenceClass: evidenceClassForGate(row.key),
      reportOnlyAction: actionForGate(row.key),
      samplePids: examples.slice(0, 4).map((example) => example.pid ?? "-"),
      sampleTitles: examples.slice(0, 4).map((example) => cleanTitle(example.title)),
      runtimeApproved: false,
    };
  });

  const consoleCandidateCount = evidenceRows.find((row) => row.gate === "console_candidate")?.count ?? 0;
  const contaminationCount = blockers.currentMetrics.broad.total - consoleCandidateCount;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: broad.category,
    decision: blockers.decision,
    sourceReports: ["game-console-narrowing-latest.json", "game-console-contamination-blockers-latest.json"],
    metrics: {
      total: blockers.currentMetrics.broad.total,
      broadConsoleCandidateRows: consoleCandidateCount,
      broadConsoleCandidateRate: blockers.currentMetrics.broad.consoleCandidateRate,
      contaminationRows: contaminationCount,
      contaminationRate: pct(contaminationCount, blockers.currentMetrics.broad.total),
      broadKnownModelCandidateRate: blockers.currentMetrics.broad.knownModelCandidateRate,
      bodyNarrowConsoleCandidateRate: blockers.currentMetrics.bodyNarrow.consoleCandidateRate,
      bodyNarrowKnownModelCandidateRate: blockers.currentMetrics.bodyNarrow.knownModelCandidateRate,
      strictParserReadyRate: blockers.currentMetrics.strictParser.parserReadyRate,
      strictNormalParserReadyRate: blockers.currentMetrics.strictParser.normalParserReadyRate,
      evidenceRows: evidenceRows.length,
      runtimeApprovedRows: evidenceRows.filter((row) => row.runtimeApproved).length,
      evidenceClassCounts: countBy(evidenceRows.map((row) => row.evidenceClass)),
    },
    evidenceRows,
    topModelWarning: {
      broadTopModels: blockers.currentMetrics.broad.topModels,
      warning: "Top model counts are contamination context only; broad known model detection must not be read as body readiness.",
    },
    policyImplications: [
      "game_console_discovered remains a contamination map, not a ready source.",
      "Broad knownModelCandidateRate is not readiness because game title, buying, accessory, bundle, and unknown rows dominate the sample.",
      "game_console_body_narrow remains the separate report-only body validation lane.",
      "No public promotion, runtime catalog apply, or candidate pool policy wiring is approved by this evidence matrix.",
    ],
    nextReportOnlyExperiments: [
      "use this matrix as negative evidence when reviewing broad game console rows",
      "continue strict parser review on body_narrow separately",
      "only add narrower split reports when they remain report-only and do not imply readiness",
    ],
    doNotDo: [
      "Do not promote game_console_discovered",
      "Do not merge broad contamination metrics into body_narrow readiness",
      "Do not treat parser_candidate as public approval",
      "Do not wire candidate pool policy from this matrix",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "game-console-contamination-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const evidenceTable = [
    "| gate | count | evidence_class | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...evidenceRows.map((row) => (
      `| ${row.gate} | ${row.count} | ${row.evidenceClass} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`
    )),
  ].join("\n");

  const modelTable = [
    "| broad_top_model | count |",
    "| --- | ---: |",
    ...blockers.currentMetrics.broad.topModels.map((row) => `| ${row.key} | ${row.count} |`),
  ].join("\n");

  const md = [
    "# Game Console Contamination Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only broad game console contamination evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- broad console candidate: ${report.metrics.broadConsoleCandidateRate}% (${report.metrics.broadConsoleCandidateRows}/${report.metrics.total})`,
    `- contamination: ${report.metrics.contaminationRate}% (${report.metrics.contaminationRows}/${report.metrics.total})`,
    `- body_narrow console candidate reference: ${report.metrics.bodyNarrowConsoleCandidateRate}%`,
    `- strict parser ready reference: ${report.metrics.strictParserReadyRate}%`,
    "",
    "## Evidence Rows",
    "",
    evidenceTable,
    "",
    "## Broad Top Model Warning",
    "",
    report.topModelWarning.warning,
    "",
    modelTable,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "game-console-contamination-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/game-console-contamination-evidence-matrix-latest.json");
  console.log("wrote reports/game-console-contamination-evidence-matrix-latest.md");
  console.log(`game console contamination evidence: contamination=${report.metrics.contaminationRows}, broad_console=${report.metrics.broadConsoleCandidateRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
