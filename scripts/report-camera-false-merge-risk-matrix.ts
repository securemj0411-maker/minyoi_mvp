import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraRow = {
  pid?: string;
  title?: string;
  price?: number;
  model_key?: string | null;
  package_config?: string | null;
  packageSignal?: string;
};

type InterchangeableReview = {
  category: string;
  rows: CameraRow[];
};

type PackageBlockers = {
  examplesByPackage: Record<string, CameraRow[]>;
};

const reportsDir = path.join(process.cwd(), "reports");

function riskClass(row: CameraRow): string {
  if (row.package_config === "lens_kit") return "true_lens_kit_reference";
  if (row.package_config === "body_only") return "body_only_reference";
  if (row.packageSignal === "full_box_signal") return "unknown_package_full_box_not_lens_kit";
  if (row.packageSignal === "bundle_accessory_included_signal") return "unknown_package_accessory_bundle_not_lens_kit";
  return "unknown_package_missing_signal";
}

async function main(): Promise<void> {
  const review = JSON.parse(
    await readFile(path.join(reportsDir, "camera-interchangeable-package-review-latest.json"), "utf8"),
  ) as InterchangeableReview;
  const blockers = JSON.parse(await readFile(path.join(reportsDir, "camera-package-blockers-latest.json"), "utf8")) as PackageBlockers;

  const referenceRows = [
    ...(blockers.examplesByPackage.lens_kit ?? []),
    ...(blockers.examplesByPackage.body_only ?? []),
  ];
  const rows = [...review.rows, ...referenceRows].map((row) => ({
    ...row,
    riskClass: riskClass(row),
    falseMergeRisk:
      riskClass(row) === "true_lens_kit_reference"
        ? "reference_only"
        : riskClass(row) === "body_only_reference"
          ? "must_not_merge_with_lens_kit"
          : "must_not_recover_as_lens_kit_without_explicit_lens_identity",
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: review.category,
    decision: "false_merge_risk_matrix_report_only",
    sourceReports: ["camera-interchangeable-package-review-latest.json", "camera-package-blockers-latest.json"],
    metrics: {
      matrixRows: rows.length,
      unknownPackageRows: review.rows.length,
      lensKitReferenceRows: blockers.examplesByPackage.lens_kit?.length ?? 0,
      bodyOnlyReferenceRows: blockers.examplesByPackage.body_only?.length ?? 0,
      runtimeApprovedRows: 0,
    },
    rows,
    policyImplications: [
      "Full-box and accessory-included signals must not be treated as true lens-kit without explicit lens identity.",
      "Body-only references must not merge with lens-kit or unknown-package rows.",
      "Unknown package rows remain report-only review material.",
      "Camera runtime parser/category design remains blocked outside this subagent scope.",
    ],
    nextReportOnlyExperiments: [
      "extract explicit lens identity examples when source rows expose lens names",
      "separate full_box_signal from true_lens_kit_reference in future condition matrix",
      "keep camera category runtime wiring out of this work",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not recover package_config in runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-false-merge-risk-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | package_config | risk_class | false_merge_risk | title |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.package_config ?? "-"} | ${row.riskClass} | ${row.falseMergeRisk} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Camera False-Merge Risk Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only camera full-box/lens-kit/body-only false-merge risk matrix. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "camera-false-merge-risk-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-false-merge-risk-matrix-latest.json");
  console.log("wrote reports/camera-false-merge-risk-matrix-latest.md");
  console.log(`camera false-merge risk matrix: rows=${rows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
