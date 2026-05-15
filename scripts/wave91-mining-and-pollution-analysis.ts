// Wave 91 mining & pollution analysis (즉시 실행 — 1주 대기 X).
// 신발/가방/자전거 106 SKU × narrow query × API fetch.
// 각 SKU별 target_bind / cross_bind / parser pass / pollution metric 측정.
// Output: SKU-level 결정 (keep / strengthen reject / drop), 카테고리 ready 가능성.
//
// 사용: npx tsx scripts/wave91-mining-and-pollution-analysis.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { ruleMatch, type Sku } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { SHOE_CATALOG } from "@/lib/generated/catalog-shoe-wave91";
import { BAG_CATALOG } from "@/lib/generated/catalog-bag-wave91";
import { BIKE_CATALOG } from "@/lib/generated/catalog-bike-wave91";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const POLLUTION_PATTERNS = {
  ad: /매입|삽니다|구합니다|최고가|매입합니다/,
  fake: /미러|짭|짝퉁|이미테이션|복각|오라리|a급|미러급|sa급/i,
  parts: /프레임만|포크만|휠셋만|안장만|박스만|더스트백만|영수증만|한짝|왼쪽\s*유닛|오른쪽\s*유닛|박스 없음/,
  damage: /파손|고장|사고|크랙|찢어짐|변색 심함|수리 필요|얼룩 심함/,
  kids: /\b(유아|아동|키즈|td|ps|키즈용)\b/i,
};

type SkuResult = {
  skuId: string;
  brand: string;
  modelName: string;
  category: string;
  primaryQuery: string;
  fetched: number;
  targetBind: number;
  crossBind: number;
  noBind: number;
  parserOk: number;
  parserReview: number;
  // Pollution
  adRows: number;
  fakeRows: number;
  partsRows: number;
  damageRows: number;
  kidsRows: number;
  bizsellerRows: number;
  // Verdict
  targetBindPct: number;
  parserOkPct: number;
  pollutionPct: number;
  verdict: "ready_candidate" | "strengthen_reject" | "data_insufficient" | "broad_noise_high";
  topCrossSkus: Array<{ skuId: string; count: number }>;
  sampleTargets: string[];
  samplePollution: string[];
};

// SKU의 primary query = 첫 번째 mustContain group의 첫 번째 keyword.
// 한국어 우선 (영어 keyword는 fallback).
function pickPrimaryQuery(sku: Sku): string {
  const firstGroup = sku.mustContain[0] ?? [];
  // 한국어가 있으면 우선
  const korean = firstGroup.find((k) => /[가-힣]/.test(k));
  return (korean ?? firstGroup[0] ?? sku.modelName).trim();
}

async function fetchSamples(query: string, pages = 2): Promise<SearchItem[]> {
  const all: SearchItem[] = [];
  for (let page = 0; page < pages; page++) {
    try {
      const items = await searchPage(query, page, { order: "date", limit: 96 });
      if (items.length === 0) break;
      all.push(...items);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`fetch fail ${query} page ${page}:`, err instanceof Error ? err.message : err);
      break;
    }
  }
  return all;
}

function analyzeSku(sku: Sku, items: SearchItem[]): SkuResult {
  const uniquePids = new Map<string, SearchItem>();
  for (const i of items) uniquePids.set(i.pid, i);
  const list = [...uniquePids.values()];

  let targetBind = 0, crossBind = 0, noBind = 0, parserOk = 0, parserReview = 0;
  let adRows = 0, fakeRows = 0, partsRows = 0, damageRows = 0, kidsRows = 0, bizsellerRows = 0;
  const crossSkus = new Map<string, number>();
  const sampleTargets: string[] = [];
  const samplePollution: string[] = [];

  for (const item of list) {
    if (POLLUTION_PATTERNS.ad.test(item.name)) {
      adRows += 1;
      if (samplePollution.length < 3) samplePollution.push(`[AD] ${item.name.slice(0, 55)}`);
    }
    if (POLLUTION_PATTERNS.fake.test(item.name)) {
      fakeRows += 1;
      if (samplePollution.length < 5) samplePollution.push(`[FAKE] ${item.name.slice(0, 55)}`);
    }
    if (POLLUTION_PATTERNS.parts.test(item.name)) partsRows += 1;
    if (POLLUTION_PATTERNS.damage.test(item.name)) damageRows += 1;
    if (POLLUTION_PATTERNS.kids.test(item.name)) kidsRows += 1;
    if (item.sellerBizseller) bizsellerRows += 1;

    const matched = ruleMatch(item.name, "");
    if (matched) {
      if (matched.id === sku.id) {
        targetBind += 1;
        if (sampleTargets.length < 3) sampleTargets.push(item.name.slice(0, 55));
        try {
          const parsed = parseListingOptions({
            title: item.name,
            description: "",
            skuId: matched.id,
            skuName: matched.modelName,
            category: matched.category,
          });
          if (parsed.needsReview) parserReview += 1;
          else parserOk += 1;
        } catch {
          parserReview += 1;
        }
      } else {
        crossBind += 1;
        crossSkus.set(matched.id, (crossSkus.get(matched.id) ?? 0) + 1);
      }
    } else {
      noBind += 1;
    }
  }

  const total = list.length;
  const targetBindPct = total > 0 ? Math.round((targetBind / total) * 1000) / 10 : 0;
  const parserOkPct = targetBind > 0 ? Math.round((parserOk / targetBind) * 1000) / 10 : 0;
  const pollutionRows = adRows + fakeRows + partsRows + damageRows + kidsRows;
  const pollutionPct = total > 0 ? Math.round((pollutionRows / total) * 1000) / 10 : 0;

  // Verdict logic
  let verdict: SkuResult["verdict"];
  if (targetBind === 0 && total < 10) verdict = "data_insufficient";
  else if (fakeRows > targetBind || pollutionPct > 50) verdict = "strengthen_reject";
  else if (targetBindPct < 5 && total > 50) verdict = "broad_noise_high";
  else verdict = "ready_candidate";

  const topCrossSkus = [...crossSkus.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skuId, count]) => ({ skuId, count }));

  return {
    skuId: sku.id, brand: sku.brand, modelName: sku.modelName, category: sku.category,
    primaryQuery: pickPrimaryQuery(sku),
    fetched: items.length, targetBind, crossBind, noBind, parserOk, parserReview,
    adRows, fakeRows, partsRows, damageRows, kidsRows, bizsellerRows,
    targetBindPct, parserOkPct, pollutionPct,
    verdict, topCrossSkus, sampleTargets, samplePollution,
  };
}

async function main() {
  console.log("Wave 91 mining + pollution analysis");
  console.log("106 SKU × narrow query × API fetch (page 0~1 = ~192 매물/SKU)\n");

  const allSkus = [...SHOE_CATALOG, ...BAG_CATALOG, ...BIKE_CATALOG];

  // Dedupe by primary query (캐시 활용)
  const queryCache = new Map<string, SearchItem[]>();
  const results: SkuResult[] = [];
  let i = 0;
  for (const sku of allSkus) {
    i += 1;
    const q = pickPrimaryQuery(sku);
    process.stdout.write(`[${String(i).padStart(3)}/${allSkus.length}] ${sku.id.padEnd(50)} q="${q.slice(0, 25)}" `);
    try {
      let items = queryCache.get(q);
      if (!items) {
        items = await fetchSamples(q, 2);
        queryCache.set(q, items);
      }
      const r = analyzeSku(sku, items);
      results.push(r);
      console.log(`f=${String(r.fetched).padStart(3)} target=${String(r.targetBind).padStart(3)}(${r.targetBindPct}%) cross=${String(r.crossBind).padStart(2)} fake=${r.fakeRows} parser=${r.parserOk}/${r.targetBind} → ${r.verdict}`);
    } catch (err) {
      console.log(`err: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 카테고리별 집계
  console.log("\n=== 카테고리별 집계 ===");
  for (const cat of ["shoe", "bag", "bike"]) {
    const catResults = results.filter((r) => r.category === cat);
    const totalFetched = catResults.reduce((s, r) => s + r.fetched, 0);
    const totalTarget = catResults.reduce((s, r) => s + r.targetBind, 0);
    const totalFake = catResults.reduce((s, r) => s + r.fakeRows, 0);
    const totalParserOk = catResults.reduce((s, r) => s + r.parserOk, 0);
    const readyCnt = catResults.filter((r) => r.verdict === "ready_candidate").length;
    const strengthenCnt = catResults.filter((r) => r.verdict === "strengthen_reject").length;
    const insufficientCnt = catResults.filter((r) => r.verdict === "data_insufficient").length;
    const noiseCnt = catResults.filter((r) => r.verdict === "broad_noise_high").length;
    console.log(`${cat}: ${catResults.length} SKU | fetched ${totalFetched} | target ${totalTarget} (${Math.round(totalTarget/totalFetched*1000)/10}%) | fake ${totalFake} | parser_ok ${totalParserOk}/${totalTarget}`);
    console.log(`  verdicts: ready=${readyCnt} | strengthen=${strengthenCnt} | broad_noise=${noiseCnt} | insufficient=${insufficientCnt}`);
  }

  // 위험 SKU 리스트
  console.log("\n=== 가품/노이즈 ↑ SKU (즉시 reject 강화 필요) ===");
  const danger = results.filter((r) => r.fakeRows >= 5 || r.verdict === "strengthen_reject").slice(0, 15);
  for (const r of danger) {
    console.log(`  ${r.skuId} (${r.modelName.slice(0, 35)}): fake=${r.fakeRows} pollution=${r.pollutionPct}%`);
    for (const s of r.samplePollution.slice(0, 2)) console.log(`    ${s}`);
  }

  console.log("\n=== Cross-bind 발견 SKU (다른 SKU와 충돌) ===");
  const crossy = results.filter((r) => r.crossBind > 0).slice(0, 10);
  for (const r of crossy) {
    console.log(`  ${r.skuId}: cross ${r.crossBind} → ${r.topCrossSkus.map((c) => `${c.skuId}(${c.count})`).join(", ")}`);
  }

  console.log("\n=== Data insufficient (표본 부족, 추가 mining 필요) ===");
  const insuf = results.filter((r) => r.verdict === "data_insufficient").slice(0, 10);
  for (const r of insuf) console.log(`  ${r.skuId}: fetched=${r.fetched} target=${r.targetBind}`);

  const summary = {
    wave: 91,
    phase: "mining_and_pollution_analysis",
    measured_at: new Date().toISOString(),
    total_skus: allSkus.length,
    total_queries: queryCache.size,
    total_fetched: results.reduce((s, r) => s + r.fetched, 0),
    total_target_bind: results.reduce((s, r) => s + r.targetBind, 0),
    total_fake: results.reduce((s, r) => s + r.fakeRows, 0),
    by_category: ["shoe", "bag", "bike"].map((cat) => {
      const cr = results.filter((r) => r.category === cat);
      return {
        category: cat,
        skus: cr.length,
        fetched: cr.reduce((s, r) => s + r.fetched, 0),
        target_bind: cr.reduce((s, r) => s + r.targetBind, 0),
        fake_rows: cr.reduce((s, r) => s + r.fakeRows, 0),
        parser_ok: cr.reduce((s, r) => s + r.parserOk, 0),
        verdict_counts: {
          ready_candidate: cr.filter((r) => r.verdict === "ready_candidate").length,
          strengthen_reject: cr.filter((r) => r.verdict === "strengthen_reject").length,
          broad_noise_high: cr.filter((r) => r.verdict === "broad_noise_high").length,
          data_insufficient: cr.filter((r) => r.verdict === "data_insufficient").length,
        },
      };
    }),
    results,
  };

  await writeFile(
    path.join(appDir, "reports/wave91-mining-pollution-latest.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("\n→ reports/wave91-mining-pollution-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
