import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type DetailVerification = {
  generatedAt: string;
  inputRows: number;
  detailFetched: number;
  activeClean: number;
  holdOrReview: number;
  rows?: Array<{
    pid: string;
    title: string;
    price: number;
    searchSkuId: string | null;
    detailComparableKey: string | null;
    activeClean: boolean;
    reasons: string[];
  }>;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");
const sourcePath = path.join(reportDir, "monitor-exact-no-write-detail-verification-latest.json");

function readSource(): DetailVerification | null {
  if (!existsSync(sourcePath)) return null;
  return JSON.parse(readFileSync(sourcePath, "utf8")) as DetailVerification;
}

const source = readSource();
const activeRows = (source?.rows ?? []).filter((row) => row.activeClean);
const reviewRows = (source?.rows ?? []).filter((row) => !row.activeClean);
const maxWriteCap = Math.min(8, activeRows.length);

const output = {
  generatedAt: new Date().toISOString(),
  scope: "monitor_exact_model_code_tiny_acquisition_design_review_only",
  source: "reports/monitor-exact-no-write-detail-verification-latest.json",
  runtimeMutation: false,
  supabaseMutation: false,
  publicPromotion: false,
  candidatePoolWiring: false,
  proposedFutureWriteCap: maxWriteCap,
  activeCleanRows: activeRows.length,
  holdOrReviewRows: reviewRows.length,
  proposedRows: activeRows.slice(0, maxWriteCap).map((row) => ({
    pid: row.pid,
    title: row.title,
    price: row.price,
    skuId: row.searchSkuId,
    comparableKey: row.detailComparableKey,
  })),
  excludedRows: reviewRows.map((row) => ({
    pid: row.pid,
    title: row.title,
    reasons: row.reasons,
  })),
  guardrails: [
    "Only exact model-code SKUs from the verified row list may be considered.",
    "No broad monitor_discovered promotion.",
    "Fresh detail refetch is required immediately before any future DB write.",
    "saleStatus must be SELLING and sold-out signals must be empty.",
    "listingType must remain normal after detail description replay.",
    "comparableKey must stay stable between search-scope and detail-scope parsing.",
    "Multi-quantity price rows stay hold unless manually normalized.",
    "Monitor arm/accessory/parts/PC-set/TV-monitor hybrid rows stay hold.",
    "Write cap for first owner-approved acquisition should be <= proposedFutureWriteCap.",
    "Candidate pool/public promotion remains closed after acquisition unless separately approved.",
  ],
  ownerDecisionsRequired: [
    "Approve or reject a future DB write cap for the active clean exact model-code rows.",
    "Decide whether false-hold rows caused by listing_type_multi/listing_type_parts deserve manual review, not automatic promotion.",
    "Decide whether acquired monitor rows stay internal-only for market learning or can enter a later staged candidate-pool experiment.",
  ],
  decision:
    activeRows.length >= 8
      ? "Ready for owner review of a tiny no-write-to-write acquisition plan, but not ready for automatic DB write or public promotion."
      : "Not enough active clean rows; run another no-write detail wave before any acquisition plan.",
};

const md = [
  "# Monitor Exact Tiny Acquisition Design",
  "",
  `- generatedAt: ${output.generatedAt}`,
  `- scope: ${output.scope}`,
  "- runtimeMutation/supabaseMutation/publicPromotion/candidatePoolWiring: false/false/false/false",
  `- proposedFutureWriteCap: ${output.proposedFutureWriteCap}`,
  `- activeCleanRows: ${output.activeCleanRows}`,
  `- holdOrReviewRows: ${output.holdOrReviewRows}`,
  "",
  "## Proposed Rows",
  "",
  "| pid | price | sku | comparable | title |",
  "| --- | ---: | --- | --- | --- |",
  ...output.proposedRows.map((row) => `| ${row.pid} | ${row.price} | ${row.skuId ?? "-"} | ${row.comparableKey ?? "-"} | ${row.title.replace(/\|/g, "/")} |`),
  "",
  "## Excluded Rows",
  "",
  "| pid | title | reasons |",
  "| --- | --- | --- |",
  ...output.excludedRows.map((row) => `| ${row.pid} | ${row.title.replace(/\|/g, "/")} | ${row.reasons.join(", ") || "-"} |`),
  "",
  "## Guardrails",
  "",
  ...output.guardrails.map((item) => `- ${item}`),
  "",
  "## Owner Decisions Required",
  "",
  ...output.ownerDecisionsRequired.map((item) => `- ${item}`),
  "",
  "## Decision",
  "",
  `- ${output.decision}`,
  "",
].join("\n");

writeFileSync(path.join(reportDir, "monitor-exact-tiny-acquisition-design-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(path.join(reportDir, "monitor-exact-tiny-acquisition-design-latest.md"), md);

console.log("wrote reports/monitor-exact-tiny-acquisition-design-latest.json");
console.log("wrote reports/monitor-exact-tiny-acquisition-design-latest.md");
console.log(JSON.stringify({ proposedFutureWriteCap: output.proposedFutureWriteCap, activeCleanRows: output.activeCleanRows }));
