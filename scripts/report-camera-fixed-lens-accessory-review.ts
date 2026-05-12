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

function coverageFamily(example: CameraExample): string {
  const key = example.model_key ?? "";
  const title = example.title ?? "";
  if (/g7x/i.test(`${key} ${title}`)) return "canon-g7x";
  if (/x70/i.test(`${key} ${title}`)) return "fujifilm-x70";
  if (/cyber|dsc|사이버샷/i.test(`${key} ${title}`)) return "sony-cybershot";
  if (/gr\s?3|gr3/i.test(`${key} ${title}`)) return "ricoh-gr";
  if (/dlux|d-lux|라이카/i.test(`${key} ${title}`)) return "leica-dlux";
  return "fixed_lens_other";
}

function accessoryClass(example: CameraExample): string {
  const title = example.title ?? "";
  if (/케이지|cage/i.test(title)) return "camera_cage";
  if (/가방|bag/i.test(title)) return "camera_bag";
  if (/케이스|가죽케이스|case/i.test(title)) return "camera_case";
  return "accessory_other";
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

  const knownFixed = deepDive.examplesByClass.known_fixed_lens_unknown_package ?? [];
  const hintedFixed = deepDive.examplesByClass.unknown_model_fixed_lens_hint ?? [];
  const accessory = deepDive.examplesByClass.accessory_contamination ?? [];
  const fixedLensRows = [...knownFixed, ...hintedFixed].map((example) => ({
    ...example,
    coverageFamily: coverageFamily(example),
    confidence: example.model_key ? "known_model_key" : "title_hint_only",
    action: example.model_key ? "manual_review_before_coverage_candidate" : "keep_hold_until_model_key_confirmed",
  }));
  const accessoryRows = accessory.map((example) => ({
    ...example,
    accessoryClass: accessoryClass(example),
    action: "exclude_from_camera_model_package_recovery",
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: deepDive.category,
    decision: "hold_report_only_review_list",
    sourceReports: ["camera-package-deep-dive-latest.json", "camera-package-blockers-latest.json"],
    metrics: {
      fixedLensRows: fixedLensRows.length,
      knownFixedLensRows: knownFixed.length,
      hintedFixedLensRows: hintedFixed.length,
      accessoryRows: accessoryRows.length,
      fixedLensCoverageFamilies: countBy(fixedLensRows.map((row) => row.coverageFamily)),
      accessoryClasses: countBy(accessoryRows.map((row) => row.accessoryClass)),
    },
    fixedLensRows,
    accessoryRows,
    policyImplications: [
      "Known fixed-lens rows can become coverage candidates only after manual review; this report does not approve them.",
      "Title-hint-only fixed-lens rows remain hold-only until a model key is confirmed.",
      "Accessory contamination must be excluded from unknown_package readiness and package recovery denominators.",
      "Leica D-Lux style titles can be both fixed-lens hints and accessory-contaminated if the listing emphasizes case/bag content.",
    ],
    nextReportOnlyExperiments: [
      "compare known fixed-lens rows with fixed_lens package rows for duplicate coverage gaps",
      "export accessory contamination examples into future exclusion-test candidates",
      "separate known_interchangeable_unknown_package body/kit/full-box signals without runtime apply",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not add fixed-lens coverage to catalog/runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-fixed-lens-accessory-review-latest.json"), JSON.stringify(report, null, 2));

  const fixedTable = [
    "| pid | coverage_family | confidence | action | title |",
    "| --- | --- | --- | --- | --- |",
    ...fixedLensRows.map((row) => `| ${row.pid ?? "-"} | ${row.coverageFamily} | ${row.confidence} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const accessoryTable = [
    "| pid | accessory_class | action | title |",
    "| --- | --- | --- | --- |",
    ...accessoryRows.map((row) => `| ${row.pid ?? "-"} | ${row.accessoryClass} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Camera Fixed-Lens Accessory Review",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only fixed-lens coverage and accessory contamination review. This is not runtime wiring and not public promotion.",
    "",
    "## Fixed-Lens Rows",
    "",
    fixedTable,
    "",
    "## Accessory Contamination Rows",
    "",
    accessoryTable,
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

  await writeFile(path.join(reportsDir, "camera-fixed-lens-accessory-review-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-fixed-lens-accessory-review-latest.json");
  console.log("wrote reports/camera-fixed-lens-accessory-review-latest.md");
  console.log(`camera fixed-lens/accessory review: fixed_lens=${fixedLensRows.length}, accessory=${accessoryRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
