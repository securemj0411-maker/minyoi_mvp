import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type HomeExample = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string;
  genericClass?: string;
  action?: string;
};

type HomeLogisticsReview = {
  category: string;
  genericRows: HomeExample[];
  metrics: {
    genericRows: number;
    modelReadyVacuumRows: number;
    logisticsRiskCount: number;
    logisticsRiskExamplesAvailable: number;
  };
};

type HomeBlockers = {
  genericExamples: HomeExample[];
};

const reportsDir = path.join(process.cwd(), "reports");

function genericClass(example: HomeExample): string {
  const title = example.title ?? "";
  if (/충전기|어댑터|부품|헤드|필터/i.test(title)) return "accessory_or_parts_risk";
  if (/로봇청소기|robot|narwal|rv50|미지아|프레오/i.test(title)) return "robot_vacuum_generic";
  if (/침구청소기|레이캅|bedding/i.test(title)) return "bedding_cleaner_generic";
  return "stick_or_handheld_vacuum_generic";
}

function genericAction(classKey: string): string {
  if (classKey === "accessory_or_parts_risk") return "exclude_from_vacuum_candidate";
  if (classKey === "robot_vacuum_generic") return "exclusion_test_candidate_only_robot_boundary";
  if (classKey === "bedding_cleaner_generic") return "exclusion_test_candidate_only_bedding_boundary";
  return "exclusion_test_candidate_only_model_missing";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const logistics = JSON.parse(
    await readFile(path.join(reportsDir, "home-appliance-logistics-generic-review-latest.json"), "utf8"),
  ) as HomeLogisticsReview;
  const blockers = JSON.parse(await readFile(path.join(reportsDir, "home-appliance-blockers-latest.json"), "utf8")) as HomeBlockers;

  const rowsByPid = new Map<string, HomeExample>();
  for (const row of logistics.genericRows) {
    if (!row.pid) continue;
    rowsByPid.set(row.pid, row);
  }

  const newlyRecoveredRows: HomeExample[] = [];
  for (const example of blockers.genericExamples) {
    if (!example.pid || rowsByPid.has(example.pid)) continue;
    const classKey = genericClass(example);
    const recovered = {
      ...example,
      genericClass: classKey,
      action: genericAction(classKey),
    };
    rowsByPid.set(example.pid, recovered);
    newlyRecoveredRows.push(recovered);
  }

  const rows = [...rowsByPid.values()].map((row) => {
    const classKey = row.genericClass ?? genericClass(row);
    return {
      ...row,
      genericClass: classKey,
      action: genericAction(classKey),
      exclusionCandidateOnly: true,
      runtimeApproved: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: logistics.category,
    decision: "generic_vacuum_exclusion_candidate_only_report_no_wiring",
    sourceReports: ["home-appliance-logistics-generic-review-latest.json", "home-appliance-blockers-latest.json"],
    metrics: {
      logisticsGenericRows: logistics.metrics.genericRows,
      blockerGenericExamples: blockers.genericExamples.length,
      expandedGenericVacuumRows: rows.length,
      newlyRecoveredRows: newlyRecoveredRows.length,
      modelReadyVacuumRows: logistics.metrics.modelReadyVacuumRows,
      logisticsRiskCount: logistics.metrics.logisticsRiskCount,
      logisticsRiskExamplesAvailable: logistics.metrics.logisticsRiskExamplesAvailable,
      exclusionCandidateOnlyRows: rows.length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      genericClassCounts: countBy(rows.map((row) => row.genericClass)),
    },
    rows,
    newlyRecoveredRows,
    gaps: [
      "logistics_risk still exposes count only and no row-level examples",
      "generic vacuum rows remain exclusion-test candidates because model identity is missing or subtype boundary is unresolved",
      "robot vacuum dock/base station and battery condition are not modeled by this report",
    ],
    policyImplications: [
      "The blocker report recovers additional generic vacuum examples that were not present in the logistics/generic review table.",
      "Stick/handheld, bedding cleaner, robot vacuum, and accessory/parts rows must stay separate from model-ready vacuum rows.",
      "All rows in this report are exclusion-candidate-only and cannot become comparable keys.",
    ],
    nextReportOnlyExperiments: [
      "compare expanded generic vacuum exclusions against model-ready vacuum test candidates",
      "prepare subtype-specific false-positive examples for stick/handheld and robot vacuum",
      "wait for row-level logistics source before any logistics exclusion examples are listed",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not wire robot vacuum or vacuum subtype axes into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-generic-vacuum-exclusion-readiness-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | generic_class | action | runtime_approved | title |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.genericClass} | ${row.action} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Generic Vacuum Exclusion Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only expanded generic vacuum exclusion readiness. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Gaps",
    "",
    ...report.gaps.map((line) => `- ${line}`),
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

  await writeFile(path.join(reportsDir, "home-appliance-generic-vacuum-exclusion-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-generic-vacuum-exclusion-readiness-latest.json");
  console.log("wrote reports/home-appliance-generic-vacuum-exclusion-readiness-latest.md");
  console.log(`home appliance generic vacuum exclusion readiness: exclusion_candidate_only=${rows.length}, runtime_approved=${report.metrics.runtimeApprovedRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
