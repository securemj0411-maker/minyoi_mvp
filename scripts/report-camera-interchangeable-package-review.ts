import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraExample = {
  pid?: string;
  title?: string;
  price?: number;
  model_key?: string | null;
  package_config?: string | null;
};

type CameraDeepDive = {
  category: string;
  examplesByClass: Record<string, CameraExample[]>;
};

const reportsDir = path.join(process.cwd(), "reports");

function packageSignal(example: CameraExample): string {
  const title = example.title ?? "";
  if (/풀박스|풀\s?박스|박스/i.test(title)) return "full_box_signal";
  if (/배터리|sd카드|메모리|포함/i.test(title)) return "bundle_accessory_included_signal";
  if (/바디|본체|body/i.test(title)) return "body_only_signal";
  return "package_signal_missing";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const deepDive = JSON.parse(
    await readFile(path.join(reportsDir, "camera-package-deep-dive-latest.json"), "utf8"),
  ) as CameraDeepDive;

  const sourceRows = deepDive.examplesByClass.known_interchangeable_unknown_package ?? [];
  const rows = sourceRows.map((row) => ({
    ...row,
    packageSignal: packageSignal(row),
    reviewAction:
      packageSignal(row) === "package_signal_missing"
        ? "keep_hold_until_body_kit_fullbox_confirmed"
        : "manual_review_before_package_recovery_candidate",
  }));
  const signalCounts = countBy(rows.map((row) => row.packageSignal));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "hold_report_only_package_signal_review",
    sourceReports: ["camera-package-deep-dive-latest.json", "camera-fixed-lens-accessory-review-latest.json"],
    metrics: {
      knownInterchangeableUnknownPackageRows: rows.length,
      recoverableSignalRows: rows.filter((row) => row.packageSignal !== "package_signal_missing").length,
      missingSignalRows: rows.filter((row) => row.packageSignal === "package_signal_missing").length,
      signalCounts,
    },
    rows,
    policyImplications: [
      "Known interchangeable camera model keys still need package signal review before package recovery.",
      "Full-box and accessory-included signals are not the same as body-only or lens-kit readiness.",
      "Rows with missing package signals remain hold-only.",
      "This report does not compare body-only and lens-kit rows in one candidate key.",
    ],
    nextReportOnlyExperiments: [
      "compare package_signal_missing rows with body_only/lens_kit examples for false merge risk",
      "separate full_box_signal from true lens_kit signal in a future report-only list",
      "keep camera category runtime parser design out of this subagent scope",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not recover package_config in runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-interchangeable-package-review-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | model_key | package_signal | review_action | title |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.model_key ?? "-"} | ${row.packageSignal} | ${row.reviewAction} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Camera Interchangeable Package Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only interchangeable camera package signal review. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "camera-interchangeable-package-review-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-interchangeable-package-review-latest.json");
  console.log("wrote reports/camera-interchangeable-package-review-latest.md");
  console.log(`camera interchangeable package review: rows=${rows.length}, recoverable_signal=${report.metrics.recoverableSignalRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
