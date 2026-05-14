// Wave 86: 시계/카메라 boost query 강제 fetch + parser/catalog 진단.
// Bunjang find_v2로 page 0~2 (288 items/query)까지 긁어와서 ruleMatch + parseListingOptions
// inline 실행. binding 비율 + needs_review + 미바인딩 sample 즉시 보고. DB INSERT X.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { ruleMatch, skuById } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// Wave 86에서 추가한 변형 query + 기존 시계/카메라 query
const BOOST_QUERIES: { query: string; targetSkuId: string; family: "watch" | "camera" }[] = [
  // 시계 G-Shock
  { query: "지샥 GA-2100", targetSkuId: "watch-casio-gshock-ga2100", family: "watch" },
  { query: "카시오크", targetSkuId: "watch-casio-gshock-ga2100", family: "watch" },
  { query: "지얄오크", targetSkuId: "watch-casio-gshock-ga2100", family: "watch" },
  { query: "지샥 DW-5600", targetSkuId: "watch-casio-gshock-dw5600", family: "watch" },
  { query: "DW-5600BB", targetSkuId: "watch-casio-gshock-dw5600", family: "watch" },
  { query: "DW5600 풀박스", targetSkuId: "watch-casio-gshock-dw5600", family: "watch" },
  { query: "지샥 풀메탈 5000", targetSkuId: "watch-casio-gshock-gmwb5000", family: "watch" },
  { query: "GMW-B5000", targetSkuId: "watch-casio-gshock-gmwb5000", family: "watch" },
  { query: "Seiko 5 SRPD", targetSkuId: "watch-seiko-5-sports-srpd", family: "watch" },
  { query: "세이코 5KX", targetSkuId: "watch-seiko-5-sports-srpd", family: "watch" },
  { query: "세이코 SRPD", targetSkuId: "watch-seiko-5-sports-srpd", family: "watch" },
  // 카메라
  { query: "소니 A7M3", targetSkuId: "camera-sony-a7m3", family: "camera" },
  { query: "Sony A7 III", targetSkuId: "camera-sony-a7m3", family: "camera" },
  { query: "ILCE-7M3", targetSkuId: "camera-sony-a7m3", family: "camera" },
  { query: "소니 A7C", targetSkuId: "camera-sony-a7c", family: "camera" },
  { query: "Sony A7C 바디", targetSkuId: "camera-sony-a7c", family: "camera" },
  { query: "ILCE-7C", targetSkuId: "camera-sony-a7c", family: "camera" },
  { query: "캐논 R6 Mark II", targetSkuId: "camera-canon-eos-r6-mark-ii", family: "camera" },
  { query: "EOS R6 Mark II", targetSkuId: "camera-canon-eos-r6-mark-ii", family: "camera" },
  { query: "캐논 R6M2", targetSkuId: "camera-canon-eos-r6-mark-ii", family: "camera" },
  { query: "캐논 알육막투", targetSkuId: "camera-canon-eos-r6-mark-ii", family: "camera" },
];

type QueryResult = {
  query: string;
  targetSkuId: string;
  family: "watch" | "camera";
  fetched: number;
  unique: number;
  targetBind: number;
  otherBind: number;
  noBind: number;
  parserOk: number;
  parserReview: number;
  bindPct: number;
  parserOkPct: number;
  topUnboundTitles: string[];
  topBoundOtherSku: { sku: string; count: number; sampleTitles: string[] }[];
  topReviewReasons: { reason: string; count: number; sampleTitles: string[] }[];
};

async function diagnoseQuery(query: string, targetSkuId: string, family: "watch" | "camera"): Promise<QueryResult> {
  const PAGES = 3;
  const allItems: SearchItem[] = [];
  for (let page = 0; page < PAGES; page++) {
    try {
      const items = await searchPage(query, page, { order: "date", limit: 96 });
      if (items.length === 0) break;
      allItems.push(...items);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`fetch failed ${query} page ${page}:`, err instanceof Error ? err.message : err);
    }
  }
  const uniquePids = new Map<string, SearchItem>();
  for (const item of allItems) uniquePids.set(item.pid, item);
  const items = Array.from(uniquePids.values());

  let targetBind = 0;
  let otherBind = 0;
  let noBind = 0;
  let parserOk = 0;
  let parserReview = 0;
  const unboundTitles: string[] = [];
  const otherSkuCount = new Map<string, { count: number; samples: string[] }>();
  const reviewReasons = new Map<string, { count: number; samples: string[] }>();

  for (const item of items) {
    const sku = ruleMatch(item.name, "");
    if (sku) {
      if (sku.id === targetSkuId) {
        targetBind += 1;
        // run option parser on target-bound items
        try {
          const parsed = parseListingOptions({
            title: item.name,
            description: "",
            skuId: sku.id,
            skuName: sku.modelName,
            category: sku.category,
          });
          if (parsed.needsReview) {
            parserReview += 1;
            const reason = parsed.unknownParts?.join(",") || "needs_review";
            const entry = reviewReasons.get(reason) ?? { count: 0, samples: [] };
            entry.count += 1;
            if (entry.samples.length < 3) entry.samples.push(item.name.slice(0, 60));
            reviewReasons.set(reason, entry);
          } else {
            parserOk += 1;
          }
        } catch {
          parserReview += 1;
        }
      } else {
        otherBind += 1;
        const entry = otherSkuCount.get(sku.id) ?? { count: 0, samples: [] };
        entry.count += 1;
        if (entry.samples.length < 3) entry.samples.push(item.name.slice(0, 60));
        otherSkuCount.set(sku.id, entry);
      }
    } else {
      noBind += 1;
      if (unboundTitles.length < 8) unboundTitles.push(item.name.slice(0, 70));
    }
  }

  const topBoundOtherSku = Array.from(otherSkuCount.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([sku, { count, samples }]) => ({ sku, count, sampleTitles: samples }));
  const topReviewReasons = Array.from(reviewReasons.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([reason, { count, samples }]) => ({ reason, count, sampleTitles: samples }));

  return {
    query,
    targetSkuId,
    family,
    fetched: allItems.length,
    unique: items.length,
    targetBind,
    otherBind,
    noBind,
    parserOk,
    parserReview,
    bindPct: items.length > 0 ? Math.round((targetBind / items.length) * 100) : 0,
    parserOkPct: targetBind > 0 ? Math.round((parserOk / targetBind) * 100) : 0,
    topUnboundTitles: unboundTitles,
    topBoundOtherSku,
    topReviewReasons,
  };
}

async function main() {
  const results: QueryResult[] = [];
  for (const { query, targetSkuId, family } of BOOST_QUERIES) {
    process.stdout.write(`fetch: "${query}" → ${targetSkuId} ... `);
    const r = await diagnoseQuery(query, targetSkuId, family);
    results.push(r);
    console.log(`fetched=${r.fetched} unique=${r.unique} bind=${r.targetBind} (${r.bindPct}%) parserOK=${r.parserOk}/${r.targetBind} (${r.parserOkPct}%) review=${r.parserReview} noBind=${r.noBind}`);
  }

  // summary by sku
  const bySkuMap = new Map<string, QueryResult[]>();
  for (const r of results) {
    const entry = bySkuMap.get(r.targetSkuId) ?? [];
    entry.push(r);
    bySkuMap.set(r.targetSkuId, entry);
  }

  console.log("\n=== SKU 별 합계 ===");
  for (const [skuId, rs] of bySkuMap) {
    const totalUnique = rs.reduce((s, r) => s + r.unique, 0);
    const totalBind = rs.reduce((s, r) => s + r.targetBind, 0);
    const totalOk = rs.reduce((s, r) => s + r.parserOk, 0);
    const totalReview = rs.reduce((s, r) => s + r.parserReview, 0);
    const sku = skuById(skuId);
    const bindPct = totalUnique > 0 ? Math.round((totalBind / totalUnique) * 100) : 0;
    const parserPct = totalBind > 0 ? Math.round((totalOk / totalBind) * 100) : 0;
    console.log(`  ${skuId} (${sku?.modelName ?? "?"}): unique=${totalUnique} bind=${totalBind} (${bindPct}%) parserOK=${totalOk}/${totalBind} (${parserPct}%) review=${totalReview}`);
  }

  await writeFile(
    path.join(appDir, "reports/wave86-watch-camera-boost-diag-latest.json"),
    JSON.stringify({ wave: 86, measured_at: new Date().toISOString(), results }, null, 2),
  );
  console.log("\n→ reports/wave86-watch-camera-boost-diag-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
