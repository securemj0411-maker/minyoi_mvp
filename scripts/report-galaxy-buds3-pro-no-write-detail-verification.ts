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
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-galaxy_buds_3_pro_wave1-latest.json");

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

function galaxyBuds3ProDetailReasons(title: string, description: string, skuId: string | null) {
  const normalized = norm(`${title}\n${description}`);
  const reasons: string[] = [];
  if (!/(갤럭시\s*버즈|갤럭시버즈|갤버즈|galaxy\s*buds|buds)/i.test(normalized)) reasons.push("missing_galaxy_buds_context");
  if (!/(3\s*프로|3프로|3\s*pro|buds\s*3\s*pro|buds3\s*pro|버즈\s*3\s*프로)/i.test(normalized)) reasons.push("missing_buds3_pro_context");
  if (/(버즈\s*2\s*프로|버즈2\s*프로|버즈2프로|buds\s*2\s*pro|buds2\s*pro|buds2pro|버즈\s*2\b|버즈2\b|buds\s*2\b|buds2\b|버즈\s*fe|버즈fe|buds\s*fe|라이브|live|버즈\s*\+|버즈\+|plus)/i.test(normalized)) {
    reasons.push("galaxy_buds_wrong_model_signal");
  }
  if (/(왼쪽|오른쪽|좌측|우측|한쪽|편쪽|유닛|이어버드\s*단품|낱개|본체\s*충전케이스|충전\s*본체|충전케이스|케이스\s*만|케이스\s*단품|파우치|커버|이어\s*팁|이어팁|팁\s*만|크래들\s*만)/i.test(normalized)) {
    reasons.push("galaxy_buds_parts_or_accessory_signal");
  }
  if (/(삽니다|매입|구합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(가품|짝퉁|레플|복제품|고장|파손|불량|소리\s*안|작동\s*안|부품용)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (skuId && skuId !== "galaxy-buds-3-pro") reasons.push("non_galaxy_buds_3_pro_sku");
  return [...new Set(reasons)];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = intArg("limit", 24, 1, 40);
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as SampleReport;
  const inputRows = (source.rows ?? []).filter((row) => row.decision !== "hold" && row.skuId === "galaxy-buds-3-pro").slice(0, limit);
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
      ...galaxyBuds3ProDetailReasons(row.title, description, sku?.id ?? row.skuId),
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
    source: "reports/exact-acquisition-no-write-sample-galaxy_buds_3_pro_wave1-latest.json",
    scope: "galaxy_buds3_pro_no_write_detail_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: inputRows.length,
    detailFetched: rows.filter((row) => row.detailFetched).length,
    activeClean: activeCleanRows.length,
    holdOrReview: rows.length - activeCleanRows.length,
    rows,
    decision:
      activeCleanRows.length >= 6
        ? "Galaxy Buds3 Pro has enough no-write active clean detail rows for owner-reviewed tiny acquisition design. Single-unit/case rows remain excluded."
        : "Galaxy Buds3 Pro remains parts/live pressured; keep no-write and gather another fresh full-set wave before acquisition design.",
  };

  const md = [
    "# Galaxy Buds3 Pro No-Write Detail Verification",
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
  await writeFile(path.join(reportDir, "galaxy-buds3-pro-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "galaxy-buds3-pro-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/galaxy-buds3-pro-no-write-detail-verification-latest.json");
  console.log("wrote reports/galaxy-buds3-pro-no-write-detail-verification-latest.md");
  console.log(JSON.stringify({ inputRows: output.inputRows, activeClean: output.activeClean, holdOrReview: output.holdOrReview }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
