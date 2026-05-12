import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EarphonePartRow = {
  partClass: string;
  count: number;
  evidenceClass: string;
  samplePids: Array<string | number>;
  sampleTitles: string[];
};

type EarphonePartsEvidence = {
  evidenceRows: EarphonePartRow[];
};

type HeadphoneEvidenceRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  comparableKey?: string;
  connector?: string;
  generation?: string;
  reviewClass?: string;
  evidenceClass?: string;
};

type HeadphoneAirPodsMaxEvidence = {
  evidenceRows: HeadphoneEvidenceRow[];
};

type HeadphoneBlockers = {
  unknownSkuExamples: HeadphoneEvidenceRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const earphoneParts = await readJson<EarphonePartsEvidence>("earphone-parts-exclusion-evidence-latest.json");
  const airpodsMax = await readJson<HeadphoneAirPodsMaxEvidence>("headphone-airpods-max-review-evidence-latest.json");
  const headphoneBlockers = await readJson<HeadphoneBlockers>("headphone-matched-sku-blockers-latest.json");

  const rows = [
    ...earphoneParts.evidenceRows.flatMap((row) =>
      row.sampleTitles.slice(0, 3).map((title, index) => ({
        category: "earphone_discovered",
        sourceReport: "earphone-parts-exclusion-evidence-latest.md",
        pid: row.samplePids[index] ?? null,
        title,
        boundaryClass: row.partClass,
        evidenceClass: row.evidenceClass,
        detail: `part_count=${row.count}`,
        runtimeApproved: false,
      })),
    ),
    ...airpodsMax.evidenceRows.slice(0, 10).map((row) => ({
      category: "headphone_discovered",
      sourceReport: "headphone-airpods-max-review-evidence-latest.md",
      pid: row.pid ?? null,
      title: row.title ?? "",
      boundaryClass: row.reviewClass ?? "airpods_max_review",
      evidenceClass: row.evidenceClass ?? "airpods_max_review",
      detail: `connector=${row.connector ?? "-"}; generation=${row.generation ?? "-"}; key=${row.comparableKey ?? "-"}`,
      runtimeApproved: false,
    })),
    ...headphoneBlockers.unknownSkuExamples.slice(0, 8).map((row) => ({
      category: "headphone_discovered",
      sourceReport: "headphone-matched-sku-blockers-latest.md",
      pid: row.pid ?? null,
      title: row.title ?? "",
      boundaryClass: "unknown_sku_hold",
      evidenceClass: "headphone_unknown_sku_hold",
      detail: `gate=${String((row as Record<string, unknown>).gate ?? "unknown")}`,
      runtimeApproved: false,
    })),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    totalExamples: rows.length,
    rows,
    metrics: {
      earphoneExamples: rows.filter((row) => row.category === "earphone_discovered").length,
      headphoneExamples: rows.filter((row) => row.category === "headphone_discovered").length,
      boundaryClassCounts: countBy(rows.map((row) => row.boundaryClass)),
      sourceCounts: countBy(rows.map((row) => row.sourceReport)),
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
    },
    guardrails: [
      "AirPods/headphone boundary examples are report-only",
      "Do not public-promote earphone_discovered or headphone_discovered",
      "Do not wire AirPods/headphone policy from this report",
      "Do not treat side/case parts or AirPods Max unknown connector rows as approved candidates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-airpods-headphone-boundary-examples-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | source_report | pid | boundary_class | evidence_class | detail | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => (
      `| ${row.category} | ${row.sourceReport} | ${row.pid ?? "-"} | ${row.boundaryClass} | ${row.evidenceClass} | ${row.detail.replace(/\|/g, "/")} | no | ${row.title.replace(/\|/g, "/")} |`
    )),
  ].join("\n");

  const md = [
    "# Parser AirPods Headphone Boundary Examples",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only AirPods/headphone boundary examples. This is not runtime wiring and not public promotion.",
    "",
    `Earphone examples: ${report.metrics.earphoneExamples}`,
    `Headphone examples: ${report.metrics.headphoneExamples}`,
    `Runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-airpods-headphone-boundary-examples-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-airpods-headphone-boundary-examples-latest.json");
  console.log("wrote reports/parser-airpods-headphone-boundary-examples-latest.md");
  console.log(`airpods/headphone boundary examples: examples=${rows.length}, earphone=${report.metrics.earphoneExamples}, headphone=${report.metrics.headphoneExamples}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
