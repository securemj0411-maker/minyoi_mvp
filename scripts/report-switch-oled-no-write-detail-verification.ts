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
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-switch_oled_wave1-latest.json");

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

function switchOledDetailReasons(text: string, skuId: string | null) {
  const normalized = norm(text);
  const reasons: string[] = [];
  if (!/(닌텐도|nintendo|스위치|switch)/i.test(normalized)) reasons.push("missing_switch_context");
  if (!/(oled|올레드)/i.test(normalized)) reasons.push("missing_oled_context");
  if (/(스위치\s*2|스위치2|switch\s*2|switch2|라이트|\blite\b|switchlite|스위치\s*라이트|일반\s*스위치|구형\s*스위치|스위치\s*v1|\bps5\b|\bps4\b|플스\s*[45]|플레이스테이션\s*[45])/i.test(normalized)) {
    reasons.push("switch_wrong_model_or_platform_signal");
  }
  if (/(컨트롤러\s*만|조이콘\s*만|프로콘\s*만|프로\s*컨트롤러\s*만|충전기\s*만|케이스\s*만|독\s*만|거치대\s*만|스탠드\s*만|보호\s*필름\s*만|하우징|스킨\s*만)/i.test(normalized)) {
    reasons.push("switch_accessory_only_signal");
  }
  if (/(게임\s*만|게임\s*팩|게임\s*카드|게임\s*소프트만|타이틀\s*만|기프트|gift\s*card|eshop|이샵\s*카드|닌텐도\s*카드)/i.test(normalized)) {
    reasons.push("switch_game_or_code_only_signal");
  }
  if (/(게임|타이틀|칩|팩|조이콘\s*2|프로콘|파우치|케이스|필름|주변기기|일괄|\+\s*(?:게임|타이틀|칩|팩|조이콘|프로콘|파우치|케이스))/i.test(normalized)) {
    reasons.push("switch_bundle_price_review");
  }
  if (/(매입|삽니다|구해요|구합니다|구매\s*합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(부품\s*용|부품용|부품\s*만|고장|불량\s*품|파손\s*품|액정\s*파손|밴|커펌)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (skuId && skuId !== "switch-oled") reasons.push("non_switch_oled_sku");
  return [...new Set(reasons)];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = intArg("limit", 20, 1, 30);
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as SampleReport;
  const inputRows = (source.rows ?? []).filter((row) => row.decision !== "hold").slice(0, limit);
  const rows = [];

  for (const row of inputRows) {
    await sleep(120);
    const detail = await fetchDetail(String(row.pid));
    const description = detail?.description ?? "";
    const text = `${row.title}\n${description}`;
    const classified = classifyListing(row.title, description, row.price);
    const sku = classified.sku ?? ruleMatch(row.title, description);
    const parsed = parseListingOptions({
      title: row.title,
      description,
      category: sku?.category ?? "game_console",
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
      ...switchOledDetailReasons(text, sku?.id ?? row.skuId),
    ];
    const activeClean =
      Boolean(detail) &&
      !sold &&
      classified.listingType === "normal" &&
      Boolean(parsed.comparableKey) &&
      !parsed.needsReview &&
      reasons.length === 0;
    const exactButBundleReview =
      Boolean(detail) &&
      !sold &&
      Boolean(parsed.comparableKey) &&
      reasons.length === 1 &&
      reasons[0] === "switch_bundle_price_review";
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
      exactButBundleReview,
      reasons,
      descriptionPreview: description.slice(0, 180),
    });
  }

  const activeCleanRows = rows.filter((row) => row.activeClean);
  const bundleReviewRows = rows.filter((row) => row.exactButBundleReview);
  const output = {
    generatedAt: new Date().toISOString(),
    source: "reports/exact-acquisition-no-write-sample-switch_oled_wave1-latest.json",
    scope: "switch_oled_no_write_detail_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: inputRows.length,
    detailFetched: rows.filter((row) => row.detailFetched).length,
    activeClean: activeCleanRows.length,
    bundlePriceReview: bundleReviewRows.length,
    holdOrReview: rows.length - activeCleanRows.length,
    rows,
    decision:
      activeCleanRows.length >= 8
        ? "Nintendo Switch OLED has enough no-write active clean detail rows for owner-reviewed tiny acquisition design. Bundle rows remain review-only."
        : activeCleanRows.length >= 4
          ? "Nintendo Switch OLED is promising but thin; keep no-write and run another fresh detail wave before acquisition design."
          : "Nintendo Switch OLED is not ready; live/bundle/accessory pressure is too high for acquisition design.",
  };

  const md = [
    "# Nintendo Switch OLED No-Write Detail Verification",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- inputRows: ${output.inputRows}`,
    `- detailFetched: ${output.detailFetched}`,
    `- activeClean: ${output.activeClean}`,
    `- bundlePriceReview: ${output.bundlePriceReview}`,
    `- holdOrReview: ${output.holdOrReview}`,
    "",
    "## Rows",
    "",
    "| decision | pid | price | title | comparable | reasons |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...rows.map((row) => {
      const decision = row.activeClean ? "active_clean" : row.exactButBundleReview ? "bundle_review" : "hold_or_review";
      return `| ${decision} | ${row.pid} | ${row.price} | ${row.title.replace(/\|/g, "/")} | ${row.detailComparableKey ?? "-"} | ${row.reasons.join(", ") || "-"} |`;
    }),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "switch-oled-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "switch-oled-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/switch-oled-no-write-detail-verification-latest.json");
  console.log("wrote reports/switch-oled-no-write-detail-verification-latest.md");
  console.log(
    JSON.stringify({
      inputRows: output.inputRows,
      activeClean: output.activeClean,
      bundlePriceReview: output.bundlePriceReview,
      holdOrReview: output.holdOrReview,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
