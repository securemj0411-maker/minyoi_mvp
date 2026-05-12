import fs from "node:fs";
import path from "node:path";

import { evaluateCategoryReadiness } from "@/lib/category-readiness";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type ExecutorRow = {
  caseId: string;
  title: string;
  price: number | null;
  expectedDecision: "candidate_positive_contract_only" | "manual_review" | "hold_or_exclusion";
  expectedComparableKey: string | null;
};

type ExecutorReport = {
  rows: ExecutorRow[];
};

const executorPath = "reports/camera-body-only-exact-model-no-mutation-executor-latest.json";
const executor = JSON.parse(fs.readFileSync(executorPath, "utf8")) as ExecutorReport;

const rows = executor.rows.map((row) => {
  const price = row.price ?? 100_000;
  const sku = ruleMatch(row.title, "");
  const classified = classifyListing(row.title, "", price);
  const parsed = parseListingOptions({
    title: row.title,
    description: "",
    category: sku?.category ?? null,
    skuId: sku?.id ?? null,
    skuName: sku?.modelName ?? null,
  });
  const readiness = evaluateCategoryReadiness(parsed.category);
  const expectedPositive = row.expectedDecision === "candidate_positive_contract_only";
  const emittedBodyOnlyKey = parsed.comparableKey?.startsWith("camera|") && parsed.comparableKey.endsWith("|body_only|no_lens");
  const pass = expectedPositive
    ? sku?.category === "camera"
      && classified.listingType === "normal"
      && parsed.comparableKey === row.expectedComparableKey
      && parsed.needsReview === false
      && readiness.canEnterPool === false
    : !emittedBodyOnlyKey || classified.listingType !== "normal" || readiness.canEnterPool === false;
  return {
    caseId: row.caseId,
    title: row.title,
    expectedDecision: row.expectedDecision,
    skuId: sku?.id ?? null,
    category: sku?.category ?? null,
    listingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    readinessStatus: readiness.status,
    canEnterPool: readiness.canEnterPool,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  runtimeCatalogApply: true,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "camera",
  lane: "camera_body_only_exact_model_internal_only",
  inputFiles: [executorPath],
  metrics: {
    rows: rows.length,
    failedRows: failedRows.length,
    internalPositiveRows: rows.filter((row) => row.category === "camera" && row.comparableKey?.startsWith("camera|")).length,
    poolBlockedRows: rows.filter((row) => row.canEnterPool === false).length,
  },
  rows,
  failedRows,
  conclusion:
    failedRows.length === 0
      ? "camera_body_only_internal_runtime_route_passed_public_gate_closed"
      : "camera_body_only_internal_runtime_route_needs_review",
  nextAction:
    "Keep camera internal_only; collect internal body-only market samples before any readiness promotion. Body+렌즈/fixed-lens/lens-only stay held.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-internal-runtime-route-latest.json");
const mdPath = path.join(reportsDir, "camera-internal-runtime-route-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Camera Internal Runtime Route",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- runtimeCatalogApply: true",
  "- publicPromotion: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  `- internalPositiveRows: ${report.metrics.internalPositiveRows}`,
  `- poolBlockedRows: ${report.metrics.poolBlockedRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | skuId | category | listingType | comparableKey | needsReview | readiness | canEnterPool | pass |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.skuId ?? "null"} | ${row.category ?? "null"} | ${row.listingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.readinessStatus} | ${row.canEnterPool} | ${row.pass ? "yes" : "no"} |`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      rows: report.metrics.rows,
      failedRows: report.metrics.failedRows,
      internalPositiveRows: report.metrics.internalPositiveRows,
      poolBlockedRows: report.metrics.poolBlockedRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
