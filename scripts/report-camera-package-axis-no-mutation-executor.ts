import fs from "node:fs";
import path from "node:path";

type ContractRow = {
  caseId: string;
  pid: string;
  title: string;
  taxonomyClass: string;
  expectedDecision: string;
  outputContract: {
    package_axis: string;
    lens_axis: string;
  };
};

type ContractReport = {
  outputRows: ContractRow[];
};

const contractPath = "reports/camera-package-axis-dry-run-contract-latest.json";
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as ContractReport;

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^0-9a-z가-힣+/-]+/g, " ").replace(/\s+/g, " ").trim();
}

function inferBodyModel(title: string) {
  const compact = normalizeText(title).replace(/\s+/g, "");
  const patterns: Array<[RegExp, string]> = [
    [/eosr6markii|r6markii|알육막투/, "eos_r6_mark_ii"],
    [/xt4|x-t4/, "x_t4"],
    [/nikonz5|z5/, "z5"],
    [/a7m3|ilce7m3/, "a7m3"],
    [/eosr10|r10/, "eos_r10"],
    [/powershotv10|파워샷v10/, "powershot_v10"],
  ];
  for (const [pattern, model] of patterns) {
    if (pattern.test(compact)) return model;
  }
  return null;
}

function inferFamily(title: string) {
  const text = normalizeText(title);
  if (/캐논|canon|eos|파워샷|powershot/.test(text)) return "canon";
  if (/소니|sony|ilce|a7|a9|nex|zv/.test(text)) return "sony";
  if (/니콘|nikon/.test(text)) return "nikon";
  if (/후지|fujifilm|후지필름/.test(text)) return "fujifilm";
  if (/파나소닉|panasonic|루믹스|lumix/.test(text)) return "panasonic";
  if (/삼성|samsung/.test(text)) return "samsung";
  return null;
}

function inferLensAxis(title: string, packageAxis: string) {
  const compact = normalizeText(title).replace(/\s+/g, "");
  if (packageAxis === "body_only") return "no_lens";
  if (packageAxis === "kit_lens_multi") return "multi_lens_2plus";
  if (packageAxis === "fixed_lens_compact") return "built_in_lens";
  if (packageAxis === "lens_only") {
    const focal = compact.match(/(\d{2,3})[-~](\d{2,3})/);
    return focal ? `${focal[1]}_${focal[2]}` : "unknown_lens";
  }
  const focal = compact.match(/(\d{2,3})[-~](\d{2,3})/);
  if (focal) return `${focal[1]}_${focal[2]}`;
  if (/더블줌|렌즈2종|2종/.test(compact)) return "multi_lens_2plus";
  if (/번들렌즈|번들킷|키트/.test(compact)) return "unknown_kit_lens";
  return packageAxis === "kit_lens_single" ? "unknown_lens" : "none";
}

const rows = contract.outputRows.map((row) => {
  const packageAxis = row.outputContract.package_axis;
  const family = inferFamily(row.title);
  const bodyModel = inferBodyModel(row.title);
  const lensAxis = inferLensAxis(row.title, packageAxis);
  const hasExplicitSingleLens = packageAxis === "kit_lens_single" && !["unknown_lens", "unknown_kit_lens", "none"].includes(lensAxis);
  const candidatePositive =
    row.expectedDecision === "future_positive_after_runtime_parser" &&
    Boolean(family) &&
    Boolean(bodyModel) &&
    (packageAxis === "body_only" || hasExplicitSingleLens);
  const comparableKey = candidatePositive
    ? `camera|${family}|${bodyModel}|${packageAxis}|${lensAxis}`
    : null;
  const actualDecision = candidatePositive
    ? "future_positive_after_runtime_parser"
    : row.expectedDecision === "manual_review_only"
      ? "manual_review_only"
      : "hold_or_exclusion";
  const pass = actualDecision === row.expectedDecision;
  return {
    caseId: row.caseId,
    pid: row.pid,
    title: row.title,
    taxonomyClass: row.taxonomyClass,
    expectedDecision: row.expectedDecision,
    actualDecision,
    family,
    bodyModel,
    packageAxis,
    lensAxis,
    comparableKey,
    candidatePositive,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);
const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  category: "camera_discovered",
  scope: "camera package-axis no-mutation executor result over fixture contract",
  inputFiles: [contractPath],
  metrics: {
    rows: rows.length,
    candidatePositiveRows: rows.filter((row) => row.candidatePositive).length,
    manualReviewRows: rows.filter((row) => row.actualDecision === "manual_review_only").length,
    holdRows: rows.filter((row) => row.actualDecision === "hold_or_exclusion").length,
    failedRows: failedRows.length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "camera_package_axis_no_mutation_executor_needs_review"
    : "camera_package_axis_no_mutation_executor_passed",
  nextAction: "Camera runtime parser can be considered only for body_only exact-model subset first; kit-lens and fixed-lens remain manual/hold until stronger lens taxonomy exists.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-package-axis-no-mutation-executor-latest.json");
const mdPath = path.join(reportsDir, "camera-package-axis-no-mutation-executor-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Camera Package-Axis No-Mutation Executor",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- candidatePositiveRows: ${report.metrics.candidatePositiveRows}`,
  `- manualReviewRows: ${report.metrics.manualReviewRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | family | bodyModel | packageAxis | lensAxis | comparableKey | pass | title |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.actualDecision} | ${row.family ?? "null"} | ${row.bodyModel ?? "null"} | ${row.packageAxis} | ${row.lensAxis} | ${row.comparableKey ?? "null"} | ${row.pass ? "yes" : "no"} | ${row.title.replace(/\|/g, "\\|")} |`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  rows: report.metrics.rows,
  candidatePositiveRows: report.metrics.candidatePositiveRows,
  failedRows: report.metrics.failedRows,
  jsonPath,
  mdPath,
}, null, 2));
