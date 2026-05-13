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
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-ps5_slim_wave1-latest.json");

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

function ps5SlimDetailReasons(text: string, skuId: string | null) {
  const normalized = norm(text);
  const reasons: string[] = [];
  if (!/(ps5|플스\s*5|플스5|플레이스테이션\s*5|playstation\s*5)/i.test(normalized)) {
    reasons.push("missing_ps5_detail_context");
  }
  if (!/(슬림|slim)/i.test(normalized)) reasons.push("missing_slim_detail_context");
  if (!/(디스크|disc|디지털|digital|cd|씨디|cd롬|cfi[-\s]?\d{4}\s*[ab]\b)/i.test(normalized)) {
    reasons.push("missing_disc_or_digital_detail_context");
  }
  if (/(프로|pro|ps5pro|ps5\s*pro|플스5\s*프로|vr|psvr|포탈|portal|스위치|switch|ps4|플스\s*4)/i.test(normalized)) {
    reasons.push("ps5_slim_wrong_model_signal");
  }
  if (/(패드\s*만|컨트롤러\s*만|듀얼센스\s*만|충전\s*거치대|충전거치대|케이스|커버|스킨|스탠드\s*만|거치대\s*만|부품|디스크\s*드라이브\s*만|ssd\s*만|ssd\s*단품)/i.test(normalized)) {
    reasons.push("ps5_slim_accessory_only_signal");
  }
  if (/(게임\s*만|타이틀\s*만|cd\s*만|소프트웨어|계정|다운로드|dl\s*코드|기프트|gift\s*card|월정액|psn\s*카드)/i.test(normalized)) {
    reasons.push("ps5_game_or_account_signal");
  }
  if (/(게임|타이틀|페르소나|스파이더맨|마일즈|레데리|듀얼센스\s*2개|컨트롤러\s*2개|패드\s*2개|\+\s*듀얼센스|\+\s*게임|\+\s*타이틀|\+\s*스탠드|\+\s*충전)/i.test(normalized)) {
    reasons.push("ps5_bundle_price_review");
  }
  if (/(삽니다|매입|구합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(고장|파손|수리|침수|전원\s*안|부팅\s*안|불량|부품용)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (skuId && !["ps5-slim-disc", "ps5-slim-digital"].includes(skuId)) {
    reasons.push("non_ps5_slim_sku");
  }
  return [...new Set(reasons)];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = intArg("limit", 20, 1, 30);
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as SampleReport;
  const inputRows = (source.rows ?? [])
    .filter((row) => row.decision !== "hold" && ["ps5-slim-disc", "ps5-slim-digital"].includes(row.skuId ?? ""))
    .slice(0, limit);
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
      ...ps5SlimDetailReasons(text, sku?.id ?? row.skuId),
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
      reasons[0] === "ps5_bundle_price_review";
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
    source: "reports/exact-acquisition-no-write-sample-ps5_slim_wave1-latest.json",
    scope: "ps5_slim_no_write_detail_verification",
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
      activeCleanRows.length >= 6
        ? "PS5 Slim has enough no-write active clean detail rows for an owner-reviewed tiny acquisition design. Bundle rows remain review-only."
        : "PS5 Slim needs more exact no-write detail evidence or a bundle normalization policy before any acquisition design.",
  };

  const md = [
    "# PS5 Slim No-Write Detail Verification",
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
  await writeFile(path.join(reportDir, "ps5-slim-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "ps5-slim-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/ps5-slim-no-write-detail-verification-latest.json");
  console.log("wrote reports/ps5-slim-no-write-detail-verification-latest.md");
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
