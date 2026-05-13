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
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-ipad_pro_11_m4_256_wifi_wave1-latest.json");

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

function ipadPro11M4DetailReasons(text: string, skuId: string | null) {
  const normalized = norm(text);
  const reasons: string[] = [];
  if (!/(아이패드|ipad)/i.test(normalized) || !/(프로|pro)/i.test(normalized)) reasons.push("missing_ipad_pro_detail_context");
  if (!/(11\s*인치|11\s*형|11\"|11″|\b11\b)/i.test(normalized)) reasons.push("missing_11_detail_context");
  if (!/\bm4\b/i.test(normalized)) reasons.push("missing_m4_detail_context");
  if (!/256/.test(normalized)) reasons.push("missing_256_detail_context");
  if (!/(wifi|wi-fi|와이파이|와파|wlan)/i.test(normalized)) reasons.push("missing_wifi_detail_context");
  if (/(12\.9|13\s*인치|13\s*형|m1|m2|m3|아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini)/i.test(normalized)) reasons.push("wrong_generation_or_family_signal");
  if (/(셀룰러|cellular|\blte\b|\b5g\b|유심|esim|wi-?fi\s*\+\s*cell|\bcell\b)/i.test(normalized)) reasons.push("cellular_conflict_signal");
  if (/(512|1\s*tb|1테라|2\s*tb|2테라)/i.test(normalized)) reasons.push("wrong_storage_signal");
  if (/(매입|삽니다|구합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(액정\s*만|부품|파손|고장|침수|잠김|락걸|icloud|아이클라우드|메인보드)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (/(케이스\s*만|펜슬\s*만|애펜\s*만|키보드\s*만|매직키보드\s*만|폴리오\s*만)/i.test(normalized)) reasons.push("accessory_only_signal");
  if (/(애플\s*펜슬|애펜|pencil|매직\s*키보드|magic\s*keyboard|키보드\s*포함|펜슬\s*포함|풀박스\s*\+\s*애펜|구성품\s*포함|\+\s*(?:펜슬|키보드|케이스))/i.test(normalized)) reasons.push("bundle_price_review");
  if (skuId && skuId !== "ipad-pro-11-m4-256-wifi") reasons.push("non_ipad_pro_11_m4_256_wifi_sku");
  return [...new Set(reasons)];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = intArg("limit", 16, 1, 30);
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
      category: sku?.category ?? "tablet",
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
      ...ipadPro11M4DetailReasons(text, sku?.id ?? row.skuId),
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
      reasons[0] === "bundle_price_review";
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
    source: "reports/exact-acquisition-no-write-sample-ipad_pro_11_m4_256_wifi_wave1-latest.json",
    scope: "ipad_pro_11_m4_256_wifi_no_write_detail_verification",
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
      activeCleanRows.length >= 4
        ? "iPad Pro 11 M4 256GB Wi-Fi has enough no-write active clean detail rows for owner-reviewed tiny acquisition design. Bundle rows remain review-only."
        : "iPad Pro 11 M4 256GB Wi-Fi needs more no-write detail evidence or tighter bundle/live policy before any acquisition design.",
  };

  const md = [
    "# iPad Pro 11 M4 256GB Wi-Fi No-Write Detail Verification",
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
  await writeFile(path.join(reportDir, "ipad-pro-11-m4-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "ipad-pro-11-m4-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/ipad-pro-11-m4-no-write-detail-verification-latest.json");
  console.log("wrote reports/ipad-pro-11-m4-no-write-detail-verification-latest.md");
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
