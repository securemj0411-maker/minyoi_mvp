// Wave 88: category sweep 라이브 검증.
// 10개 L2 카테고리에 대해 searchPage("category:<id>", 0)로 fetch + ruleMatch + parseListingOptions.
// 측정: 총 매물, ruleMatched, 광고/매입글 비율, SKU별 hit, 업데이트 시간 span.
// 결정론 정확성 점검: catalog mustNotContain이 광고 글 제대로 reject 하는지.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage } from "@/lib/bunjang";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { DEFAULT_CATEGORY_SWEEPS } from "@/lib/pipeline-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const AD_PATTERN = /매입|삽니다|파손폰|고장폰|고가매입/;

type CategoryResult = {
  id: string;
  title: string;
  fetched: number;
  uniquePids: number;
  newestUtKst: string;
  oldestUtKst: string;
  spanMinutes: number;
  ratePerMinute: number;
  adRowsByTitle: number;
  bizsellerRows: number;
  ruleMatched: number;
  ruleMatchedPct: number;
  parserOk: number;
  parserReview: number;
  topSkuMatches: Array<{ skuId: string; count: number; samples: string[] }>;
  unmatchedSamples: string[];
};

function fmtKst(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

async function diagnose(id: string, title: string): Promise<CategoryResult> {
  const query = `category:${id}`;
  const items = await searchPage(query, 0, { order: "date", limit: 96 });
  const uniqueByPid = new Map(items.map((i) => [i.pid, i]));
  const list = [...uniqueByPid.values()];

  const times = list
    .map((i) => i.updateTime)
    .filter((t): t is number => typeof t === "number" && t > 0)
    .sort((a, b) => b - a);
  const newest = times[0] ?? 0;
  const oldest = times[times.length - 1] ?? 0;
  const spanMin = newest && oldest ? (newest - oldest) / 60 : 0;

  let adRowsByTitle = 0;
  let bizsellerRows = 0;
  let ruleMatched = 0;
  let parserOk = 0;
  let parserReview = 0;
  const skuHits = new Map<string, { count: number; samples: string[] }>();
  const unmatched: string[] = [];

  for (const item of list) {
    if (AD_PATTERN.test(item.name)) adRowsByTitle += 1;
    if (item.sellerBizseller) bizsellerRows += 1;
    const sku = ruleMatch(item.name, "");
    if (sku) {
      ruleMatched += 1;
      const entry = skuHits.get(sku.id) ?? { count: 0, samples: [] };
      entry.count += 1;
      if (entry.samples.length < 3) entry.samples.push(item.name.slice(0, 55));
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
      if (unmatched.length < 5) unmatched.push(item.name.slice(0, 60));
    }
  }

  const topSkuMatches = Array.from(skuHits.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([skuId, { count, samples }]) => ({ skuId, count, samples }));

  return {
    id,
    title,
    fetched: items.length,
    uniquePids: list.length,
    newestUtKst: fmtKst(newest),
    oldestUtKst: fmtKst(oldest),
    spanMinutes: Math.round(spanMin * 10) / 10,
    ratePerMinute: spanMin > 0 ? Math.round((list.length / spanMin) * 10) / 10 : 0,
    adRowsByTitle,
    bizsellerRows,
    ruleMatched,
    ruleMatchedPct: list.length > 0 ? Math.round((ruleMatched / list.length) * 1000) / 10 : 0,
    parserOk,
    parserReview,
    topSkuMatches,
    unmatchedSamples: unmatched,
  };
}

async function main() {
  console.log("Wave 88 category sweep 라이브 검증");
  console.log(`대상: ${DEFAULT_CATEGORY_SWEEPS.length}개 L2 카테고리, order=date page 0, limit 96\n`);

  const results: CategoryResult[] = [];
  for (const { id, title } of DEFAULT_CATEGORY_SWEEPS) {
    process.stdout.write(`category:${id} (${title}) ... `);
    try {
      const r = await diagnose(id, title);
      results.push(r);
      console.log(`${r.fetched}건 / ${r.spanMinutes}분 span = ${r.ratePerMinute}/min  매칭=${r.ruleMatched}(${r.ruleMatchedPct}%)  광고=${r.adRowsByTitle}  biz=${r.bizsellerRows}`);
    } catch (err) {
      console.log(`err: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log("\n=== SKU 매칭 분포 ===");
  for (const r of results) {
    if (r.topSkuMatches.length === 0) continue;
    console.log(`${r.title} (cat=${r.id}):`);
    for (const sku of r.topSkuMatches) {
      console.log(`  ${sku.skuId}: ${sku.count}건`);
      for (const s of sku.samples) console.log(`    "${s}"`);
    }
  }

  const summary = {
    wave: 88,
    measured_at: new Date().toISOString(),
    total_fetched: results.reduce((s, r) => s + r.fetched, 0),
    total_rule_matched: results.reduce((s, r) => s + r.ruleMatched, 0),
    total_ad_rows: results.reduce((s, r) => s + r.adRowsByTitle, 0),
    results,
  };

  await writeFile(
    path.join(appDir, "reports/wave88-category-sweep-verify-latest.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(`\n총 fetched=${summary.total_fetched} 매칭=${summary.total_rule_matched} 광고=${summary.total_ad_rows}`);
  console.log("→ reports/wave88-category-sweep-verify-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
