import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    purpose: "Explain how to use the parser report-only suite without treating it as runtime approval.",
    primaryEntryPoints: [
      {
        file: "parser-suite-status-latest.md",
        use: "Start here for candidate vs hold status.",
      },
      {
        file: "parser-review-coverage-summary-latest.md",
        use: "Check category-level review evidence coverage across general boundary and AirPods/headphone examples.",
      },
      {
        file: "parser-readiness-all-run-latest.md",
        use: "Check whether every report step regenerated successfully.",
      },
      {
        file: "parser-policy-guardrails-latest.md",
        use: "Check report-only/public-promotion/wiring guardrails.",
      },
      {
        file: "parser-report-only-audit-latest.md",
        use: "Check latest report-only phase files and forbidden path status.",
      },
      {
        file: "parser-manifest-audit-latest.md",
        use: "Check manifest coverage for important reports.",
      },
    ],
    interpretationRules: [
      "parser_candidate means internal review candidate only.",
      "parser_candidate_report_only means useful report evidence, not runtime approval.",
      "hold_report_only means no runtime or public action.",
      "eligible metrics must not be copied as whole-category readiness.",
      "existing operating-map ready status must not be copied to discovered sample sets.",
      "review coverage closure means evidence coverage only, not parser approval.",
    ],
    whenAddingNewReport: [
      "Create a report-only script under scripts/.",
      "Write JSON and Markdown under reports/.",
      "Set reportOnly=true and publicPromotion=false in JSON.",
      "Add the step to report-parser-readiness-all.ts.",
      "Add JSON to report-parser-policy-guardrails.ts if it should be guarded.",
      "Add script/report paths to report-parser-report-only-audit.ts.",
      "Add Markdown report to parser-report-manifest-latest and parser-manifest-audit if it is important.",
      "Append results to 인수인계.md only.",
    ],
    forbidden: [
      "runtime catalog apply",
      "public promotion",
      "candidate pool policy wiring",
      "Supabase schema changes",
      "cron/lifecycle/source health/pack UI changes",
      "production DB mutation",
      "direct edits to 30일_실행계획.md in this subagent phase",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-suite-usage-latest.json"), JSON.stringify(report, null, 2));

  const sections = [
    "# Parser Suite Usage",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only usage guide. This is not runtime wiring and not public promotion.",
    "",
    "## Primary Entry Points",
    "",
    "| file | use |",
    "| --- | --- |",
    ...report.primaryEntryPoints.map((row) => `| ${row.file} | ${row.use} |`),
    "",
    "## Interpretation Rules",
    "",
    ...report.interpretationRules.map((line) => `- ${line}`),
    "",
    "## When Adding New Report",
    "",
    ...report.whenAddingNewReport.map((line) => `- ${line}`),
    "",
    "## Forbidden",
    "",
    ...report.forbidden.map((line) => `- ${line}`),
  ];

  await writeFile(path.join(reportsDir, "parser-suite-usage-latest.md"), `${sections.join("\n")}\n`);
  console.log("wrote reports/parser-suite-usage-latest.json");
  console.log("wrote reports/parser-suite-usage-latest.md");
  console.log(`suite usage: entry_points=${report.primaryEntryPoints.length}, forbidden=${report.forbidden.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
