// Wave 91 (2026-05-15): 신발/가방/자전거 catalog 추가 후 진단.
// 카테고리 sweep + narrow query로 매물 가져와서 ruleMatch + parseListingOptions 측정.
// 목표: 각 카테고리 binding 비율 + SKU별 hit 빈도 + parser pass율 + 광고/가품 패턴 식별.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { ruleMatch, skuById } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// Wave 91 신규 카테고리 sweep query
const TARGETS: { query: string; family: string }[] = [
  { query: "category:405", family: "shoe" },
  { query: "category:430", family: "bag" },
  { query: "category:700350", family: "bike" },
];

type Result = {
  query: string;
  family: string;
  fetched: number;
  unique: number;
  ruleMatched: number;
  ruleMatchPct: number;
  parserOk: number;
  parserReview: number;
  parserOkPct: number;
  topSkuHits: Array<{ skuId: string; count: number; samples: string[] }>;
  unmatchedSamples: string[];
  adRowsByTitle: number;
};

const AD_PATTERN = /매입|삽니다|구합니다|파손|짭|미러|짝퉁|이미테이션|복각/;

async function diagnose(query: string, family: string): Promise<Result> {
  const PAGES = 3;
  const allItems: SearchItem[] = [];
  for (let page = 0; page < PAGES; page++) {
    try {
      const items = await searchPage(query, page, { order: "date", limit: 96 });
      if (items.length === 0) break;
      allItems.push(...items);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`fetch fail ${query} page ${page}:`, err instanceof Error ? err.message : err);
    }
  }
  const uniquePids = new Map<string, SearchItem>();
  for (const it of allItems) uniquePids.set(it.pid, it);
  const list = [...uniquePids.values()];

  let ruleMatched = 0, parserOk = 0, parserReview = 0, adRowsByTitle = 0;
  const skuHits = new Map<string, { count: number; samples: string[] }>();
  const unmatched: string[] = [];

  for (const item of list) {
    if (AD_PATTERN.test(item.name)) adRowsByTitle += 1;
    const sku = ruleMatch(item.name, "");
    if (sku) {
      ruleMatched += 1;
      const entry = skuHits.get(sku.id) ?? { count: 0, samples: [] };
      entry.count += 1;
      if (entry.samples.length < 3) entry.samples.push(item.name.slice(0, 60));
      skuHits.set(sku.id, entry);
      try {
        const parsed = parseListingOptions({
          title: item.name,
          description: "",
          skuId: sku.id,
          skuName: sku.modelName,
          category: sku.category,
        });
        if (parsed.needsReview) parserReview += 1;
        else parserOk += 1;
      } catch {
        parserReview += 1;
      }
    } else {
      if (unmatched.length < 8) unmatched.push(item.name.slice(0, 65));
    }
  }
  const topSkuHits = [...skuHits.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([skuId, { count, samples }]) => ({ skuId, count, samples }));

  return {
    query, family,
    fetched: allItems.length,
    unique: list.length,
    ruleMatched,
    ruleMatchPct: list.length > 0 ? Math.round((ruleMatched / list.length) * 1000) / 10 : 0,
    parserOk,
    parserReview,
    parserOkPct: ruleMatched > 0 ? Math.round((parserOk / ruleMatched) * 1000) / 10 : 0,
    topSkuHits,
    unmatchedSamples: unmatched,
    adRowsByTitle,
  };
}

async function main() {
  console.log("Wave 91 — 신발/가방/자전거 catalog 진단");
  console.log("각 카테고리 sweep × page 0~2 (288건) → ruleMatch + parser\n");

  const results: Result[] = [];
  for (const { query, family } of TARGETS) {
    process.stdout.write(`${query} (${family}) ... `);
    try {
      const r = await diagnose(query, family);
      results.push(r);
      console.log(`${r.unique}건 / 매칭 ${r.ruleMatched} (${r.ruleMatchPct}%) / parser pass ${r.parserOk}/${r.ruleMatched} (${r.parserOkPct}%) / 광고 ${r.adRowsByTitle}`);
    } catch (err) {
      console.log(`err: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\n=== SKU 매칭 분포 ===");
  for (const r of results) {
    if (r.topSkuHits.length === 0) {
      console.log(`${r.family}: 매칭 0건 (catalog mustContain 정확도 점검 필요)`);
      console.log(`  unmatched 샘플:`);
      for (const u of r.unmatchedSamples) console.log(`    "${u}"`);
      continue;
    }
    console.log(`${r.family}:`);
    for (const h of r.topSkuHits) {
      console.log(`  ${h.skuId}: ${h.count}건`);
      for (const s of h.samples) console.log(`    "${s}"`);
    }
  }

  const summary = {
    wave: 91,
    measured_at: new Date().toISOString(),
    total_unique: results.reduce((s, r) => s + r.unique, 0),
    total_matched: results.reduce((s, r) => s + r.ruleMatched, 0),
    total_ad_rows: results.reduce((s, r) => s + r.adRowsByTitle, 0),
    results,
  };

  await writeFile(
    path.join(appDir, "reports/wave91-shoe-bag-bike-boost-diag-latest.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(`\n총 ${summary.total_unique}건 / 매칭 ${summary.total_matched} / 광고 ${summary.total_ad_rows}`);
  console.log("→ reports/wave91-shoe-bag-bike-boost-diag-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
