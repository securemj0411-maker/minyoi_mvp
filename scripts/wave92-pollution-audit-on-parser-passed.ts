// Wave 92 pollution audit (parser 통과 매물만 대상).
// parser_ok 매물 = "사용자에게 추천될 후보" → 이게 진짜 SKU인지, 가품/부품/사고/도난 의심인지 검사.
//
// 측정 metric (per SKU):
//   - parser_passed_count
//   - price_p25 / median / p75
//   - price_outliers (median × 0.3 미만 → 가품/부품 의심, median × 3 이상 → 한정판/오타)
//   - suspicious_pattern_count (title 정규식 매칭):
//       * 가품 hint (정품 강조/문의/감정/A급/특A급 등 셀러 anxiety 표현)
//       * 부품/단품 (한짝/박스만/스트랩만/프레임만)
//       * 사고/크랙 (자전거)
//       * 색상/사이즈 미스매치 (catalog 색상과 다른 색상 텍스트)
//   - estimated_pollution_pct = (price_outliers + suspicious_patterns) / parser_passed
//
// Ready 승격 기준: estimated_pollution_pct ≤ 5% + 표본 ≥ 5건.
//
// 사용: npx tsx scripts/wave92-pollution-audit-on-parser-passed.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { ruleMatch, type Sku } from "@/lib/catalog";
import { parseListingOptions, type ParsedListingOptions } from "@/lib/option-parser";
import { SHOE_CATALOG } from "@/lib/generated/catalog-shoe-wave91";
import { BAG_CATALOG } from "@/lib/generated/catalog-bag-wave91";
import { BIKE_CATALOG } from "@/lib/generated/catalog-bike-wave91";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// Title 정규식 — parser 통과 매물에서 오염 후보 식별.
const POLLUTION_HINTS = {
  // 셀러 가품 anxiety (정품인 척 강조하거나 감정 가능 명시 = 의심)
  fake_anxiety: /정품\s*보증|감정\s*가능|감정\s*문의|정가품\s*문의|레플|st급|미러급|특\s*a\s*급|sa\s*급|이미테이션|짭|짝퉁|복각|오라리/i,
  // 부품/단품
  parts_only: /한짝|왼발만|오른발만|박스만|더스트백만|스트랩만|영수증만|프레임만|포크만|휠셋만|안장만|단품|부품/,
  // 손상
  damage: /파손|크랙|찢어짐|구멍|얼룩 심함|변색 심함|곰팡이|악취|냄새 심함|손상|수리\s*필요|넘어진|사고/,
  // 자전거 특이
  bike_stolen: /도난|훔침|시리얼\s*없음|영수증\s*없음/i,
  // 의심 가격 anchor (50만 미만, 매물별로는 의미 다름)
  too_cheap_anchor: /(5\d{4}|[12]\d{4})\s*원/, // 1~5만 원 — 본품 가격으로 너무 쌈
};

type Verdict = "ready_promote" | "needs_more_data" | "high_pollution" | "low_volume";

type SkuAudit = {
  skuId: string;
  brand: string;
  modelName: string;
  category: string;
  parserPassedCount: number;
  priceP25: number | null;
  priceMedian: number | null;
  priceP75: number | null;
  priceOutliersLow: number;
  priceOutliersHigh: number;
  suspiciousCounts: Record<string, number>;
  totalPollution: number;
  pollutionPct: number;
  cleanCount: number;
  cleanPct: number;
  verdict: Verdict;
  // 수동 검토용 샘플
  cleanSamples: Array<{ name: string; price: number }>;
  pollutedSamples: Array<{ name: string; price: number; reason: string }>;
};

function percentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.floor(sorted.length * pct);
  return sorted[Math.min(sorted.length - 1, idx)] ?? null;
}

async function fetchAndParse(sku: Sku, query: string): Promise<Array<{ item: SearchItem; parsed: ParsedListingOptions }>> {
  const all: SearchItem[] = [];
  for (let page = 0; page < 2; page++) {
    try {
      const items = await searchPage(query, page, { order: "date", limit: 96 });
      if (items.length === 0) break;
      all.push(...items);
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      break;
    }
  }
  // 자기 SKU에 매칭 + parser pass 한 매물만
  const passed: Array<{ item: SearchItem; parsed: ParsedListingOptions }> = [];
  const seen = new Set<string>();
  for (const item of all) {
    if (seen.has(item.pid)) continue;
    seen.add(item.pid);
    const matched = ruleMatch(item.name, "");
    if (matched?.id !== sku.id) continue;
    try {
      const parsed = parseListingOptions({
        title: item.name,
        description: "",
        skuId: matched.id,
        skuName: matched.modelName,
        category: matched.category,
      });
      if (!parsed.needsReview) {
        passed.push({ item, parsed });
      }
    } catch {
      // skip
    }
  }
  return passed;
}

function pickPrimaryQuery(sku: Sku): string {
  const firstGroup = sku.mustContain[0] ?? [];
  const korean = firstGroup.find((k) => /[가-힣]/.test(k));
  return (korean ?? firstGroup[0] ?? sku.modelName).trim();
}

function auditSku(sku: Sku, passed: Array<{ item: SearchItem; parsed: ParsedListingOptions }>): SkuAudit {
  const prices = passed.map((p) => p.item.price).filter((p) => p > 0).sort((a, b) => a - b);
  const p25 = percentile(prices, 0.25);
  const median = percentile(prices, 0.5);
  const p75 = percentile(prices, 0.75);

  // Outlier detection (price)
  let outliersLow = 0, outliersHigh = 0;
  if (median != null) {
    outliersLow = prices.filter((p) => p < median * 0.3).length;
    outliersHigh = prices.filter((p) => p > median * 3).length;
  }

  // Suspicious pattern counts
  const suspiciousCounts: Record<string, number> = {};
  const pollutedSamples: Array<{ name: string; price: number; reason: string }> = [];
  const cleanSamples: Array<{ name: string; price: number }> = [];
  const polluted = new Set<string>();
  for (const { item } of passed) {
    let reason = "";
    for (const [key, re] of Object.entries(POLLUTION_HINTS)) {
      if (re.test(item.name)) {
        suspiciousCounts[key] = (suspiciousCounts[key] ?? 0) + 1;
        if (!reason) reason = key;
        polluted.add(item.pid);
      }
    }
    if (median != null && (item.price < median * 0.3 || item.price > median * 3)) {
      suspiciousCounts.price_outlier = (suspiciousCounts.price_outlier ?? 0) + 1;
      if (!reason) reason = item.price < median * 0.3 ? "price_too_low" : "price_too_high";
      polluted.add(item.pid);
    }
    if (reason && pollutedSamples.length < 5) {
      pollutedSamples.push({ name: item.name.slice(0, 60), price: item.price, reason });
    }
    if (!reason && cleanSamples.length < 5) {
      cleanSamples.push({ name: item.name.slice(0, 60), price: item.price });
    }
  }

  const totalPollution = polluted.size;
  const pollutionPct = passed.length > 0 ? Math.round((totalPollution / passed.length) * 1000) / 10 : 0;
  const cleanCount = passed.length - totalPollution;
  const cleanPct = passed.length > 0 ? Math.round((cleanCount / passed.length) * 1000) / 10 : 0;

  let verdict: Verdict;
  if (passed.length < 5) verdict = "low_volume";
  else if (pollutionPct > 15) verdict = "high_pollution";
  else if (pollutionPct <= 5 && passed.length >= 10) verdict = "ready_promote";
  else verdict = "needs_more_data";

  return {
    skuId: sku.id, brand: sku.brand, modelName: sku.modelName, category: sku.category,
    parserPassedCount: passed.length,
    priceP25: p25, priceMedian: median, priceP75: p75,
    priceOutliersLow: outliersLow, priceOutliersHigh: outliersHigh,
    suspiciousCounts, totalPollution, pollutionPct, cleanCount, cleanPct,
    verdict, cleanSamples, pollutedSamples,
  };
}

async function main() {
  console.log("Wave 92 pollution audit (parser 통과 매물만 검사)");
  console.log("각 SKU primary query × page 0~1 (192건) → ruleMatch + parser → 통과 매물만 오염 검사\n");

  const allSkus = [...SHOE_CATALOG, ...BAG_CATALOG, ...BIKE_CATALOG];
  const audits: SkuAudit[] = [];
  let i = 0;
  for (const sku of allSkus) {
    i += 1;
    const q = pickPrimaryQuery(sku);
    process.stdout.write(`[${String(i).padStart(3)}/${allSkus.length}] ${sku.id.padEnd(50)} `);
    try {
      const passed = await fetchAndParse(sku, q);
      const audit = auditSku(sku, passed);
      audits.push(audit);
      console.log(`passed=${String(audit.parserPassedCount).padStart(3)} clean=${audit.cleanCount} polluted=${audit.totalPollution} (${audit.pollutionPct}%) → ${audit.verdict}`);
    } catch (err) {
      console.log(`err: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 카테고리별 집계
  console.log("\n=== 카테고리별 verdict 분포 ===");
  for (const cat of ["shoe", "bag", "bike"]) {
    const ca = audits.filter((a) => a.category === cat);
    const ready = ca.filter((a) => a.verdict === "ready_promote");
    const hi = ca.filter((a) => a.verdict === "high_pollution");
    const lv = ca.filter((a) => a.verdict === "low_volume");
    const nd = ca.filter((a) => a.verdict === "needs_more_data");
    console.log(`${cat}: ready=${ready.length} | high_pollution=${hi.length} | low_volume=${lv.length} | needs_more_data=${nd.length}`);
  }

  console.log("\n=== 🥇 ready_promote SKU (pollution≤5% + 표본≥10) ===");
  for (const a of audits.filter((a) => a.verdict === "ready_promote")) {
    const sus = Object.entries(a.suspiciousCounts).map(([k, v]) => `${k}=${v}`).join(", ") || "clean";
    console.log(`  ${a.skuId.padEnd(50)} passed=${a.parserPassedCount} pollution=${a.pollutionPct}% median=₩${(a.priceMedian ?? 0).toLocaleString()} [${sus}]`);
  }

  console.log("\n=== ⚠️ high_pollution SKU (>15%) — 정밀화 필요 ===");
  for (const a of audits.filter((a) => a.verdict === "high_pollution").slice(0, 10)) {
    console.log(`  ${a.skuId}: passed=${a.parserPassedCount} pollution=${a.pollutionPct}%`);
    for (const s of a.pollutedSamples.slice(0, 3)) {
      console.log(`    [${s.reason}] ₩${s.price.toLocaleString()} "${s.name}"`);
    }
  }

  console.log("\n=== 가격 분포 샘플 (ready 후보) ===");
  for (const a of audits.filter((a) => a.verdict === "ready_promote").slice(0, 10)) {
    console.log(`  ${a.skuId}: p25=₩${(a.priceP25 ?? 0).toLocaleString()} | median=₩${(a.priceMedian ?? 0).toLocaleString()} | p75=₩${(a.priceP75 ?? 0).toLocaleString()}`);
  }

  const summary = {
    wave: 92,
    phase: "pollution_audit_on_parser_passed",
    measured_at: new Date().toISOString(),
    total_skus: allSkus.length,
    audits,
    by_category: ["shoe", "bag", "bike"].map((cat) => {
      const ca = audits.filter((a) => a.category === cat);
      return {
        category: cat,
        sku_count: ca.length,
        verdict_counts: {
          ready_promote: ca.filter((a) => a.verdict === "ready_promote").length,
          high_pollution: ca.filter((a) => a.verdict === "high_pollution").length,
          low_volume: ca.filter((a) => a.verdict === "low_volume").length,
          needs_more_data: ca.filter((a) => a.verdict === "needs_more_data").length,
        },
      };
    }),
  };
  await writeFile(
    path.join(appDir, "reports/wave92-pollution-audit-latest.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("\n→ reports/wave92-pollution-audit-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
