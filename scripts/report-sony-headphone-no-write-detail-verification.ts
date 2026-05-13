import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchDetail } from "../src/lib/bunjang";
import { ruleMatch } from "../src/lib/catalog";
import { parseListingOptions } from "../src/lib/option-parser";
import { classifyListing } from "../src/lib/pipeline";
import { describeSignals, detectSoldOut, isSoldOut } from "../src/lib/sold-out";

type SampleReport = {
  rows?: Array<{
    decision: string;
    pid: string;
    title: string;
    price: number;
    skuId: string | null;
    comparableKey: string | null;
  }>;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-sony_headphone_xm4_ch520_wave1-latest.json");
const allowedSkus = new Set(["sony-wh-1000xm4", "sony-wh-ch520"]);

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function intArg(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function norm(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function sonyHeadphoneDetailReasons(title: string, description: string, skuId: string | null) {
  const normalizedTitle = norm(title);
  const normalized = norm(`${title}\n${description}`);
  const reasons: string[] = [];
  if (!/(소니|sony)/i.test(normalized)) reasons.push("missing_sony_context");
  if (!/(wh[-\s]?1000xm4|wh1000xm4|xm4|wh[-\s]?ch520|whch520|ch520)/i.test(normalized)) reasons.push("missing_allowed_sony_model");
  if (/(xm6|xm5|xm3|ch720n|ult900n|ult\s*wear|qc45|qc\s*ultra|보스|bose|에어팟|airpods)/i.test(normalizedTitle)) reasons.push("sony_wrong_model_signal");
  if (/(이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|쿠션|케이스|파우치|커버|스탠드|거치대).{0,12}(만|단품|교체용|판매|팝니다)|(?:만|단품|교체용).{0,12}(이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|쿠션|케이스|파우치|커버|스탠드|거치대)|부품|배터리\s*교체용/i.test(normalized)) reasons.push("sony_headphone_accessory_or_parts_signal");
  if (/(삽니다|매입|구합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(고장|파손|수리|침수|전원\s*안|충전\s*안|소리\s*안|한쪽\s*안|노캔\s*안|불량|부품용)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (skuId && !allowedSkus.has(skuId)) reasons.push("non_allowed_sony_headphone_sku");
  return [...new Set(reasons)];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = intArg("limit", 20, 1, 30);
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as SampleReport;
  const inputRows = (source.rows ?? []).filter((row) => row.decision === "clean_candidate").slice(0, limit);
  const rows = [];

  for (const row of inputRows) {
    await sleep(120);
    const detail = await fetchDetail(String(row.pid));
    const description = detail?.description ?? "";
    const classified = classifyListing(row.title, description, row.price);
    const sku = classified.sku ?? ruleMatch(row.title, description);
    const parsed = parseListingOptions({
      title: row.title,
      description,
      category: sku?.category ?? "earphone",
      skuId: sku?.id ?? row.skuId,
      skuName: sku?.modelName ?? row.skuId,
    });
    const soldSignals = detail ? detectSoldOut(detail, row.price, { title: row.title }) : [];
    const sold = isSoldOut(soldSignals);
    const reasons = [
      ...(!detail ? ["detail_fetch_failed"] : []),
      ...(sold ? [`sold_${describeSignals(soldSignals)}`] : []),
      ...(classified.listingType !== "normal" ? [`listing_type_${classified.listingType}`] : []),
      ...(!parsed.comparableKey ? ["missing_detail_comparable_key"] : []),
      ...(parsed.needsReview ? ["detail_parse_needs_review"] : []),
      ...sonyHeadphoneDetailReasons(row.title, description, sku?.id ?? row.skuId),
    ];
    const activeClean =
      Boolean(detail) &&
      !sold &&
      classified.listingType === "normal" &&
      Boolean(parsed.comparableKey) &&
      !parsed.needsReview &&
      reasons.length === 0;
    rows.push({
      pid: row.pid,
      title: row.title,
      price: row.price,
      searchSkuId: row.skuId,
      searchComparableKey: row.comparableKey,
      detailFetched: Boolean(detail),
      saleStatus: detail?.saleStatus ?? null,
      conditionLabel: detail?.conditionLabel ?? null,
      sold,
      soldSignals: describeSignals(soldSignals),
      listingType: classified.listingType,
      detailSkuId: sku?.id ?? null,
      detailComparableKey: parsed.comparableKey,
      detailNeedsReview: parsed.needsReview,
      activeClean,
      reasons,
      descriptionPreview: description.slice(0, 180),
    });
  }

  const activeCleanRows = rows.filter((row) => row.activeClean);
  const output = {
    generatedAt: new Date().toISOString(),
    source: "reports/exact-acquisition-no-write-sample-sony_headphone_xm4_ch520_wave1-latest.json",
    scope: "sony_headphone_xm4_ch520_no_write_detail_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: inputRows.length,
    detailFetched: rows.filter((row) => row.detailFetched).length,
    activeClean: activeCleanRows.length,
    holdOrReview: rows.length - activeCleanRows.length,
    rows,
    decision:
      activeCleanRows.length >= 8
        ? "Sony WH-1000XM4/WH-CH520 has enough no-write active clean detail rows for owner-reviewed tiny acquisition design."
        : "Sony WH-1000XM4/WH-CH520 needs more fresh detail evidence before any acquisition design.",
  };

  const md = [
    "# Sony Headphone No-Write Detail Verification",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- inputRows: ${output.inputRows}`,
    `- detailFetched: ${output.detailFetched}`,
    `- activeClean: ${output.activeClean}`,
    `- holdOrReview: ${output.holdOrReview}`,
    "",
    "## Rows",
    "",
    "| decision | pid | price | title | comparable | reasons |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.activeClean ? "active_clean" : "hold_or_review"} | ${row.pid} | ${row.price} | ${row.title.replace(/\|/g, "/")} | ${row.detailComparableKey ?? "-"} | ${row.reasons.join(", ") || "-"} |`,
    ),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "sony-headphone-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "sony-headphone-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/sony-headphone-no-write-detail-verification-latest.json");
  console.log("wrote reports/sony-headphone-no-write-detail-verification-latest.md");
  console.log(JSON.stringify({ inputRows: output.inputRows, activeClean: output.activeClean, holdOrReview: output.holdOrReview }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
