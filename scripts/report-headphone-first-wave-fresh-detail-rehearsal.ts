import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { describeSignals, detectSoldOut, isSoldOut } from "@/lib/sold-out";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const sourcePath = path.join(reportsDir, "headphone-lower-risk-acquisition-rehearsal-plan-latest.json");

type SourcePlan = {
  proposedNoWriteRows: Array<{
    pid: number;
    title: string;
    price: number;
    skuId: string | null;
    comparableKey: string | null;
    extraReviewFlags?: string[];
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function hardNegativeReasons(title: string, description: string) {
  const text = `${title}\n${description}`.toLowerCase();
  const checks = [
    [/삽니다|구매합니다|매입|구해요|구함|교환|추금/, "buying_or_trade_text"],
    [/판매완료|판매\s*완료|거래완료|거래\s*완료|예약중|예약\s*중|완료입니다|팔렸/, "sold_or_reserved_text"],
    [/고장|파손|수리|부품용|하자|작동\s*불|작동안|침수/, "damaged_or_parts_text"],
    [/케이스만|파우치만|패드만|이어패드|쿠션|케이블|선만|박스만|스탠드|거치대|커버|캡만|이어캡/, "accessory_only_text"],
    [/이어폰|이어버드|버즈|오픈형|오픈\s*이어|유닛|한쪽|왼쪽|오른쪽/, "not_full_headphone_text"],
    [/호환|st급|s급\s*레플|레플|이미테이션|가품|짝퉁|정품급/, "counterfeit_or_compatible_text"],
  ] as const;
  return checks.flatMap(([pattern, reason]) => (pattern.test(text) ? [reason] : []));
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourcePlan;
  const checkedRows = [];

  for (const row of source.proposedNoWriteRows) {
    await sleep(120);
    const detail = await fetchDetail(String(row.pid));
    const description = detail?.description ?? "";
    const classified = classifyListing(row.title, description, row.price);
    const matchedSku = ruleMatch(row.title, description);
    const skuId = classified.sku?.id ?? matchedSku?.id ?? null;
    const parsed = parseListingOptions({
      title: row.title,
      description,
      category: "earphone",
      skuId: row.skuId,
      skuName: row.skuId,
    });
    const soldSignals = detectSoldOut(detail, row.price, { title: row.title });
    const sold = isSoldOut(soldSignals);
    const hardNegatives = hardNegativeReasons(row.title, description);
    const pass =
      Boolean(detail) &&
      !sold &&
      classified.listingType === "normal" &&
      !parsed.needsReview &&
      skuId === row.skuId &&
      parsed.comparableKey === row.comparableKey &&
      hardNegatives.length === 0;

    checkedRows.push({
      ...row,
      detailFetched: Boolean(detail),
      saleStatus: detail?.saleStatus ?? null,
      detectedSold: sold,
      soldSignalSummary: describeSignals(soldSignals),
      runtimeListingType: classified.listingType,
      runtimeSkuId: skuId,
      runtimeComparableKey: parsed.comparableKey,
      runtimeNeedsReview: parsed.needsReview,
      hardNegatives,
      pass,
      failReasons: [
        !detail ? "detail_missing" : null,
        sold ? "sold_or_inactive" : null,
        classified.listingType !== "normal" ? `listing_type_${classified.listingType}` : null,
        parsed.needsReview ? "needs_review" : null,
        skuId !== row.skuId ? "sku_changed" : null,
        parsed.comparableKey !== row.comparableKey ? "comparable_key_changed" : null,
        ...hardNegatives,
      ].filter((reason): reason is string => Boolean(reason)),
    });
  }

  const passingRows = checkedRows.filter((row) => row.pass);
  const failingRows = checkedRows.filter((row) => !row.pass);
  const report = {
    generatedAt,
    reportOnly: true,
    liveDetailReadOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    sourceReport: "reports/headphone-lower-risk-acquisition-rehearsal-plan-latest.json",
    lane: "non_airpods_headphone_first_wave_fresh_detail_rehearsal",
    metrics: {
      sourceRows: source.proposedNoWriteRows.length,
      checkedRows: checkedRows.length,
      passingRows: passingRows.length,
      failingRows: failingRows.length,
      passRate: passingRows.length / Math.max(1, checkedRows.length),
      candidatePoolWrites: 0,
      rawWrites: 0,
      parsedWrites: 0,
      publicPromotionRows: 0,
    },
    passBySku: countBy(passingRows, (row) => row.skuId ?? "unknown"),
    failByReason: countBy(failingRows.flatMap((row) => row.failReasons), (reason) => reason),
    passingRows,
    failingRows,
    conclusion: passingRows.length >= 8 && failingRows.length <= 4
      ? "headphone_first_wave_fresh_detail_rehearsal_passed_for_no_write"
      : "headphone_first_wave_fresh_detail_rehearsal_needs_more_filtering",
    nextStep:
      "Keep this as no-write evidence only; any future acquisition must re-run the same fresh detail gates immediately before a tiny capped write.",
  };

  const jsonPath = path.join(reportsDir, "headphone-first-wave-fresh-detail-rehearsal-latest.json");
  const mdPath = path.join(reportsDir, "headphone-first-wave-fresh-detail-rehearsal-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone First-Wave Fresh Detail Rehearsal",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveDetailReadOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- sourceRows: ${report.metrics.sourceRows}`,
    `- checkedRows: ${report.metrics.checkedRows}`,
    `- passingRows: ${report.metrics.passingRows}`,
    `- failingRows: ${report.metrics.failingRows}`,
    `- passRate: ${(report.metrics.passRate * 100).toFixed(1)}%`,
    `- candidatePoolWrites: ${report.metrics.candidatePoolWrites}`,
    `- rawWrites: ${report.metrics.rawWrites}`,
    `- parsedWrites: ${report.metrics.parsedWrites}`,
    "",
    "## Pass By SKU",
    "",
    mdTable(["sku", "count"], Object.entries(report.passBySku)),
    "",
    "## Fail By Reason",
    "",
    mdTable(["reason", "count"], Object.entries(report.failByReason)),
    "",
    "## Passing Rows",
    "",
    mdTable(
      ["pid", "title", "price", "sku", "key", "saleStatus"],
      passingRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.skuId ?? "",
        row.comparableKey ?? "",
        row.saleStatus ?? "",
      ]),
    ),
    "",
    "## Failing Rows",
    "",
    failingRows.length
      ? mdTable(
          ["pid", "title", "price", "sku", "saleStatus", "failReasons"],
          failingRows.map((row) => [
            row.pid,
            compact(row.title),
            row.price,
            row.skuId ?? "",
            row.saleStatus ?? "",
            row.failReasons.join(", "),
          ]),
        )
      : "- none",
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
        checkedRows: report.metrics.checkedRows,
        passingRows: report.metrics.passingRows,
        failingRows: report.metrics.failingRows,
        passRate: report.metrics.passRate,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

void main();
