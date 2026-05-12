import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraFalseMergeRow = {
  pid?: string;
  title?: string;
  price?: number;
  model_key?: string | null;
  package_config?: string | null;
  packageSignal?: string;
  riskClass: string;
  falseMergeRisk: string;
};

type CameraFalseMergeMatrix = {
  category: string;
  rows: CameraFalseMergeRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function evidenceClass(row: CameraFalseMergeRow): string {
  if (row.riskClass === "true_lens_kit_reference") return "lens_kit_reference_only";
  if (row.riskClass === "body_only_reference") return "body_only_do_not_merge";
  if (row.riskClass === "unknown_package_full_box_not_lens_kit") return "full_box_not_lens_kit";
  if (row.riskClass === "unknown_package_accessory_bundle_not_lens_kit") return "accessory_bundle_not_lens_kit";
  return "unknown_package_missing_signal_hold";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const falseMerge = JSON.parse(
    await readFile(path.join(reportsDir, "camera-false-merge-risk-matrix-latest.json"), "utf8"),
  ) as CameraFalseMergeMatrix;

  const rows = falseMerge.rows.map((row) => ({
    ...row,
    evidenceClass: evidenceClass(row),
    runtimeApproved: false,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: falseMerge.category,
    decision: "camera_package_evidence_report_only",
    sourceReports: ["camera-false-merge-risk-matrix-latest.json", "camera-interchangeable-package-review-latest.json"],
    metrics: {
      matrixRows: rows.length,
      unknownPackageEvidenceRows: rows.filter((row) => row.evidenceClass.startsWith("unknown_package") || row.evidenceClass.endsWith("not_lens_kit")).length,
      lensKitReferenceRows: rows.filter((row) => row.evidenceClass === "lens_kit_reference_only").length,
      bodyOnlyReferenceRows: rows.filter((row) => row.evidenceClass === "body_only_do_not_merge").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      evidenceClassCounts: countBy(rows.map((row) => row.evidenceClass)),
      packageSignalCounts: countBy(rows.map((row) => row.packageSignal ?? "reference_or_missing_signal_field")),
    },
    rows,
    policyImplications: [
      "Full-box and accessory-bundle evidence must not be converted into lens-kit recovery.",
      "Body-only references must remain separate from true lens-kit references.",
      "Unknown package rows remain hold-only without explicit body/kit/full-box confirmation.",
      "No camera runtime category/parser design is approved here.",
    ],
    nextReportOnlyExperiments: [
      "only add explicit lens identity examples if source reports expose lens names",
      "keep full-box and accessory-bundle signals as negative false-merge evidence",
      "wait for main agent before any camera package policy wiring",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not recover package_config in runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-package-evidence-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | evidence_class | package_signal | false_merge_risk | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.evidenceClass} | ${row.packageSignal ?? "-"} | ${row.falseMergeRisk} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Camera Package Evidence Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only camera package evidence matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "camera-package-evidence-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-package-evidence-matrix-latest.json");
  console.log("wrote reports/camera-package-evidence-matrix-latest.md");
  console.log(`camera package evidence matrix: rows=${rows.length}, unknown_package=${report.metrics.unknownPackageEvidenceRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
