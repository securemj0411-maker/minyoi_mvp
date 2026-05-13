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
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-jbl_flip6_wave1-latest.json");

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

function jblFlip6DetailReasons(title: string, description: string, skuId: string | null) {
  const normalizedTitle = norm(title);
  const normalized = norm(`${title}\n${description}`);
  const reasons: string[] = [];
  if (!/(jbl|제이비엘)/i.test(normalized)) reasons.push("missing_jbl_context");
  if (!/(flip\s*6|flip6|플립\s*6|플립6)/i.test(normalized)) reasons.push("missing_flip6_model");
  if (!/(스피커|speaker|블루투스|bluetooth|flip\s*6|flip6|플립\s*6|플립6)/i.test(normalized)) reasons.push("speaker_context_missing");
  if (/(flip\s*[1-57]|flip[1-57]|플립\s*[1-57]|플립[1-57]|go\s*[0-9]|go[0-9]|charge|차지|boombox|붐박스|clip|클립|xtreme|익스트림|partybox|파티박스|eon)/i.test(normalizedTitle)) {
    reasons.push("jbl_wrong_model_signal");
  }
  if (/(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블).{0,16}(단독|단품|만|판매|팝니다|구함|삽니다)|(?:단독|단품|만|판매|팝니다|구함|삽니다).{0,16}(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블)/i.test(normalized)) {
    reasons.push("jbl_flip6_accessory_only_signal");
  }
  if (/(렌탈|대여|임대|무선\s*마이크|마이크|노래방|karaoke|pa\s*스피커|리시버|receiver|앰프|amp|사운드바|soundbar|북쉘프|패시브\s*스피커)/i.test(normalized)) {
    reasons.push("jbl_flip6_wrong_device_or_rental_signal");
  }
  if (/(삽니다|매입|구합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(고장|파손|수리|침수|전원\s*안|충전\s*안|소리\s*안|불량|부품용)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (skuId && skuId !== "speaker-jbl-flip-6") reasons.push("non_jbl_flip6_sku");
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
    const classified = classifyListing(row.title, description, row.price);
    const sku = classified.sku ?? ruleMatch(row.title, description);
    const parsed = parseListingOptions({
      title: row.title,
      description,
      category: sku?.category ?? "speaker",
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
      ...jblFlip6DetailReasons(row.title, description, sku?.id ?? row.skuId),
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
    source: "reports/exact-acquisition-no-write-sample-jbl_flip6_wave1-latest.json",
    scope: "jbl_flip6_no_write_detail_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: inputRows.length,
    detailFetched: rows.filter((row) => row.detailFetched).length,
    activeClean: activeCleanRows.length,
    holdOrReview: rows.length - activeCleanRows.length,
    rows,
    decision:
      activeCleanRows.length >= 4
        ? "JBL Flip 6 has enough no-write active clean detail rows for owner-reviewed tiny acquisition design."
        : "JBL Flip 6 remains thin; keep no-write and gather another fresh wave before any acquisition design.",
  };

  const md = [
    "# JBL Flip 6 No-Write Detail Verification",
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
  await writeFile(path.join(reportDir, "jbl-flip6-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "jbl-flip6-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/jbl-flip6-no-write-detail-verification-latest.json");
  console.log("wrote reports/jbl-flip6-no-write-detail-verification-latest.md");
  console.log(JSON.stringify({ inputRows: output.inputRows, activeClean: output.activeClean, holdOrReview: output.holdOrReview }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
