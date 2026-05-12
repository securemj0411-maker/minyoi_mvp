import fs from "node:fs";
import path from "node:path";

import { evaluateCategoryReadiness } from "@/lib/category-readiness";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type ContractRow = {
  caseId: string;
  title: string;
  price: number;
  expectedDecision: "candidate_positive_contract" | "manual_hold" | "negative_hold";
  expectedComparableKey: string | null;
};

type ContractReport = {
  rows: ContractRow[];
};

const contractPath = "reports/speaker-portable-exact-model-contract-latest.json";
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as ContractReport;

const rows = contract.rows.map((row) => {
  const sku = ruleMatch(row.title, "");
  const classified = classifyListing(row.title, "", row.price);
  const parsed = parseListingOptions({
    title: row.title,
    description: "",
    category: sku?.category ?? null,
    skuId: sku?.id ?? null,
    skuName: sku?.modelName ?? null,
  });
  const readiness = evaluateCategoryReadiness(parsed.category);
  const actualPublicBlocked = !readiness.canEnterPool;
  const expectedPositive = row.expectedDecision === "candidate_positive_contract";
  const pass = expectedPositive
    ? sku?.category === "speaker"
      && classified.listingType === "normal"
      && parsed.comparableKey === row.expectedComparableKey
      && parsed.needsReview === false
      && actualPublicBlocked
    : parsed.comparableKey === null || classified.listingType !== "normal" || actualPublicBlocked;
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
  publicPromotion: false,
  runtimeCatalogApply: true,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "speaker",
  lane: "speaker_portable_exact_model_internal_only",
  inputFiles: [contractPath],
  metrics: {
    rows: rows.length,
    failedRows: failedRows.length,
    internalPositiveRows: rows.filter((row) => row.category === "speaker" && row.comparableKey?.startsWith("speaker|")).length,
    poolBlockedRows: rows.filter((row) => row.canEnterPool === false).length,
  },
  rows,
  failedRows,
  conclusion: failedRows.length === 0
    ? "speaker_internal_runtime_route_passed_public_gate_closed"
    : "speaker_internal_runtime_route_needs_review",
  nextAction: "Keep speaker internal_only; collect internal market samples before any readiness promotion.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "speaker-internal-runtime-route-latest.json");
const mdPath = path.join(reportsDir, "speaker-internal-runtime-route-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Speaker Internal Runtime Route",
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

console.log(JSON.stringify({
  conclusion: report.conclusion,
  rows: report.metrics.rows,
  failedRows: report.metrics.failedRows,
  internalPositiveRows: report.metrics.internalPositiveRows,
  poolBlockedRows: report.metrics.poolBlockedRows,
  jsonPath,
  mdPath,
}, null, 2));
