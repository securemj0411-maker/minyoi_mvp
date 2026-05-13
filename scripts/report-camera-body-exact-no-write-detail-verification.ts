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
const sourcePath = path.join(reportDir, "exact-acquisition-no-write-sample-camera_body_exact_wave1-latest.json");

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

function cameraBodyDetailReasons(title: string, description: string, skuId: string | null) {
  const normalized = norm(`${title}\n${description}`);
  const reasons: string[] = [];
  if (!/(카메라|camera|미러리스|dslr|canon|캐논|sony|소니|nikon|니콘|fujifilm|후지|후지필름|eos|ilce)/i.test(normalized)) {
    reasons.push("missing_camera_context");
  }
  if (!/(바디|바디만|바디셋|body)/i.test(normalized)) reasons.push("missing_body_only_context");
  if (/(렌즈|lens|번들|번들킷|키트|kit|세트|풀셋|풀셋트|렌즈캡|바디캡|뒷캡|캡\s*만|스트랩\s*만|가방\s*만|케이스\s*만|삼각대|플래시|필터)/i.test(normalized)) {
    reasons.push("camera_lens_or_accessory_bundle_signal");
  }
  if (/(똑딱이|컴팩트|렌즈\s*일체형|g7x|x70|rx100|gr\s*iii|zv-1|zv1|파워샷|powershot)/i.test(normalized)) reasons.push("camera_fixed_lens_signal");
  if (/(삽니다|매입|구합니다|구매합니다)/i.test(normalized)) reasons.push("buying_signal");
  if (/(고장|파손|수리|침수|전원\s*안|셔터\s*안|초점\s*불량|불량|부품용|하자)/i.test(normalized)) reasons.push("damaged_or_parts_signal");
  if (skuId && !skuId.startsWith("camera-")) reasons.push("non_camera_sku");
  return [...new Set(reasons)];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const limit = intArg("limit", 24, 1, 40);
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as SampleReport;
  const inputRows = (source.rows ?? []).filter((row) => row.decision !== "hold" && row.skuId?.startsWith("camera-")).slice(0, limit);
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
      category: sku?.category ?? "camera",
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
      ...cameraBodyDetailReasons(row.title, description, sku?.id ?? row.skuId),
    ];
    const activeClean =
      Boolean(detail) &&
      !sold &&
      classified.listingType === "normal" &&
      Boolean(parsed.comparableKey) &&
      !parsed.needsReview &&
      reasons.length === 0;
    const exactButPackageReview =
      Boolean(detail) &&
      !sold &&
      Boolean(parsed.comparableKey) &&
      reasons.length === 1 &&
      reasons[0] === "camera_lens_or_accessory_bundle_signal";

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
      exactButPackageReview,
      reasons,
      descriptionPreview: description.slice(0, 180),
    });
  }

  const activeCleanRows = rows.filter((row) => row.activeClean);
  const packageReviewRows = rows.filter((row) => row.exactButPackageReview);
  const output = {
    generatedAt: new Date().toISOString(),
    source: "reports/exact-acquisition-no-write-sample-camera_body_exact_wave1-latest.json",
    scope: "camera_body_exact_no_write_detail_verification",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: inputRows.length,
    detailFetched: rows.filter((row) => row.detailFetched).length,
    activeClean: activeCleanRows.length,
    packageReview: packageReviewRows.length,
    holdOrReview: rows.length - activeCleanRows.length,
    rows,
    decision:
      activeCleanRows.length >= 6
        ? "Camera body-only exact model lane has enough no-write active clean detail rows for owner-reviewed tiny acquisition design. Package/lens rows remain review-only."
        : "Camera body-only exact model lane needs more fresh detail evidence or stricter package/body policy before acquisition design.",
  };

  const md = [
    "# Camera Body-Only Exact Model No-Write Detail Verification",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- inputRows: ${output.inputRows}`,
    `- detailFetched: ${output.detailFetched}`,
    `- activeClean: ${output.activeClean}`,
    `- packageReview: ${output.packageReview}`,
    `- holdOrReview: ${output.holdOrReview}`,
    "",
    "## Rows",
    "",
    "| decision | pid | price | title | comparable | reasons |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...rows.map((row) => {
      const decision = row.activeClean ? "active_clean" : row.exactButPackageReview ? "package_review" : "hold_or_review";
      return `| ${decision} | ${row.pid} | ${row.price} | ${row.title.replace(/\|/g, "/")} | ${row.detailComparableKey ?? "-"} | ${row.reasons.join(", ") || "-"} |`;
    }),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "camera-body-exact-no-write-detail-verification-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "camera-body-exact-no-write-detail-verification-latest.md"), md);
  console.log("wrote reports/camera-body-exact-no-write-detail-verification-latest.json");
  console.log("wrote reports/camera-body-exact-no-write-detail-verification-latest.md");
  console.log(
    JSON.stringify({
      inputRows: output.inputRows,
      activeClean: output.activeClean,
      packageReview: output.packageReview,
      holdOrReview: output.holdOrReview,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
