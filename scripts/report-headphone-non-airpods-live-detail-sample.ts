import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const sourcePath = path.join(reportsDir, "headphone-non-airpods-live-search-scope-latest.json");

const ACTIVE_SALE_STATUSES = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);
const MAX_PER_SKU = 5;
const MAX_DETAIL_ROWS = 60;
const DETAIL_DELAY_MS = 140;

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

type SourceRow = {
  pid: number;
  title: string;
  price: number;
  query: string;
  runtimeSkuId: string | null;
  ruleMatchSkuId: string | null;
  comparableKey: string | null;
};

type SourceReport = {
  candidateRows: SourceRow[];
};

type DetailDecision = "still_candidate" | "downgraded_manual_review" | "downgraded_hold" | "detail_missing";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compact(text: unknown, limit = 72) {
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

function saleStatusActive(status: string) {
  const normalized = status.trim().toUpperCase();
  return normalized ? ACTIVE_SALE_STATUSES.has(normalized) : true;
}

function selectBalancedRows(rows: SourceRow[]) {
  const selected: SourceRow[] = [];
  const seenBySku = new Map<string, number>();
  for (const row of rows) {
    const sku = row.runtimeSkuId ?? row.ruleMatchSkuId ?? "unknown";
    const count = seenBySku.get(sku) ?? 0;
    if (count >= MAX_PER_SKU) continue;
    selected.push(row);
    seenBySku.set(sku, count + 1);
    if (selected.length >= MAX_DETAIL_ROWS) break;
  }
  return selected;
}

function hasHeadphoneHoldSignal(title: string, description: string) {
  const text = `${title}\n${description}`.toLowerCase();
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out/i.test(text)) return "sold_text_signal";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(text)) return "buying_intent_signal";
  if (/고장|파손|부품용|수리|작동안|불량|한쪽|유닛만/.test(text)) return "damaged_or_parts_signal";
  if (/이어버드|earbuds|earbud|버즈|buds|트루\s*와이어리스|true\s*wireless|accentum\s*open|오픈\s*이어/.test(text)) return "earbuds_not_headphone_signal";
  if (/케이스만|파우치만|이어패드|이어\s*패드|이어캡|이어\s*캡|earcap|쿠션만|헤드밴드|케이블만|충전기만|부품|소모품/.test(text)) return "accessory_or_part_only_signal";
  if (/짭|가품|레플리카|이미테이션|호환품/.test(text)) return "counterfeit_or_compatible_signal";
  return null;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourceReport;
  const sample = selectBalancedRows(source.candidateRows);

  const rows = [];
  for (const row of sample) {
    const detail = await fetchDetail(String(row.pid));
    if (!detail) {
      rows.push({
        ...row,
        saleStatus: "",
        detailSkuId: null,
        detailComparableKey: null,
        detailListingType: "detail_missing",
        detailNeedsReview: true,
        detailParseConfidence: 0,
        holdSignal: "detail_missing",
        decision: "detail_missing" as DetailDecision,
        descriptionPreview: "",
      });
      await sleep(DETAIL_DELAY_MS);
      continue;
    }

    const classified = classifyListing(row.title, detail.description, row.price);
    const matchedSku = ruleMatch(row.title, detail.description);
    const sku = classified.sku ?? matchedSku;
    const parsed = parseListingOptions({
      title: row.title,
      description: detail.description,
      category: "earphone",
      skuId: sku?.id ?? null,
      skuName: sku?.modelName ?? null,
    });
    const skuId = sku?.id ?? null;
    const targetSku = Boolean(skuId && TARGET_SKUS.has(skuId));
    const inactive = !saleStatusActive(detail.saleStatus);
    const holdSignal = inactive ? `inactive_sale_status:${detail.saleStatus || "missing"}` : hasHeadphoneHoldSignal(row.title, detail.description);
    let decision: DetailDecision;
    if (holdSignal || classified.listingType !== "normal" || !targetSku) {
      decision = "downgraded_hold";
    } else if (!parsed.comparableKey || parsed.needsReview || parsed.comparableKey !== row.comparableKey) {
      decision = "downgraded_manual_review";
    } else {
      decision = "still_candidate";
    }
    rows.push({
      ...row,
      saleStatus: detail.saleStatus,
      detailSkuId: skuId,
      detailComparableKey: parsed.comparableKey,
      detailListingType: classified.listingType,
      detailNeedsReview: parsed.needsReview,
      detailParseConfidence: parsed.parseConfidence,
      holdSignal,
      decision,
      descriptionPreview: compact(detail.description, 180),
    });
    await sleep(DETAIL_DELAY_MS);
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.decision] = (acc[row.decision] ?? 0) + 1;
    return acc;
  }, {});
  const downgradedRows = rows.filter((row) => row.decision !== "still_candidate");
  const stillRows = rows.filter((row) => row.decision === "still_candidate");
  const stillBySku = stillRows.reduce<Record<string, number>>((acc, row) => {
    const sku = row.detailSkuId ?? "unknown";
    acc[sku] = (acc[sku] ?? 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt,
    reportOnly: true,
    liveDetailNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-non-airpods-live-search-scope-latest.json",
    metrics: {
      sampledCandidateRows: rows.length,
      stillCandidateRows: counts.still_candidate ?? 0,
      downgradedManualReviewRows: counts.downgraded_manual_review ?? 0,
      downgradedHoldRows: counts.downgraded_hold ?? 0,
      detailMissingRows: counts.detail_missing ?? 0,
      downgradeRate: rows.length ? Number((downgradedRows.length / rows.length).toFixed(3)) : 0,
      stillCandidateSkus: Object.keys(stillBySku).length,
    },
    byDecision: counts,
    stillBySku,
    rows,
    downgradedRows,
    conclusion: Object.keys(stillBySku).length >= 6 && (counts.still_candidate ?? 0) >= 24
      ? "headphone_non_airpods_detail_sample_supports_tiny_no_write_acquisition_plan"
      : "headphone_non_airpods_detail_sample_needs_lane_specific_gate_review",
    nextStep: "Create lane-specific detail gate proposal before any DB write or public promotion.",
  };

  const jsonPath = path.join(reportsDir, "headphone-non-airpods-live-detail-sample-latest.json");
  const mdPath = path.join(reportsDir, "headphone-non-airpods-live-detail-sample-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Non-AirPods Live Detail Sample",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveDetailNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- sampledCandidateRows: ${report.metrics.sampledCandidateRows}`,
    `- stillCandidateRows: ${report.metrics.stillCandidateRows}`,
    `- downgradedManualReviewRows: ${report.metrics.downgradedManualReviewRows}`,
    `- downgradedHoldRows: ${report.metrics.downgradedHoldRows}`,
    `- detailMissingRows: ${report.metrics.detailMissingRows}`,
    `- downgradeRate: ${report.metrics.downgradeRate}`,
    `- stillCandidateSkus: ${report.metrics.stillCandidateSkus}`,
    "",
    "## Still Candidate by SKU",
    "",
    mdTable(["sku", "count"], Object.entries(stillBySku)),
    "",
    "## Downgraded Rows",
    "",
    downgradedRows.length
      ? mdTable(
          ["pid", "title", "price", "fromKey", "toKey", "decision", "holdSignal"],
          downgradedRows.slice(0, 80).map((row) => [
            row.pid,
            compact(row.title),
            row.price,
            row.comparableKey ?? "",
            row.detailComparableKey ?? "",
            row.decision,
            row.holdSignal ?? "",
          ]),
        )
      : "- none",
    "",
    "## Still Candidate Sample",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key", "saleStatus"],
      stillRows.slice(0, 80).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.detailSkuId ?? "",
        row.detailComparableKey ?? "",
        row.saleStatus,
      ]),
    ),
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
        sampledCandidateRows: rows.length,
        stillCandidateRows: report.metrics.stillCandidateRows,
        downgradedRows: downgradedRows.length,
        stillCandidateSkus: report.metrics.stillCandidateSkus,
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
