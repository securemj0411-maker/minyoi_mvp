// Wave 90 (2026-05-15): 카테고리 전반 catalog gap 자동 분석.
// 사용자 의도: case-by-case 클루지 X. 패턴 탐지로 narrow lane 분리 후보 자동 식별.
//
// 분석:
//   1. 모든 sku_id별 매물 수 + 가격 분포
//   2. 각 sku 안에서 chip/release_year/screen_size 분포 (parsed_json에서 추출)
//   3. 변형별 가격 차이 (median ratio max/min)
//   4. ratio > 1.5x + 각 변형 sample >= 5 → narrow lane 분리 권장 (자동 탐지)
//
// 사용: npm run analyze:catalog-coverage

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnv(p) {
  try {
    const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...rest] = t.split("=");
      if (!process.env[k]) process.env[k] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}
await loadEnv(path.join(appDir, ".env.local"));
await loadEnv(path.join(appDir, ".env"));

const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HDR = { apikey: KEY, authorization: `Bearer ${KEY}` };

async function fetchJson(p) {
  const r = await fetch(URL_BASE + p, { headers: HDR });
  if (!r.ok) throw new Error(`${r.status} ${p}`);
  return r.json();
}

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function quantile(arr, q) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

console.log("[1/3] loading SKU list from catalog.ts...");
// catalog import 안 하고 raw_listings에서 page 처리로 distinct sku_id 수집
const skuSet = new Set();
let offset = 0;
while (offset < 50000) {
  const batch = await fetchJson(`/mvp_raw_listings?select=sku_id&listing_type=eq.normal&listing_state=eq.active&sku_id=not.is.null&offset=${offset}&limit=1000`);
  if (batch.length === 0) break;
  for (const r of batch) if (r.sku_id) skuSet.add(r.sku_id);
  offset += batch.length;
  if (batch.length < 1000) break;
}
const skus = [...skuSet];
console.log(`  → ${skus.length} unique sku_id (총 ${offset} listings 스캔)`);

const results = [];
let processed = 0;

for (const sku of skus) {
  processed++;
  if (processed % 20 === 0) console.log(`  ${processed}/${skus.length}`);

  // 1. 매물 + 가격
  const rawRows = await fetchJson(`/mvp_raw_listings?select=pid&sku_id=eq.${encodeURIComponent(sku)}&listing_type=eq.normal&listing_state=eq.active&limit=1000`);
  const pids = rawRows.map((r) => Number(r.pid));
  if (pids.length < 5) continue; // sample 부족 SKU 스킵

  // 2. price + parsed_json batch fetch
  const listingRows = [];
  const parsedRows = [];
  const analysisRows = [];
  for (let i = 0; i < pids.length; i += 200) {
    const chunk = pids.slice(i, i + 200).join(",");
    const [l, p, a] = await Promise.all([
      fetchJson(`/mvp_listings?select=pid,price,sku_name,sku_median&pid=in.(${chunk})`),
      fetchJson(`/mvp_listing_parsed?select=pid,comparable_key,parsed_json&pid=in.(${chunk})`),
      fetchJson(`/mvp_listing_analysis?select=pid,risk_hits&pid=in.(${chunk})`),
    ]);
    listingRows.push(...l);
    parsedRows.push(...p);
    analysisRows.push(...a);
  }
  const priceByPid = new Map(listingRows.map((r) => [Number(r.pid), Number(r.price ?? 0)]));
  const parsedByPid = new Map(parsedRows.map((r) => [Number(r.pid), r]));
  const riskByPid = new Map(analysisRows.map((r) => [Number(r.pid), Number(r.risk_hits ?? 0)]));

  // 3. 변형 그룹 = comparable_key 자체 (parsed_json에 chip/year 직접 안 박혀있음 — comparable_key에만)
  const groupCount = new Map(); // ck → { count, prices[] }
  let conditionNotesNew = 0;
  for (const pid of pids) {
    const price = priceByPid.get(pid) || 0;
    if (price <= 0) continue;
    if ((riskByPid.get(pid) ?? 0) > 0) continue;
    const parsed = parsedByPid.get(pid);
    if (!parsed?.comparable_key) continue;
    const ck = parsed.comparable_key;
    // 새상품 제외 (시세 왜곡 방지)
    const pj = parsed.parsed_json ?? {};
    const notes = (pj.condition_notes) ?? [];
    if (Array.isArray(notes) && notes.includes("new_or_open_box")) {
      conditionNotesNew++;
      continue;
    }
    if (!groupCount.has(ck)) groupCount.set(ck, { count: 0, prices: [] });
    const g = groupCount.get(ck);
    g.count++;
    g.prices.push(price);
  }
  const ckCount = groupCount;

  // 4. 변형 그룹 = comparable_key 별. 가격 차이 큰 것 우선.
  const groups = [...groupCount.entries()]
    .map(([ck, { count, prices }]) => ({ variant: ck, count, median: median(prices) }))
    .filter((g) => g.count >= 3)
    .sort((a, b) => b.count - a.count);

  const allPrices = [...priceByPid.values()].filter((p) => p > 0);
  const overallMedian = median(allPrices);
  const overallP25 = quantile(allPrices, 0.25);
  const overallP75 = quantile(allPrices, 0.75);
  const variantMedians = groups.filter((g) => g.median > 0).map((g) => g.median);
  const maxMedian = variantMedians.length > 0 ? Math.max(...variantMedians) : 0;
  const minMedian = variantMedians.length > 0 ? Math.min(...variantMedians) : 0;
  const ratio = minMedian > 0 ? maxMedian / minMedian : null;

  // 5. narrow lane 분리 권장 판단
  const recommend = [];
  if (groups.length >= 2 && ratio !== null && ratio > 1.5 && groups[0].count >= 5 && groups[1].count >= 5) {
    recommend.push(`narrow lane 분리 권장 (변형 ${groups.length}+ + 가격 ratio ${ratio.toFixed(1)}x)`);
  }
  if (ckCount.size >= 5) {
    recommend.push(`comparable_key ${ckCount.size}종 — 다양성 ↑`);
  }
  if (conditionNotesNew > pids.length * 0.2) {
    recommend.push(`새상품 비율 ${Math.round(conditionNotesNew / pids.length * 100)}% — outlier risk`);
  }

  results.push({
    sku,
    sku_name: listingRows[0]?.sku_name ?? null,
    matched_listings: pids.length,
    valid_listings: allPrices.length,
    price: { p25: overallP25, median: overallMedian, p75: overallP75 },
    variant_groups: groups.length,
    top_variants: groups.slice(0, 5),
    variant_median_max: maxMedian,
    variant_median_min: minMedian,
    variant_ratio: ratio,
    comparable_key_count: ckCount.size,
    new_unopened_count: conditionNotesNew,
    recommend,
  });
}

console.log("[2/3] sorting + ranking...");
const sortedByImportance = results
  .filter((r) => r.recommend.length > 0)
  .sort((a, b) => {
    // 우선순위: ratio × 매물수
    const aScore = (a.variant_ratio ?? 1) * a.matched_listings;
    const bScore = (b.variant_ratio ?? 1) * b.matched_listings;
    return bScore - aScore;
  });

console.log("[3/3] writing report...");
const lines = [];
lines.push("# Catalog gap 자동 분석 보고서");
lines.push("");
lines.push(`- generated_at: ${new Date().toISOString()}`);
lines.push(`- 분석 SKU: ${results.length}`);
lines.push(`- 분리 권장 SKU: ${sortedByImportance.length}`);
lines.push("");
lines.push("## 🔥 narrow lane 분리 권장 (top 20, ratio × 매물수 순)");
lines.push("");
lines.push("| sku_id | sku_name | 매물 | 변형 | 가격 ratio | 변형 분포 | 권장 |");
lines.push("|---|---|---:|---:|---:|---|---|");
for (const r of sortedByImportance.slice(0, 20)) {
  const variants = r.top_variants.slice(0, 3).map((v) => {
    // comparable_key의 specific options 부분만 (family|model 제외)
    const parts = String(v.variant).split("|").slice(2).join("·") || "(base)";
    return `${parts}:${v.count}건 ₩${(v.median / 10000).toFixed(0)}만`;
  }).join(" / ");
  lines.push(`| \`${r.sku}\` | ${r.sku_name ?? "—"} | ${r.matched_listings} | ${r.variant_groups} | ${r.variant_ratio?.toFixed(1) ?? "—"}x | ${variants} | ${r.recommend.join(" + ")} |`);
}
lines.push("");
lines.push("## 전체 SKU 분석 (매물 ↑순)");
lines.push("");
lines.push("| sku_id | 매물 | 변형 | 가격 median | ratio | issue |");
lines.push("|---|---:|---:|---:|---:|---|");
for (const r of [...results].sort((a, b) => b.matched_listings - a.matched_listings).slice(0, 50)) {
  lines.push(`| \`${r.sku}\` | ${r.matched_listings} | ${r.variant_groups} | ₩${(r.price.median / 10000).toFixed(0)}만 | ${r.variant_ratio?.toFixed(1) ?? "—"}x | ${r.recommend.join(", ") || "—"} |`);
}

await writeFile(path.join(appDir, "reports/catalog-gap-analysis-latest.md"), lines.join("\n"));
await writeFile(path.join(appDir, "reports/catalog-gap-analysis-latest.json"), JSON.stringify({ generated_at: new Date().toISOString(), results, sortedByImportance }, null, 2));

console.log(`\n✅ ${results.length} SKU 분석 / ${sortedByImportance.length} narrow lane 분리 권장`);
console.log(`→ reports/catalog-gap-analysis-latest.md`);
console.log("\nTop 5 분리 권장:");
for (const r of sortedByImportance.slice(0, 5)) {
  console.log(`  \`${r.sku}\`: ${r.matched_listings}건, ${r.variant_groups} 변형, ratio ${r.variant_ratio?.toFixed(1)}x`);
}
