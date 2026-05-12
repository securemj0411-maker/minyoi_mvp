import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { classifyListing } from "@/lib/pipeline";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
  url?: string;
};

type EvidenceRow = {
  partClass: string;
  count: number;
  evidenceClass: string;
  reportOnlyAction: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "earphone_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function normalized(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase();
}

function partClassFor(sample: Sample): string {
  const text = normalized(sample).replace(/\s+/g, "");
  const sideSignal = /(왼쪽|오른쪽|좌측|우측|좌|우|한쪽|유닛|이어버드|이어폰한짝|한짝|낱개|단품)/.test(text);
  const caseSignal = /(충전케이스|충전기케이스|케이스본체|에어팟본체|본체만|본체단품|충전독)/.test(text);
  const boxSignal = /(박스만|빈박스|박스판매|박스팝니다|박스구함|박스삽니다)/.test(text);
  const batteryOrRepairSignal = /(배터리|수리|교체|부품용|하우징|분해|고장|파손)/.test(text);

  if (sideSignal && caseSignal) return "side_and_case_parts";
  if (sideSignal) return "side_unit_only";
  if (caseSignal) return "charging_case_only";
  if (boxSignal) return "box_only_or_packaging";
  if (batteryOrRepairSignal) return "repair_or_damaged_parts";
  return "ambiguous_parts_hold";
}

function evidenceClassFor(partClass: string): string {
  if (partClass === "side_unit_only") return "side_unit_exclusion_pressure";
  if (partClass === "charging_case_only") return "charging_case_exclusion_pressure";
  if (partClass === "side_and_case_parts") return "mixed_parts_exclusion_pressure";
  if (partClass === "box_only_or_packaging") return "packaging_exclusion_pressure";
  if (partClass === "repair_or_damaged_parts") return "repair_parts_exclusion_pressure";
  return "ambiguous_parts_hold_pressure";
}

function actionFor(partClass: string): string {
  if (partClass === "side_unit_only") return "exclude from normal full-product AirPods readiness";
  if (partClass === "charging_case_only") return "exclude from normal full-product AirPods readiness";
  if (partClass === "side_and_case_parts") return "hold as incomplete/mixed parts";
  if (partClass === "box_only_or_packaging") return "exclude as packaging/accessory-only evidence";
  if (partClass === "repair_or_damaged_parts") return "exclude as repair/damaged parts";
  return "hold until manual review, do not count as normal";
}

function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const buckets = new Map<string, Sample[]>();
  let partsRows = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const classified = classifyListing(title, description, price);
    if (classified.listingType !== "parts") continue;
    partsRows += 1;
    const partClass = partClassFor(sample);
    const rows = buckets.get(partClass) ?? [];
    rows.push(sample);
    buckets.set(partClass, rows);
  }

  const evidenceRows: EvidenceRow[] = [...buckets.entries()]
    .map(([partClass, rows]) => ({
      partClass,
      count: rows.length,
      evidenceClass: evidenceClassFor(partClass),
      reportOnlyAction: actionFor(partClass),
      samplePids: rows.slice(0, 5).map((sample) => sample.pid ?? "-"),
      sampleTitles: rows.slice(0, 5).map(cleanTitle),
      runtimeApproved: false as const,
    }))
    .sort((a, b) => b.count - a.count || a.partClass.localeCompare(b.partClass));

  const classifiedParts = evidenceRows.reduce((sum, row) => sum + row.count, 0);
  const directExclusionRows = evidenceRows
    .filter((row) => row.partClass !== "ambiguous_parts_hold")
    .reduce((sum, row) => sum + row.count, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "earphone_discovered",
    decision: "parts_exclusion_evidence_report_only",
    sourceReports: ["earphone-parser-latest.json", "earphone-airpods-evidence-matrix-latest.json"],
    metrics: {
      totalSamples: samples.length,
      partsRows,
      classifiedParts,
      partsRate: pct(partsRows, samples.length),
      directExclusionRows,
      directExclusionRateOfParts: pct(directExclusionRows, partsRows),
      ambiguousPartsRows: buckets.get("ambiguous_parts_hold")?.length ?? 0,
      evidenceRows: evidenceRows.length,
      runtimeApprovedRows: evidenceRows.filter((row) => row.runtimeApproved).length,
    },
    evidenceRows,
    policyImplications: [
      "Parts rows are negative evidence for whole-product AirPods readiness.",
      "Side-unit-only and charging-case-only rows must stay outside normal matched SKU evidence.",
      "Ambiguous parts rows remain manual-review hold evidence, not parser approval.",
      "No side/case policy or candidate pool wiring is approved here.",
    ],
    nextReportOnlyExperiments: [
      "keep AirPods normal SKU rows separate from parts exclusion evidence",
      "use side-unit and charging-case examples as negative tests only",
      "do not loosen parts gates to increase normal volume",
    ],
    doNotDo: [
      "Do not count side-only rows as normal AirPods",
      "Do not count charging-case-only rows as normal AirPods",
      "Do not public-promote earphone_discovered",
      "Do not wire candidate pool policy from this evidence",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-parts-exclusion-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| part_class | count | evidence_class | report_only_action | sample_pids | sample_titles | runtime_approved |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...evidenceRows.map((row) => (
      `| ${row.partClass} | ${row.count} | ${row.evidenceClass} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} | ${row.sampleTitles.join("<br>")} | no |`
    )),
  ].join("\n");

  const md = [
    "# Earphone Parts Exclusion Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only parts exclusion evidence for earphone_discovered. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- parts rows: ${report.metrics.partsRows}/${report.metrics.totalSamples} (${report.metrics.partsRate}%)`,
    `- direct exclusion rows: ${report.metrics.directExclusionRows}/${report.metrics.partsRows} (${report.metrics.directExclusionRateOfParts}%)`,
    `- ambiguous parts hold rows: ${report.metrics.ambiguousPartsRows}`,
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

  await writeFile(path.join(reportsDir, "earphone-parts-exclusion-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/earphone-parts-exclusion-evidence-latest.json");
  console.log("wrote reports/earphone-parts-exclusion-evidence-latest.md");
  console.log(`earphone parts exclusion evidence: parts=${partsRows}, direct_exclusion=${directExclusionRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
