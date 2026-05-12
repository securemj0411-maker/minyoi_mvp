import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraExample = {
  pid?: string;
  title?: string;
  price?: number;
  model_key?: string | null;
  package_config?: string | null;
};

type CameraParserReport = {
  category: string;
  parserReadyRate: number;
  modelMatchedRate: number;
  unknownPackageRate: number;
  examples: CameraExample[];
};

type CameraPackageBlockersReport = {
  currentMetrics: {
    packageCounts: Array<{ key: string; count: number }>;
  };
};

type PackageClass =
  | "known_interchangeable_unknown_package"
  | "known_fixed_lens_unknown_package"
  | "unknown_model_fixed_lens_hint"
  | "unknown_model_interchangeable_hint"
  | "accessory_contamination"
  | "unknown_camera_model";

const reportsDir = path.join(process.cwd(), "reports");

const fixedLensModelFragments = [
  "g7x",
  "x70",
  "x100",
  "dsc",
  "cyber",
  "dlux",
  "d-lux",
  "gr3",
  "gr-3",
  "lx",
  "powershot",
  "ixus",
];

const fixedLensTitlePatterns = [
  /g7x/i,
  /x70/i,
  /x100/i,
  /dsc[-\s]?[a-z0-9]+/i,
  /사이버샷/i,
  /cyber\s*shot/i,
  /dlux|d-lux/i,
  /gr\s*3|gr3/i,
  /dmc[-\s]?lx/i,
  /powershot/i,
  /ixus/i,
  /디지털카메라|디카/i,
];

const interchangeableTitlePatterns = [
  /eos/i,
  /\ba\d{1,4}[a-z0-9-]*\b/i,
  /\ba7[cmrs]?\d?\b/i,
  /\ba9\b/i,
  /nex[-\s]?\d/i,
  /zv[-\s]?e10/i,
  /e[-\s]?pl\d/i,
  /미러리스|풀프레임|바디/i,
];

const accessoryPatterns = [/가방|케이지|케이스|스트랩|가죽케이스|cage|bag|case/i];

function hasAny(patterns: RegExp[], title: string): boolean {
  return patterns.some((pattern) => pattern.test(title));
}

function isFixedLensModel(modelKey: string | null | undefined): boolean {
  if (!modelKey) return false;
  return fixedLensModelFragments.some((fragment) => modelKey.includes(fragment));
}

function classify(example: CameraExample): PackageClass {
  const title = example.title ?? "";
  if (hasAny(accessoryPatterns, title) && !example.model_key) return "accessory_contamination";
  if (example.model_key && isFixedLensModel(example.model_key)) return "known_fixed_lens_unknown_package";
  if (example.model_key) return "known_interchangeable_unknown_package";
  if (hasAny(fixedLensTitlePatterns, title)) return "unknown_model_fixed_lens_hint";
  if (hasAny(interchangeableTitlePatterns, title)) return "unknown_model_interchangeable_hint";
  if (hasAny(accessoryPatterns, title)) return "accessory_contamination";
  return "unknown_camera_model";
}

function countBy<T extends string>(items: T[]): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function groupedExamples(examples: CameraExample[]): Record<PackageClass, CameraExample[]> {
  return examples.reduce<Record<PackageClass, CameraExample[]>>(
    (acc, example) => {
      const key = classify(example);
      if (acc[key].length < 8) acc[key].push(example);
      return acc;
    },
    {
      known_interchangeable_unknown_package: [],
      known_fixed_lens_unknown_package: [],
      unknown_model_fixed_lens_hint: [],
      unknown_model_interchangeable_hint: [],
      accessory_contamination: [],
      unknown_camera_model: [],
    },
  );
}

async function main(): Promise<void> {
  const camera = JSON.parse(await readFile(path.join(reportsDir, "camera-parser-latest.json"), "utf8")) as CameraParserReport;
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "camera-package-blockers-latest.json"), "utf8"),
  ) as CameraPackageBlockersReport;

  const unknownPackageExamples = camera.examples.filter((example) => example.package_config === "unknown_package");
  const classes = unknownPackageExamples.map(classify);
  const classCounts = countBy(classes);
  const knownModelCount = unknownPackageExamples.filter((example) => Boolean(example.model_key)).length;
  const unknownModelCount = unknownPackageExamples.length - knownModelCount;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: camera.category,
    decision: "hold_report_only",
    sourceReports: ["camera-parser-latest.json", "camera-package-blockers-latest.json"],
    metrics: {
      parserReadyRate: camera.parserReadyRate,
      modelMatchedRate: camera.modelMatchedRate,
      unknownPackageRate: camera.unknownPackageRate,
      unknownPackageExamples: unknownPackageExamples.length,
      knownModelCount,
      unknownModelCount,
      packageCounts: blockers.currentMetrics.packageCounts,
      classCounts,
    },
    policyImplications: [
      {
        class: "known_interchangeable_unknown_package",
        implication: "model key exists, but package_config must still separate body-only, kit, and bundle signals before candidate use",
      },
      {
        class: "known_fixed_lens_unknown_package",
        implication: "fixed-lens compact model can use model key only after explicit accessory/body contamination checks",
      },
      {
        class: "unknown_model_fixed_lens_hint",
        implication: "titles expose fixed-lens hints, but missing model_key keeps them internal review rows",
      },
      {
        class: "accessory_contamination",
        implication: "accessory-only rows must remain excluded from model/package recovery metrics",
      },
    ],
    examplesByClass: groupedExamples(unknownPackageExamples),
    nextReportOnlyExperiments: [
      "expand fixed-lens compact coverage list from known_fixed_lens and unknown_model_fixed_lens_hint rows",
      "separate accessory contamination from unknown_package denominator before readiness comparison",
      "compare known_interchangeable_unknown_package rows against body_only/lens_kit signals without runtime apply",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not apply fixed-lens or interchangeable body rules to catalog/runtime parser",
      "Do not candidate-pool wire camera package policy",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-package-deep-dive-latest.json"), JSON.stringify(report, null, 2));

  const classTable = [
    "| class | count |",
    "| --- | ---: |",
    ...classCounts.map((row) => `| ${row.key} | ${row.count} |`),
  ].join("\n");

  const implicationTable = [
    "| class | implication |",
    "| --- | --- |",
    ...report.policyImplications.map((row) => `| ${row.class} | ${row.implication} |`),
  ].join("\n");

  const md = [
    "# Camera Package Deep Dive",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only camera unknown_package split. This is not runtime wiring and not public promotion.",
    "",
    "## Metrics",
    "",
    `- parserReadyRate: ${report.metrics.parserReadyRate}%`,
    `- modelMatchedRate: ${report.metrics.modelMatchedRate}%`,
    `- unknownPackageRate: ${report.metrics.unknownPackageRate}%`,
    `- unknownPackageExamples: ${report.metrics.unknownPackageExamples}`,
    `- knownModelCount: ${report.metrics.knownModelCount}`,
    `- unknownModelCount: ${report.metrics.unknownModelCount}`,
    "",
    "## Unknown Package Classes",
    "",
    classTable,
    "",
    "## Policy Implications",
    "",
    implicationTable,
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "camera-package-deep-dive-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-package-deep-dive-latest.json");
  console.log("wrote reports/camera-package-deep-dive-latest.md");
  console.log(`camera package deep dive: classes=${classCounts.length}, unknown_package_examples=${unknownPackageExamples.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
