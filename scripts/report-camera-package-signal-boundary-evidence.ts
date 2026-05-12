import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraEvidenceRow = {
  pid?: string | number;
  title?: string;
  price?: number;
  model_key?: string | null;
  package_config?: string | null;
  packageSignal?: string;
  riskClass: string;
  falseMergeRisk: string;
  evidenceClass: string;
  runtimeApproved: boolean;
};

type CameraPackageEvidence = {
  category: string;
  rows: CameraEvidenceRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function modelFamily(modelKey: string | null | undefined): string {
  if (!modelKey) return "missing_model_key";
  if (modelKey.startsWith("sony-")) return "sony_interchangeable";
  if (modelKey.startsWith("canon-")) return "canon_interchangeable";
  if (modelKey.startsWith("fujifilm-")) return "fujifilm";
  if (modelKey.startsWith("panasonic-")) return "panasonic";
  return "other_known_model";
}

function boundaryClass(row: CameraEvidenceRow): string {
  if (row.evidenceClass === "full_box_not_lens_kit") return "full_box_boundary_not_lens_identity";
  if (row.evidenceClass === "accessory_bundle_not_lens_kit") return "accessory_bundle_boundary_not_lens_identity";
  if (row.evidenceClass === "unknown_package_missing_signal_hold") return "missing_package_signal_hold";
  if (row.evidenceClass === "body_only_do_not_merge") return "body_only_reference_boundary";
  if (row.evidenceClass === "lens_kit_reference_only") return "lens_kit_reference_boundary";
  return "camera_package_other_boundary";
}

function actionFor(boundary: string): string {
  if (boundary === "full_box_boundary_not_lens_identity") return "manual review only; full-box is not lens-kit evidence";
  if (boundary === "accessory_bundle_boundary_not_lens_identity") return "manual review only; accessory bundle is not lens-kit evidence";
  if (boundary === "missing_package_signal_hold") return "hold until body/kit/full-box signal is explicit";
  if (boundary === "body_only_reference_boundary") return "keep separate from lens-kit rows";
  if (boundary === "lens_kit_reference_boundary") return "reference only, not runtime approval";
  return "hold report-only";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const evidence = JSON.parse(
    await readFile(path.join(reportsDir, "camera-package-evidence-matrix-latest.json"), "utf8"),
  ) as CameraPackageEvidence;

  const rows = evidence.rows.map((row) => {
    const boundary = boundaryClass(row);
    return {
      ...row,
      modelFamily: modelFamily(row.model_key),
      boundaryClass: boundary,
      reportOnlyAction: actionFor(boundary),
      runtimeApproved: false,
    };
  });

  const unknownPackageRows = rows.filter((row) => row.package_config === "unknown_package");
  const recoveryLikeRows = unknownPackageRows.filter((row) =>
    row.boundaryClass === "full_box_boundary_not_lens_identity" ||
    row.boundaryClass === "accessory_bundle_boundary_not_lens_identity",
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: evidence.category,
    decision: "camera_package_signal_boundary_evidence_report_only",
    sourceReports: ["camera-package-evidence-matrix-latest.json", "camera-false-merge-risk-matrix-latest.json"],
    metrics: {
      matrixRows: rows.length,
      unknownPackageRows: unknownPackageRows.length,
      recoveryLikeUnknownPackageRows: recoveryLikeRows.length,
      missingSignalUnknownPackageRows: unknownPackageRows.filter((row) => row.boundaryClass === "missing_package_signal_hold").length,
      bodyOnlyReferenceRows: rows.filter((row) => row.boundaryClass === "body_only_reference_boundary").length,
      lensKitReferenceRows: rows.filter((row) => row.boundaryClass === "lens_kit_reference_boundary").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
      boundaryClassCounts: countBy(rows.map((row) => row.boundaryClass)),
      modelFamilyCounts: countBy(rows.map((row) => row.modelFamily)),
      packageSignalCounts: countBy(rows.map((row) => row.packageSignal ?? "reference_or_missing_signal_field")),
    },
    rows,
    policyImplications: [
      "Full-box and accessory-bundle signals are recovery-like evidence, not lens-kit identity.",
      "Missing package signal rows remain hold-only even when model_key exists.",
      "Body-only and lens-kit references must remain separate to avoid false merges.",
      "No camera package recovery policy or runtime parser change is approved here.",
    ],
    nextReportOnlyExperiments: [
      "only split package recovery after explicit lens identity is available",
      "keep recovery-like unknown_package rows as manual review evidence",
      "do not merge body-only reference rows into lens-kit reference rows",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not recover package_config in runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-package-signal-boundary-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | boundary_class | model_family | package_signal | action | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => (
      `| ${row.pid ?? "-"} | ${row.boundaryClass} | ${row.modelFamily} | ${row.packageSignal ?? "-"} | ${row.reportOnlyAction} | no | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`
    )),
  ].join("\n");

  const md = [
    "# Camera Package Signal Boundary Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only camera package signal boundary evidence. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- unknown package rows: ${report.metrics.unknownPackageRows}`,
    `- recovery-like unknown package rows: ${report.metrics.recoveryLikeUnknownPackageRows}`,
    `- missing-signal unknown package rows: ${report.metrics.missingSignalUnknownPackageRows}`,
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

  await writeFile(path.join(reportsDir, "camera-package-signal-boundary-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-package-signal-boundary-evidence-latest.json");
  console.log("wrote reports/camera-package-signal-boundary-evidence-latest.md");
  console.log(`camera package signal boundary evidence: unknown_package=${unknownPackageRows.length}, recovery_like=${recoveryLikeRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
