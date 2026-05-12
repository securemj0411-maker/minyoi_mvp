import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { reportCategoryEvidenceSpecs } from "./lib/report-category-evidence-spec";
import { reportCategoryEditorialSpecs } from "./lib/report-category-editorial-spec";
import { compileCategoryStatusContexts, loadReadinessRows } from "./lib/report-category-status-context";

type ReadinessSummary = {
  counts: Record<string, number>;
};

type PolicyMatrix = {
  rows: Array<{
    category: string;
    scope: string;
    forbiddenWiring: string[];
  }>;
};

type HoldIndex = {
  rows: Array<{
    category: string;
    blockerReport: string;
    decision: string;
    primaryReasons: string[];
  }>;
};

type Guardrails = {
  status: string;
  filesChecked: number;
  failedCount: number;
};

const reportsDir = path.join(process.cwd(), "reports");

const blockerReportsByCategory: Record<string, string> = {
  earphone_discovered: "earphone-airpods-blockers-latest.md",
  headphone_discovered: "headphone-matched-sku-blockers-latest.md",
  monitor_discovered: "monitor-model-code-blockers-latest.md",
  desktop_pc_discovered: "desktop-full-unit-blockers-latest.md",
  game_console_body_narrow: "game-console-body-blockers-latest.md",
  game_console_discovered: "game-console-contamination-blockers-latest.md",
  camera_discovered: "camera-package-blockers-latest.md",
  smartwatch_discovered: "smartwatch-ambiguity-blockers-latest.md",
  speaker_audio_discovered: "speaker-family-blockers-latest.md",
  home_appliance_tech_discovered: "home-appliance-blockers-latest.md",
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const summary = await readJson<ReadinessSummary>("parser-readiness-summary-latest.json");
  const matrix = await readJson<PolicyMatrix>("parser-policy-conditions-matrix-latest.json");
  const holdIndex = await readJson<HoldIndex>("parser-hold-blockers-index-latest.json");
  const guardrails = await readJson<Guardrails>("parser-policy-guardrails-latest.json");
  const contexts = compileCategoryStatusContexts({
    readinessRows: await loadReadinessRows(reportsDir),
    evidenceSpecs: reportCategoryEvidenceSpecs,
    editorialSpecs: reportCategoryEditorialSpecs,
  });

  const matrixByCategory = new Map(matrix.rows.map((row) => [row.category, row]));
  const holdIndexByCategory = new Map(holdIndex.rows.map((row) => [row.category, row]));
  const candidateRows = contexts
    .filter((context) => context.readiness && (context.readiness.status === "parser_candidate" || context.readiness.status === "parser_candidate_report_only"))
    .map((context) => ({
      ...context.readiness!,
      scope: matrixByCategory.get(context.category)?.scope ?? "n/a",
      blockerReport: blockerReportsByCategory[context.category] ?? "n/a",
      forbiddenWiring: matrixByCategory.get(context.category)?.forbiddenWiring ?? [],
    }));

  const holdRows = contexts
    .filter((context) => context.readiness && !["parser_candidate", "parser_candidate_report_only"].includes(context.readiness.status))
    .map((context) => {
      const holdRow = holdIndexByCategory.get(context.category);
      return {
        category: context.category,
        blockerReport: holdRow?.blockerReport ?? blockerReportsByCategory[context.category] ?? "n/a",
        decision: holdRow?.decision ?? context.readiness!.status,
        primaryReasons: holdRow?.primaryReasons ?? context.editorial.holdReasons,
        primaryMetric: context.readiness!.primaryMetric,
        nextAction: context.readiness!.nextAction || "hold",
      };
    });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    counts: summary.counts,
    candidateRows,
    holdRows,
    guardrailStatus: {
      status: guardrails.status,
      filesChecked: guardrails.filesChecked,
      failedCount: guardrails.failedCount,
    },
    nextSafeSubagentWork: [
      "add more report-only blocker reports for narrow subsets only",
      "refresh all-run after any report script change",
      "keep 30일_실행계획.md read-only unless main/user explicitly overrides current boundary",
      "log results only in 인수인계.md",
    ],
    forbidden: [
      "runtime catalog apply",
      "public promotion",
      "candidate pool policy wiring",
      "Supabase schema / cron / lifecycle / source health / pack UI changes",
      "production DB mutation",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-suite-status-latest.json"), JSON.stringify(report, null, 2));

  const candidateTable = [
    "| category | status | metric | scope | blocker_report | caveat | next_action | forbidden_wiring |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...candidateRows.map((row) =>
      [
        row.category,
        row.status,
        row.primaryMetric,
        row.scope,
        row.blockerReport,
        row.caveat || "-",
        row.nextAction,
        row.forbiddenWiring.map((item) => `- ${item}`).join("<br>"),
      ].join(" | "),
    ).map((line) => `| ${line} |`),
  ].join("\n");

  const holdTable = [
    "| category | decision | metric | blocker_report | primary_reasons | next_action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...holdRows.map((row) =>
      [
        row.category,
        row.decision,
        row.primaryMetric,
        row.blockerReport,
        row.primaryReasons.map((item) => `- ${item}`).join("<br>"),
        row.nextAction,
      ].join(" | "),
    ).map((line) => `| ${line} |`),
  ].join("\n");

  const md = [
    "# Parser Suite Status",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only status across parser candidates and hold-only blockers. This is not public promotion and not runtime wiring.",
    "",
    `Guardrails: ${report.guardrailStatus.status} (${report.guardrailStatus.filesChecked} files checked, ${report.guardrailStatus.failedCount} failed)`,
    "",
    "## Candidate Rows",
    "",
    candidateTable,
    "",
    "## Hold Rows",
    "",
    holdTable,
    "",
    "## Next Safe Subagent Work",
    "",
    ...report.nextSafeSubagentWork.map((line) => `- ${line}`),
    "",
    "## Forbidden",
    "",
    ...report.forbidden.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-suite-status-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-suite-status-latest.json");
  console.log("wrote reports/parser-suite-status-latest.md");
  console.log(`suite status: candidates=${candidateRows.length}, holds=${holdRows.length}, guard=${guardrails.status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
