import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type GenericVacuumRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  key?: string;
  genericClass: string;
  action: string;
  overlapClass?: string;
  brandHits?: string[];
  modelTokenHits?: string[];
  runtimeApproved?: boolean;
};

type VacuumOverlap = {
  category: string;
  metrics: {
    modelReadyRows: number;
    genericRows: number;
    brandOnlyOverlapRows: number;
    modelTokenOverlapRows: number;
  };
  rows: GenericVacuumRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function boundaryClass(row: GenericVacuumRow): string {
  if (row.genericClass === "bedding_cleaner_generic") return "bedding_cleaner_boundary_exclusion";
  if (row.genericClass === "robot_vacuum_generic") return "robot_vacuum_boundary_hold";
  if (row.genericClass === "accessory_or_parts_risk") return "accessory_parts_hard_exclusion";
  if (row.overlapClass === "brand_only_overlap_exclusion") return "brand_only_stick_vacuum_hold";
  return "stick_or_handheld_model_missing_hold";
}

function actionFor(boundary: string): string {
  if (boundary === "bedding_cleaner_boundary_exclusion") return "keep separate from stick/handheld model-ready vacuum";
  if (boundary === "robot_vacuum_boundary_hold") return "hold until robot brand/model/dock boundary is explicit";
  if (boundary === "accessory_parts_hard_exclusion") return "exclude from vacuum model-ready review";
  if (boundary === "brand_only_stick_vacuum_hold") return "brand-only overlap is review evidence, not model-ready approval";
  return "hold until concrete model identity exists";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const overlap = JSON.parse(
    await readFile(path.join(reportsDir, "home-appliance-vacuum-overlap-evidence-latest.json"), "utf8"),
  ) as VacuumOverlap;

  const rows = overlap.rows.map((row) => {
    const boundary = boundaryClass(row);
    return {
      ...row,
      boundaryClass: boundary,
      reportOnlyAction: actionFor(boundary),
      runtimeApproved: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: overlap.category,
    decision: "vacuum_subtype_boundary_evidence_report_only",
    sourceReports: [
      "home-appliance-vacuum-overlap-evidence-latest.json",
      "home-appliance-generic-vacuum-exclusion-readiness-latest.json",
    ],
    metrics: {
      modelReadyRows: overlap.metrics.modelReadyRows,
      genericRows: overlap.metrics.genericRows,
      evidenceRows: rows.length,
      brandOnlyOverlapRows: overlap.metrics.brandOnlyOverlapRows,
      modelTokenOverlapRows: overlap.metrics.modelTokenOverlapRows,
      beddingCleanerRows: rows.filter((row) => row.boundaryClass === "bedding_cleaner_boundary_exclusion").length,
      robotVacuumRows: rows.filter((row) => row.boundaryClass === "robot_vacuum_boundary_hold").length,
      accessoryPartsRows: rows.filter((row) => row.boundaryClass === "accessory_parts_hard_exclusion").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      boundaryClassCounts: countBy(rows.map((row) => row.boundaryClass)),
      genericClassCounts: countBy(rows.map((row) => row.genericClass)),
      overlapClassCounts: countBy(rows.map((row) => row.overlapClass ?? "no_overlap_class")),
    },
    rows,
    policyImplications: [
      "Bedding cleaner, robot vacuum, accessory/parts, and generic stick vacuum rows must remain separate.",
      "Brand-only overlap rows are negative/review evidence, not model-ready vacuum candidates.",
      "Robot vacuum rows need brand/model/dock/base-station separation before any candidate review.",
      "No vacuum subtype runtime wiring or candidate pool policy wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "use subtype boundary rows as exclusion-test examples only",
      "keep model-ready vacuum rows separate from generic subtype boundary evidence",
      "wait for row-level logistics exports before listing logistics exclusions",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not wire robot vacuum or vacuum subtype axes into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-vacuum-subtype-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | boundary_class | generic_class | overlap_class | action | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => (
      `| ${row.pid ?? "-"} | ${row.boundaryClass} | ${row.genericClass} | ${row.overlapClass ?? "-"} | ${row.reportOnlyAction} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`
    )),
  ].join("\n");

  const md = [
    "# Home Appliance Vacuum Subtype Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only vacuum subtype boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- evidence rows: ${report.metrics.evidenceRows}`,
    `- bedding cleaner rows: ${report.metrics.beddingCleanerRows}`,
    `- robot vacuum rows: ${report.metrics.robotVacuumRows}`,
    `- accessory/parts rows: ${report.metrics.accessoryPartsRows}`,
    "",
    "## Evidence Rows",
    "",
    table,
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

  await writeFile(path.join(reportsDir, "home-appliance-vacuum-subtype-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-vacuum-subtype-boundary-evidence-latest.json");
  console.log("wrote reports/home-appliance-vacuum-subtype-boundary-evidence-latest.md");
  console.log(`home appliance vacuum subtype boundary evidence: rows=${rows.length}, robot=${report.metrics.robotVacuumRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
