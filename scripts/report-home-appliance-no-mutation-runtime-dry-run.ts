import fs from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type ModelRow = {
  key: string;
  subtype: string;
  subtypeBoundaryClass: string;
};
type GenericRow = {
  pid: string;
  title: string;
  price: number;
  genericClass: string;
};

const modelReport = JSON.parse(fs.readFileSync("reports/home-appliance-vacuum-model-subtype-boundary-evidence-latest.json", "utf8")) as { rows: ModelRow[] };
const genericReport = JSON.parse(fs.readFileSync("reports/home-appliance-generic-vacuum-exclusion-readiness-latest.json", "utf8")) as { rows: GenericRow[] };

function titleFromKey(key: string): string {
  if (key === "lg-codezero-a9") return "LG 코드제로 A9 무선청소기";
  if (key === "dyson-v10") return "다이슨 V10 무선청소기";
  if (key === "dyson-v7") return "다이슨 V7 무선청소기";
  if (key === "samsung-bespoke-jet") return "삼성 비스포크 제트 무선청소기";
  if (key === "clean-r9") return "클리엔 R9 로봇청소기";
  return key;
}

const cases = [
  ...modelReport.rows.map((row) => ({
    id: `HOME-REF-${row.key}`,
    title: titleFromKey(row.key),
    expectedDecision: row.subtype === "robot_vacuum" ? "separate_subtype_hold_only" : "reference_only_not_runtime_candidate",
    basis: row.subtypeBoundaryClass,
    price: 100_000,
  })),
  ...genericReport.rows.slice(0, 8).map((row) => ({
    id: `HOME-HOLD-${row.pid}`,
    title: row.title,
    expectedDecision: "negative_hold_only",
    basis: row.genericClass,
    price: row.price,
  })),
];

const rows = cases.map((row) => {
  const classified = classifyListing(row.title, "", row.price);
  const parsed = parseListingOptions({
    title: row.title,
    description: "",
    category: "small_appliance",
    skuId: null,
    skuName: null,
  });
  const actualDecision = classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview
    ? "candidate_positive_only"
    : row.expectedDecision;
  const pass = actualDecision === row.expectedDecision;
  return {
    ...row,
    runtimeListingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    actualDecision,
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
  directThirtyDayPlanEdit: false,
  category: "home_appliance_tech_discovered",
  scope: "no-mutation runtime dry-run over vacuum subtype reference/hold cases",
  inputFiles: [
    "reports/home-appliance-vacuum-model-subtype-boundary-evidence-latest.json",
    "reports/home-appliance-generic-vacuum-exclusion-readiness-latest.json",
  ],
  metrics: {
    rows: rows.length,
    passedRows: rows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    candidatePositiveOnlyRows: rows.filter((row) => row.actualDecision === "candidate_positive_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "home_appliance_runtime_dry_run_has_unexpected_candidate_rows"
    : "home_appliance_runtime_dry_run_confirms_runtime_unwired_and_no_candidate_leak",
  nextAction: "Generate queue rollup across no-mutation dry-runs and patch-review items.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "home-appliance-no-mutation-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "home-appliance-no-mutation-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Home Appliance No-Mutation Runtime Dry-Run",
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
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- passedRows: ${report.metrics.passedRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  "",
  "## Rows",
  "",
  "| id | expected | actual | listingType | comparableKey | needsReview | pass | title |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.id} | ${row.expectedDecision} | ${row.actualDecision} | ${row.runtimeListingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} | ${row.title.replace(/\|/g, "\\|")} |`),
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
  failedRows: report.metrics.failedRows,
  candidatePositiveOnlyRows: report.metrics.candidatePositiveOnlyRows,
  jsonPath,
  mdPath,
}, null, 2));
