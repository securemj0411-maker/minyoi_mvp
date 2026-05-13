// Adapter: convert bose_qc_ultra ad-hoc verification JSON → preflight-compatible
// legacy DetailReport format. no DB write, no mutation, scripts/-only.

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportDir = path.join(process.cwd(), "reports");

type BoseRow = {
  pid: string;
  title: string;
  price: number;
  skuId: string | null;
  comparableKey: string | null;
  listingType: string | null;
  searchReasons: string[];
  sold: boolean;
  detailReasons: string[];
  shopUid: string | null;
  shopProshop: boolean;
  saleStatus: string | null;
  descPreview: string;
};

type BoseVerification = {
  lane: string;
  detail: {
    fetched: number;
    fetchFailed: number;
    activeClean: number;
    sold: number;
    review: number;
  };
  rows: BoseRow[];
};

async function main() {
  await mkdir(reportDir, { recursive: true });
  const lane = "bose_qc_ultra";
  const inputPath = path.join(reportDir, `${lane}-no-write-verification-latest.json`);
  if (!existsSync(inputPath)) {
    console.warn(`SKIP ${lane}: ${inputPath} missing`);
    return;
  }
  const verification = JSON.parse(readFileSync(inputPath, "utf8")) as BoseVerification;

  const legacyRows = verification.rows.map((row) => {
    const review = row.detailReasons.length > 0;
    const isActive = row.listingType === "normal" && !row.sold && !review;
    return {
      pid: row.pid,
      title: row.title,
      price: row.price,
      saleStatus: row.saleStatus ?? (row.sold ? "SOLD_OUT" : "SELLING"),
      sold: row.sold,
      listingType: row.listingType ?? "normal",
      searchSkuId: row.skuId,
      detailSkuId: row.skuId,
      searchComparableKey: row.comparableKey,
      detailComparableKey: row.comparableKey,
      detailNeedsReview: review && !row.sold,
      activeClean: isActive,
      reasons: row.detailReasons,
    };
  });

  const activeClean = legacyRows.filter((r) => r.activeClean).length;
  const holdOrReview = legacyRows.length - activeClean;

  const legacy = {
    generatedAt: new Date().toISOString(),
    source: `reports/${lane}-no-write-verification-latest.json`,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: verification.detail.fetched,
    detailFetched: verification.detail.fetched,
    activeClean,
    holdOrReview,
    rows: legacyRows,
  };

  const jsonOut = path.join(reportDir, `${lane}-no-write-detail-verification-adapter-latest.json`);
  const mdOut = path.join(reportDir, `${lane}-no-write-detail-verification-adapter-latest.md`);
  await writeFile(jsonOut, `${JSON.stringify(legacy, null, 2)}\n`);
  await writeFile(
    mdOut,
    `# ${lane} — legacy detail verification adapter\n\n- generatedAt: ${legacy.generatedAt}\n- source: ${legacy.source}\n- adapter script: scripts/write-bose-qc-ultra-legacy-detail-adapter.ts\n- mode: read_only_no_mutation_format_adapter\n\n## Counts\n\n| metric | value |\n| --- | ---: |\n| inputRows | ${legacy.inputRows} |\n| detailFetched | ${legacy.detailFetched} |\n| activeClean (listing_type=normal && !sold && no detail reasons) | ${legacy.activeClean} |\n| holdOrReview | ${legacy.holdOrReview} |\n\n## Purpose\n\nTranslate Bose QC Ultra ad-hoc verification (\`detail.activeClean\` + \`rows[*].detailReasons\`) into preflight-compatible legacy DetailReport schema. SKU/comparable_key 직접 사용 (Bose verification은 catalog ruleMatch 기반).\n`,
  );

  console.log(`wrote ${lane}-no-write-detail-verification-adapter-latest.{json,md} (activeClean=${activeClean}/${legacyRows.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
