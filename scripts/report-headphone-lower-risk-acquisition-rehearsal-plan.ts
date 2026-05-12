import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const sourcePath = path.join(reportsDir, "headphone-non-airpods-tiny-acquisition-rehearsal-plan-latest.json");

const LOWER_RISK_SKUS = new Set([
  "sony-wh-1000xm5",
  "sony-wh-1000xm4",
  "sony-wh-1000xm3",
  "sony-wh-1000xm6",
  "sony-wh-ch520",
  "sony-wh-ult900n",
  "bose-qc45",
]);

const FIRST_WAVE_SKUS = new Set([
  "sony-wh-1000xm4",
  "sony-wh-ch520",
  "bose-qc45",
]);

const OPTIONAL_WAVE_SKUS = new Set(["sony-wh-ult900n"]);

type SourcePlan = {
  payloadDraft: Array<{
    pid: number;
    title: string;
    price: number;
    skuId: string | null;
    comparableKey: string | null;
    saleStatus: string;
    laneRisk: "standard" | "strict";
    requiredPreWriteChecks: string[];
  }>;
};

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 84) {
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

function rowExtraRisk(title: string) {
  const text = title.toLowerCase();
  const risks = [
    /미개봉|새상품|새거|신품/.test(text) ? "new_or_unopened_condition" : null,
    /케이스\s*포함|\+\s*케이스|파우치|풀박/.test(text) ? "included_accessory_or_fullbox_price_context" : null,
    /교환|추금/.test(text) ? "trade_or_exchange_context" : null,
    /깨끗|생활감|실착|사용감/.test(text) ? "condition_wording_present" : null,
  ].filter((risk): risk is string => Boolean(risk));
  return risks;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourcePlan;
  const lowerRiskRows = source.payloadDraft
    .filter((row) => row.skuId && LOWER_RISK_SKUS.has(row.skuId))
    .map((row) => ({ ...row, extraReviewFlags: rowExtraRisk(row.title) }));
  const firstWaveRows = lowerRiskRows.filter((row) => row.skuId && FIRST_WAVE_SKUS.has(row.skuId));
  const optionalWaveRows = lowerRiskRows.filter((row) => row.skuId && OPTIONAL_WAVE_SKUS.has(row.skuId));
  const deferredLowerRiskRows = lowerRiskRows.filter(
    (row) => !row.skuId || (!FIRST_WAVE_SKUS.has(row.skuId) && !OPTIONAL_WAVE_SKUS.has(row.skuId)),
  );
  const cleanestRows = lowerRiskRows.filter((row) => row.extraReviewFlags.length === 0);
  const reviewRows = lowerRiskRows.filter((row) => row.extraReviewFlags.length > 0);
  const cappedRows = firstWaveRows.slice(0, 12);

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-tiny-acquisition-rehearsal-plan-latest.json",
    lane: "non_airpods_headphone_lower_risk_first_rehearsal",
    metrics: {
      sourcePayloadRows: source.payloadDraft.length,
      lowerRiskRows: lowerRiskRows.length,
      lowerRiskSkus: Object.keys(countBy(lowerRiskRows, (row) => row.skuId ?? "unknown")).length,
      firstWaveRows: firstWaveRows.length,
      firstWaveSkus: Object.keys(countBy(firstWaveRows, (row) => row.skuId ?? "unknown")).length,
      optionalWaveRows: optionalWaveRows.length,
      deferredLowerRiskRows: deferredLowerRiskRows.length,
      cleanestRows: cleanestRows.length,
      reviewRows: reviewRows.length,
      proposedNoWriteCap: cappedRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
      dbMutationRows: 0,
    },
    lowerRiskSkus: [...LOWER_RISK_SKUS],
    firstWaveSkus: [...FIRST_WAVE_SKUS],
    optionalWaveSkus: [...OPTIONAL_WAVE_SKUS],
    bySku: countBy(lowerRiskRows, (row) => row.skuId ?? "unknown"),
    firstWaveBySku: countBy(firstWaveRows, (row) => row.skuId ?? "unknown"),
    byExtraReviewFlag: countBy(reviewRows.flatMap((row) => row.extraReviewFlags), (flag) => flag),
    proposedNoWriteRows: cappedRows,
    optionalWaveRows,
    deferredLowerRiskRows,
    excludedStrictRows: source.payloadDraft.filter((row) => !row.skuId || !LOWER_RISK_SKUS.has(row.skuId)).map((row) => ({
      pid: row.pid,
      title: row.title,
      skuId: row.skuId,
      reason: "strict_lane_or_not_in_lower_risk_first_wave",
    })),
    requiredBeforeAnyWrite: [
      "fresh_detail_refetch",
      "sale_status_still_selling",
      "same_target_sku",
      "same_comparable_key",
      "no_buying_sold_reserved_text",
      "no_parts_accessory_cable_pad_earcap_damage_text",
      "no_counterfeit_or_compatible_text",
      "manual_review_any_extraReviewFlags_before_write",
    ],
    conclusion: cappedRows.length >= 10
      ? "headphone_first_wave_no_write_rehearsal_subset_ready"
      : "headphone_first_wave_no_write_rehearsal_needs_more_rows",
    nextStep: "Use only firstWaveSkus for the first non-AirPods headphone no-write rehearsal; keep optional/deferred lanes out until separately revalidated.",
  };

  const jsonPath = path.join(reportsDir, "headphone-lower-risk-acquisition-rehearsal-plan-latest.json");
  const mdPath = path.join(reportsDir, "headphone-lower-risk-acquisition-rehearsal-plan-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Lower-Risk Acquisition Rehearsal Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- sourcePayloadRows: ${report.metrics.sourcePayloadRows}`,
    `- lowerRiskRows: ${report.metrics.lowerRiskRows}`,
    `- lowerRiskSkus: ${report.metrics.lowerRiskSkus}`,
    `- firstWaveRows: ${report.metrics.firstWaveRows}`,
    `- firstWaveSkus: ${report.metrics.firstWaveSkus}`,
    `- optionalWaveRows: ${report.metrics.optionalWaveRows}`,
    `- deferredLowerRiskRows: ${report.metrics.deferredLowerRiskRows}`,
    `- cleanestRows: ${report.metrics.cleanestRows}`,
    `- reviewRows: ${report.metrics.reviewRows}`,
    `- proposedNoWriteCap: ${report.metrics.proposedNoWriteCap}`,
    "",
    "## First Wave SKU Counts",
    "",
    mdTable(["sku", "count"], Object.entries(report.firstWaveBySku)),
    "",
    "## Lower-Risk SKU Counts",
    "",
    mdTable(["sku", "count"], Object.entries(report.bySku)),
    "",
    "## Extra Review Flags",
    "",
    mdTable(["flag", "count"], Object.entries(report.byExtraReviewFlag)),
    "",
    "## Proposed No-Write Rows",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key", "extraFlags"],
      cappedRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        row.comparableKey ?? "",
        row.extraReviewFlags.join(", "),
      ]),
    ),
    "",
    "## Optional Later Rows",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key", "extraFlags"],
      optionalWaveRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        row.comparableKey ?? "",
        row.extraReviewFlags.join(", "),
      ]),
    ),
    "",
    "## Deferred Lower-Risk Rows",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "reason"],
      deferredLowerRiskRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        "defer_after_first_wave_review",
      ]),
    ),
    "",
    "## Excluded Strict Rows",
    "",
    mdTable(
      ["pid", "title", "sku", "reason"],
      report.excludedStrictRows.map((row) => [row.pid, compact(row.title), row.skuId ?? "", row.reason]),
    ),
    "",
    "## Required Before Any Write",
    "",
    ...report.requiredBeforeAnyWrite.map((check) => `- ${check}`),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.conclusion,
        lowerRiskRows: report.metrics.lowerRiskRows,
        lowerRiskSkus: report.metrics.lowerRiskSkus,
        firstWaveRows: report.metrics.firstWaveRows,
        firstWaveSkus: report.metrics.firstWaveSkus,
        proposedNoWriteCap: report.metrics.proposedNoWriteCap,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
