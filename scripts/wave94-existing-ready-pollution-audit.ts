// Wave 94 (2026-05-15): 기존 ready 카테고리 매물 오염도 audit.
// Wave 92 wave91 신규 카테고리에서 했던 audit를 **현재 사용자 노출 중**인 ready 카테고리에도 적용.
// 이미 노출된 매물에 숨은 가품/부품/사고 매물 있는지 확인.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";
import { ruleMatch, CATALOG, type Sku } from "@/lib/catalog";
import { parseListingOptions, type ParsedListingOptions } from "@/lib/option-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// 기존 ready 카테고리 — 사용자 노출 중
const READY_CATEGORIES = new Set([
  "earphone", "smartwatch", "tablet", "laptop", "monitor",
  "speaker", "home_appliance", "sport_golf", "watch",
]);

// Wave 95: LANE_READINESS ready narrow lane (Wave 93에서 승격된 shoe/bag/bike narrow)
const READY_LANE_KEYS = new Set([
  "shoe_salomon_xt6_black",
  "bike_trek_emonda_sl5",
  "bike_merida_bignine",
]);

const POLLUTION_HINTS = {
  fake_anxiety: /정품\s*보증|감정\s*가능|감정\s*문의|정가품\s*문의|레플|st급|미러급|특\s*a\s*급|sa\s*급|이미테이션|짭|짝퉁|복각|오라리/i,
  parts_only: /한짝|왼발만|오른발만|박스만|더스트백만|스트랩만|영수증만|프레임만|포크만|휠셋만|안장만|단품|부품|배터리만|충전기만|렌즈만|바디캡만/,
  damage: /파손|크랙|찢어짐|구멍|얼룩 심함|변색 심함|곰팡이|악취|냄새 심함|손상|수리\s*필요|넘어진|사고|침수|배터리\s*불량/,
  buying_intent: /삽니다|구합니다|구매함|매입|최고가|매입합니다/,
};

type Audit = {
  skuId: string;
  brand: string;
  modelName: string;
  category: string;
  parserPassedCount: number;
  priceMedian: number | null;
  priceP25: number | null;
  priceP75: number | null;
  priceOutliersLow: number;
  priceOutliersHigh: number;
  suspiciousCounts: Record<string, number>;
  pollutionPct: number;
  cleanCount: number;
  verdict: "safe_ready" | "marginal" | "high_pollution" | "low_volume" | "skipped";
  pollutedSamples: Array<{ name: string; price: number; reason: string }>;
};

function percentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))] ?? null;
}

function pickPrimaryQuery(sku: Sku): string {
  const firstGroup = sku.mustContain[0] ?? [];
  const korean = firstGroup.find((k) => /[가-힣]/.test(k));
  return (korean ?? firstGroup[0] ?? sku.modelName).trim();
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
      if (!parsed.needsReview) passed.push({ item, parsed });
    } catch {/* skip */}
  }
  return passed;
}

function audit(sku: Sku, passed: Array<{ item: SearchItem; parsed: ParsedListingOptions }>): Audit {
  const prices = passed.map((p) => p.item.price).filter((p) => p > 0).sort((a, b) => a - b);
  const p25 = percentile(prices, 0.25);
  const median = percentile(prices, 0.5);
  const p75 = percentile(prices, 0.75);
  let outliersLow = 0, outliersHigh = 0;
  if (median != null) {
    outliersLow = prices.filter((p) => p < median * 0.3).length;
    outliersHigh = prices.filter((p) => p > median * 3).length;
  }
  const suspiciousCounts: Record<string, number> = {};
  const polluted = new Set<string>();
  const pollutedSamples: Array<{ name: string; price: number; reason: string }> = [];
  for (const { item } of passed) {
    let reason = "";
    for (const [k, re] of Object.entries(POLLUTION_HINTS)) {
      if (re.test(item.name)) {
        suspiciousCounts[k] = (suspiciousCounts[k] ?? 0) + 1;
        if (!reason) reason = k;
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
  }
  const pollutionPct = passed.length > 0 ? Math.round((polluted.size / passed.length) * 1000) / 10 : 0;
  let verdict: Audit["verdict"];
  if (passed.length < 5) verdict = "low_volume";
  else if (pollutionPct > 15) verdict = "high_pollution";
  else if (pollutionPct > 5) verdict = "marginal";
  else verdict = "safe_ready";
  return {
    skuId: sku.id, brand: sku.brand, modelName: sku.modelName, category: sku.category,
    parserPassedCount: passed.length,
    priceMedian: median, priceP25: p25, priceP75: p75,
    priceOutliersLow: outliersLow, priceOutliersHigh: outliersHigh,
    suspiciousCounts, pollutionPct, cleanCount: passed.length - polluted.size,
    verdict, pollutedSamples,
  };
}

async function main() {
  console.log("Wave 94 — 기존 ready 카테고리 pollution audit");
  console.log("현재 사용자 노출 중인 매물의 진짜 오염도 측정\n");
  // CATALOG에서 ready 카테고리 SKU + LANE_READINESS ready narrow lane SKU
  const targetSkus = CATALOG.filter((s) =>
    READY_CATEGORIES.has(s.category) ||
    (s.laneKey != null && READY_LANE_KEYS.has(s.laneKey))
  );
  console.log(`대상 SKU: ${targetSkus.length}개 (${[...new Set(targetSkus.map((s) => s.category))].join(", ")})\n`);

  const audits: Audit[] = [];
  let i = 0;
  for (const sku of targetSkus) {
    i += 1;
    const q = pickPrimaryQuery(sku);
    process.stdout.write(`[${String(i).padStart(3)}/${targetSkus.length}] ${sku.id.padEnd(50)} `);
    try {
      const passed = await fetchAndParse(sku, q);
      const a = audit(sku, passed);
      audits.push(a);
      console.log(`pass=${String(a.parserPassedCount).padStart(3)} pol=${a.pollutionPct}% → ${a.verdict}`);
    } catch (err) {
      console.log(`err: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\n=== 카테고리별 verdict 집계 ===");
  const cats = [...new Set(audits.map((a) => a.category))];
  for (const cat of cats) {
    const ca = audits.filter((a) => a.category === cat);
    const safe = ca.filter((a) => a.verdict === "safe_ready").length;
    const marg = ca.filter((a) => a.verdict === "marginal").length;
    const hi = ca.filter((a) => a.verdict === "high_pollution").length;
    const lv = ca.filter((a) => a.verdict === "low_volume").length;
    console.log(`  ${cat.padEnd(18)}: safe=${safe} marg=${marg} HIGH=${hi} low_vol=${lv}`);
  }

  console.log("\n=== 🚨 HIGH POLLUTION (>15%) — 사용자에게 이미 노출 중! ===");
  const dangerous = audits.filter((a) => a.verdict === "high_pollution");
  for (const a of dangerous) {
    console.log(`\n  ${a.skuId} (${a.category}): pass=${a.parserPassedCount} pollution=${a.pollutionPct}%`);
    console.log(`    median=₩${(a.priceMedian ?? 0).toLocaleString()} (p25=${a.priceP25?.toLocaleString()} p75=${a.priceP75?.toLocaleString()})`);
    for (const s of a.pollutedSamples.slice(0, 3)) {
      console.log(`    [${s.reason}] ₩${s.price.toLocaleString()} "${s.name}"`);
    }
  }

  console.log("\n=== ⚠️ MARGINAL (5~15%) ===");
  const marginal = audits.filter((a) => a.verdict === "marginal");
  for (const a of marginal.slice(0, 10)) {
    console.log(`  ${a.skuId}: pass=${a.parserPassedCount} pol=${a.pollutionPct}% suspicious=${Object.entries(a.suspiciousCounts).map(([k,v]) => `${k}=${v}`).join(",")}`);
  }

  const summary = {
    wave: 94,
    phase: "existing_ready_pollution_audit",
    measured_at: new Date().toISOString(),
    total_skus: audits.length,
    danger_count: dangerous.length,
    marginal_count: marginal.length,
    by_category: cats.map((c) => {
      const ca = audits.filter((a) => a.category === c);
      return {
        category: c,
        sku_count: ca.length,
        verdict_counts: {
          safe_ready: ca.filter((a) => a.verdict === "safe_ready").length,
          marginal: ca.filter((a) => a.verdict === "marginal").length,
          high_pollution: ca.filter((a) => a.verdict === "high_pollution").length,
          low_volume: ca.filter((a) => a.verdict === "low_volume").length,
        },
      };
    }),
    audits,
  };
  await writeFile(
    path.join(appDir, "reports/wave94-existing-ready-audit-latest.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(`\n총 SKU ${audits.length} / HIGH ${dangerous.length} / MARGINAL ${marginal.length}`);
  console.log("→ reports/wave94-existing-ready-audit-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
