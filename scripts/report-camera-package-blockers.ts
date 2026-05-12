import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CameraReport = {
  category: string;
  total: number;
  normal: number;
  parserReadyRate: number;
  modelMatchedRate: number;
  parserReadyOfMatchedRate: number;
  unknownPackageRate: number;
  gateCounts: Array<{ key: string; count: number }>;
  packageCounts: Array<{ key: string; count: number }>;
  modelCounts: Array<{ key: string; count: number }>;
  examples: Array<{ pid?: string; title?: string; price?: number; model_key?: string | null; package_config?: string | null }>;
  recommendation: string;
};

const reportsDir = path.join(process.cwd(), "reports");

function groupExamples(examples: CameraReport["examples"]): Record<string, CameraReport["examples"]> {
  return examples.reduce<Record<string, CameraReport["examples"]>>((acc, example) => {
    const key = example.package_config ?? "missing_package";
    acc[key] = acc[key] ?? [];
    if (acc[key].length < 10) acc[key].push(example);
    return acc;
  }, {});
}

async function main(): Promise<void> {
  const camera = JSON.parse(await readFile(path.join(reportsDir, "camera-parser-latest.json"), "utf8")) as CameraReport;
  const examplesByPackage = groupExamples(camera.examples);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: camera.category,
    decision: "hold_report_only",
    whyHoldDespiteParserReady: [
      `parserReadyRate=${camera.parserReadyRate}% is measured inside a report-only parser, not a runtime category`,
      `unknownPackageRate=${camera.unknownPackageRate}% still blocks body/lens/kit/fixed-lens comparable keys`,
      "camera category has no approved runtime category/parser/policy boundary in this subagent scope",
      "body-only, lens-kit, and fixed-lens compact cameras must not share one comparable key",
    ],
    currentMetrics: {
      total: camera.total,
      normal: camera.normal,
      parserReadyRate: camera.parserReadyRate,
      modelMatchedRate: camera.modelMatchedRate,
      parserReadyOfMatchedRate: camera.parserReadyOfMatchedRate,
      unknownPackageRate: camera.unknownPackageRate,
      gateCounts: camera.gateCounts,
      packageCounts: camera.packageCounts,
      topModelCounts: camera.modelCounts.slice(0, 15),
    },
    packagePoliciesNeeded: [
      {
        packageConfig: "body_only",
        needed: ["explicit body-only signal", "lens/accessory absence", "model family key"],
        holdIf: ["lens included", "bundle/full set ambiguous", "accessory-only contamination"],
      },
      {
        packageConfig: "lens_kit",
        needed: ["lens kit signal", "included lens identity when possible", "body model key"],
        holdIf: ["double zoom/kit contents unclear", "lens-only row", "multi-body bundle"],
      },
      {
        packageConfig: "fixed_lens",
        needed: ["fixed-lens compact model key", "not interchangeable body", "not camera accessory"],
        holdIf: ["case/bag/cage only", "vintage generic 디카 without model", "repair/parts row"],
      },
      {
        packageConfig: "unknown_package",
        needed: ["package_config recovery before any candidate use"],
        holdIf: ["package remains unknown"],
      },
    ],
    examplesByPackage,
    nextReportOnlyExperiments: [
      "separate unknown_package examples by known model vs unknown model",
      "draft fixed-lens compact model coverage list without runtime apply",
      "compare body_only vs lens_kit examples for false merge risk",
    ],
    doNotDo: [
      "Do not runtime-wire camera category",
      "Do not public-promote camera_discovered",
      "Do not compare body-only and lens-kit listings in one candidate key",
      "Do not edit catalog/category-readiness/option-parser for this report",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-package-blockers-latest.json"), JSON.stringify(report, null, 2));

  const packageTable = [
    "| package_config | needed | hold_if |",
    "| --- | --- | --- |",
    ...report.packagePoliciesNeeded.map((row) =>
      `| ${row.packageConfig} | ${row.needed.map((item) => `- ${item}`).join("<br>")} | ${row.holdIf.map((item) => `- ${item}`).join("<br>")} |`,
    ),
  ].join("\n");

  const md = [
    "# Camera Package Blockers",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only camera package diagnosis. This is not runtime wiring and not public promotion.",
    "",
    "## Why Hold Despite Parser Ready",
    "",
    ...report.whyHoldDespiteParserReady.map((line) => `- ${line}`),
    "",
    "## Package Policies Needed",
    "",
    packageTable,
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "camera-package-blockers-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-package-blockers-latest.json");
  console.log("wrote reports/camera-package-blockers-latest.md");
  console.log(`camera package blockers: unknown_package=${camera.unknownPackageRate}%, parser_ready=${camera.parserReadyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
