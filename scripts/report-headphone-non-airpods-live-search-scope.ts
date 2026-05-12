import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectSearchItems } from "@/lib/bunjang";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const QUERIES = [
  "소니 xm5 헤드폰",
  "소니 xm4 헤드폰",
  "소니 xm3 헤드폰",
  "소니 xm6 헤드폰",
  "소니 wh-1000xm5",
  "소니 wh-1000xm4",
  "소니 wh-1000xm3",
  "소니 wh-1000xm6",
  "소니 ch720n",
  "소니 ch520",
  "소니 ult wear",
  "보스 qc 울트라 헤드폰",
  "보스 qc45 헤드폰",
  "bose qc ultra",
  "bose qc45",
  "비츠 솔로4 헤드폰",
  "beats solo4",
  "젠하이저 accentum",
  "젠하이저 hd569",
];

const TARGET_SKUS = new Set([
  "sony-wh-1000xm5",
  "sony-wh-1000xm4",
  "sony-wh-1000xm3",
  "sony-wh-1000xm6",
  "sony-wh-ult900n",
  "sony-wh-ch720n",
  "sony-wh-ch520",
  "bose-qc-ultra",
  "bose-qc45",
  "beats-solo4",
  "sennheiser-accentum",
  "sennheiser-hd569",
]);

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 64) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const items = [...(await collectSearchItems(QUERIES, 2, 120)).values()];
  const rows = items.map((item) => {
    const classified = classifyListing(item.name, "", item.price);
    const matchedSku = ruleMatch(item.name, "");
    const sku = classified.sku ?? matchedSku;
    const parsed = parseListingOptions({
      title: item.name,
      description: "",
      category: "earphone",
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
    });
    const skuId = classified.sku?.id ?? matchedSku?.id ?? null;
    const targetSku = Boolean(skuId && TARGET_SKUS.has(skuId));
    const decision = targetSku && classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview
      ? "candidate_positive"
      : targetSku && classified.listingType === "normal"
        ? "manual_review"
        : targetSku
          ? "negative_hold"
          : "out_of_scope";
    return {
      pid: Number(item.pid),
      title: item.name,
      price: item.price,
      query: item.query,
      url: item.url,
      runtimeListingType: classified.listingType,
      runtimeSkuId: classified.sku?.id ?? null,
      ruleMatchSkuId: matchedSku?.id ?? null,
      comparableKey: parsed.comparableKey,
      needsReview: parsed.needsReview,
      parseConfidence: parsed.parseConfidence,
      decision,
      targetSku,
    };
  });
  const candidateRows = rows.filter((row) => row.decision === "candidate_positive");
  const report = {
    generatedAt,
    reportOnly: true,
    liveSearchNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    scope: "non-AirPods live Bunjang search read-only scope",
    queries: QUERIES,
    metrics: {
      liveFetchedUnique: rows.length,
      candidatePositive: candidateRows.length,
      manualReview: rows.filter((row) => row.decision === "manual_review").length,
      negativeHold: rows.filter((row) => row.decision === "negative_hold").length,
      outOfScope: rows.filter((row) => row.decision === "out_of_scope").length,
      uniqueCandidateSkus: Object.keys(countBy(candidateRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown")).length,
    },
    byDecision: countBy(rows, (row) => row.decision),
    bySku: countBy(rows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown"),
    candidateBySku: countBy(candidateRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown"),
    candidateByComparableKey: countBy(candidateRows, (row) => row.comparableKey ?? "null"),
    rows: rows.slice(0, 200),
    candidateRows,
    decision:
      candidateRows.length >= 20 && Object.keys(countBy(candidateRows, (row) => row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown")).length >= 3
        ? "non_airpods_live_search_supports_db_acquisition_or_no_mutation_scope"
        : "non_airpods_live_search_too_sparse_or_alias_gap",
    nextStep:
      candidateRows.length >= 20
        ? "Use these query lanes for a no-write detail sampling pass, then decide DB acquisition."
        : "Inspect out-of-scope titles and improve query/alias coverage before any runtime or DB acquisition.",
  };
  await writeFile(path.join(reportsDir, "headphone-non-airpods-live-search-scope-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone Non-AirPods Live Search Scope",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveSearchNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- liveFetchedUnique: ${report.metrics.liveFetchedUnique}`,
    `- candidatePositive: ${report.metrics.candidatePositive}`,
    `- manualReview: ${report.metrics.manualReview}`,
    `- negativeHold: ${report.metrics.negativeHold}`,
    `- outOfScope: ${report.metrics.outOfScope}`,
    `- uniqueCandidateSkus: ${report.metrics.uniqueCandidateSkus}`,
    "",
    "## Candidate by SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.candidateBySku)),
    "",
    "## Candidate Comparable Keys",
    "",
    mdTable(["comparableKey", "count"], Object.entries(report.candidateByComparableKey)),
    "",
    "## Candidate Sample",
    "",
    mdTable(
      ["pid", "title", "price", "query", "sku", "comparableKey", "needsReview"],
      candidateRows.slice(0, 50).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.query,
        row.runtimeSkuId ?? row.ruleMatchSkuId ?? "",
        row.comparableKey ?? "",
        row.needsReview,
      ]),
    ),
    "",
    "## Out-of-Scope Sample",
    "",
    mdTable(
      ["pid", "title", "price", "query", "listingType", "sku"],
      rows.filter((row) => row.decision === "out_of_scope").slice(0, 40).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.query,
        row.runtimeListingType,
        row.runtimeSkuId ?? row.ruleMatchSkuId ?? "",
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-non-airpods-live-search-scope-latest.md"), `${md}\n`);
  console.log(`headphone non-AirPods live scope: fetched=${rows.length}, candidate=${candidateRows.length}, skus=${report.metrics.uniqueCandidateSkus}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
