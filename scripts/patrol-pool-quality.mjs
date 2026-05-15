// Wave 90 (2026-05-15): 자동 풀 품질 순찰 도구.
// 사용자 의도: AI agent가 풀 매물 자동 점검해 SKU 매핑/세대/옵션 누락/outlier/fallback
// 등 시세 정확도 문제를 자동 진단. 사람 코멘트는 미묘한 영역만 담당.
//
// 사용: npm run patrol:pool [-- --sample=50] [-- --sku=<sku_id>]
//
// 5개 진단 룰:
//   R1. SKU 매핑 의심: 같은 comparable_key 매물 그룹에 다른 sku_id 매물 섞임
//   R2. 세대/모델 누락: comparable_key에 unknown_* 또는 비교 매물 제목에 세대 명시
//   R3. parser 옵션 누락: comparable_key에 unknown_* 1개 이상
//   R4. outlier 시세 왜곡: 비교 매물 가격 p75/p25 > 4 + sample < 8
//   R5. MSRP fallback 의심: sku_median이 market_price_daily blended 대비 1.4배 차이

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnv(p) {
  try {
    const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trim = line.trim();
      if (!trim || trim.startsWith("#") || !trim.includes("=")) continue;
      const [k, ...rest] = trim.split("=");
      const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
await loadEnv(path.join(appDir, ".env.local"));
await loadEnv(path.join(appDir, ".env"));

function restUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL 필요");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}
function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 필요");
  return { apikey: key, authorization: `Bearer ${key}` };
}
async function fetchJson(p) {
  const res = await fetch(`${restUrl()}${p}`, { headers: headers() });
  if (!res.ok) throw new Error(`${res.status} ${p}`);
  return res.json();
}

function arg(name, def) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : def;
}

const SAMPLE = Math.max(10, Math.min(500, Number(arg("sample", "50"))));
const SKU_FILTER = arg("sku", null);

// 1. 풀 매물 fetch
console.log(`[1/4] fetching pool (status=ready, limit=${SAMPLE}${SKU_FILTER ? `, sku=${SKU_FILTER}` : ""})...`);
let poolPids;
if (SKU_FILTER) {
  const skuPidsRes = await fetchJson(`/mvp_raw_listings?select=pid&sku_id=eq.${encodeURIComponent(SKU_FILTER)}&limit=2000`);
  const skuPids = skuPidsRes.map((r) => Number(r.pid));
  if (skuPids.length === 0) { console.log("매물 없음"); process.exit(0); }
  const poolRes = await fetchJson(`/mvp_candidate_pool?select=pid&status=eq.ready&pid=in.(${skuPids.join(",")})&limit=${SAMPLE}`);
  poolPids = poolRes.map((r) => Number(r.pid));
} else {
  const poolRes = await fetchJson(`/mvp_candidate_pool?select=pid&status=eq.ready&order=last_verified_at.desc&limit=${SAMPLE}`);
  poolPids = poolRes.map((r) => Number(r.pid));
}
console.log(`  → ${poolPids.length} pids`);

if (poolPids.length === 0) { console.log("\n풀에 ready 매물 없음"); process.exit(0); }

// 2. 매물별 listing + parsed + raw + market_daily fetch
console.log(`[2/4] fetching metadata batch...`);
const pidsCsv = poolPids.join(",");
const [listingRows, parsedRows, rawRows] = await Promise.all([
  fetchJson(`/mvp_listings?select=pid,name,price,sku_name,sku_median&pid=in.(${pidsCsv})`),
  fetchJson(`/mvp_listing_parsed?select=pid,comparable_key,parse_confidence,needs_review&pid=in.(${pidsCsv})`),
  fetchJson(`/mvp_raw_listings?select=pid,sku_id,name,listing_state&pid=in.(${pidsCsv})`),
]);
const lMap = new Map(listingRows.map((r) => [Number(r.pid), r]));
const pMap = new Map(parsedRows.map((r) => [Number(r.pid), r]));
const rMap = new Map(rawRows.map((r) => [Number(r.pid), r]));

const compKeys = [...new Set(parsedRows.map((r) => r.comparable_key).filter(Boolean))];
console.log(`  → ${compKeys.length} unique comparable_keys`);

// 3. comparable_key별 비교 매물 + market_daily fetch
console.log(`[3/4] analyzing comparable groups...`);
const compMap = new Map();
const dailyMap = new Map();

for (const ck of compKeys) {
  // 같은 comparable_key 매물 N건
  const sameKey = await fetchJson(`/mvp_listing_parsed?select=pid&comparable_key=eq.${encodeURIComponent(ck)}&limit=30`);
  const sameKeyPids = sameKey.map((r) => Number(r.pid));
  if (sameKeyPids.length === 0) continue;
  const sameRaws = await fetchJson(`/mvp_raw_listings?select=pid,name,price,sku_id,listing_state&pid=in.(${sameKeyPids.join(",")})`);
  compMap.set(ck, sameRaws);
}
const compChunks = [];
for (let i = 0; i < compKeys.length; i += 50) compChunks.push(compKeys.slice(i, i + 50));
for (const chunk of compChunks) {
  const filter = chunk.map((k) => `"${k}"`).join(",");
  const rows = await fetchJson(`/mvp_market_price_daily?select=comparable_key,blended_median_price,active_sample_count,sold_sample_count,p25_price,p75_price&comparable_key=in.(${encodeURIComponent(filter)})&order=computed_at.desc`);
  for (const r of rows) if (!dailyMap.has(r.comparable_key)) dailyMap.set(r.comparable_key, r);
}

// 4. 룰 적용
console.log(`[4/4] running 5 diagnostic rules...`);

const issues = []; // { pid, sku_id, comparable_key, name, rules: [{ rule, severity, detail }] }
const generationKeywords = /(\d)\s*세대|gen\s*(\d)/i;
const _ramSsdKeywords = /(\d{2,4})\s*gb\s*ram|(\d{3,4})\s*gb\s*ssd|램\s*(\d{2,4})|ssd\s*(\d{3,4})/i;

for (const pid of poolPids) {
  const l = lMap.get(pid);
  const p = pMap.get(pid);
  const r = rMap.get(pid);
  if (!l || !p || !r) continue;
  const ck = p.comparable_key;
  const skuId = r.sku_id;
  const matched = [];

  // R1. SKU 매핑 의심
  const compRows = ck ? compMap.get(ck) ?? [] : [];
  const otherSkuCount = compRows.filter((c) => c.sku_id && c.sku_id !== skuId).length;
  if (otherSkuCount >= 2) {
    const otherSkus = [...new Set(compRows.filter((c) => c.sku_id !== skuId).map((c) => c.sku_id))];
    matched.push({ rule: "R1_sku_mismatch", severity: "high", detail: `comparable_key 그룹에 다른 sku_id ${otherSkuCount}건 (${otherSkus.slice(0, 3).join(", ")})` });
  }

  // R2. 세대/모델 누락
  const compTitlesWithGen = compRows.filter((c) => generationKeywords.test(c.name)).length;
  const ckHasGen = ck && /(\d)_gen|gen(\d)|세대/.test(ck);
  if (compTitlesWithGen >= 2 && !ckHasGen) {
    matched.push({ rule: "R2_generation_missing", severity: "high", detail: `비교 매물 ${compTitlesWithGen}건 제목에 "X세대" 명시인데 comparable_key에 generation 없음` });
  }

  // R3. parser 옵션 누락
  const unknowns = ck?.split("|").filter((part) => part.startsWith("unknown_")) ?? [];
  if (unknowns.length > 0) {
    matched.push({ rule: "R3_parser_unknown", severity: "medium", detail: `comparable_key unknown parts: ${unknowns.join(", ")}` });
  }

  // R4. outlier 시세 왜곡
  const daily = dailyMap.get(ck);
  if (daily) {
    const sample = (daily.active_sample_count ?? 0) + (daily.sold_sample_count ?? 0);
    const p25 = Number(daily.p25_price);
    const p75 = Number(daily.p75_price);
    if (Number.isFinite(p25) && Number.isFinite(p75) && p25 > 0 && p75 / p25 > 4 && sample < 8) {
      matched.push({ rule: "R4_outlier_distortion", severity: "high", detail: `p75/p25 ratio ${(p75 / p25).toFixed(1)}배 + sample ${sample}건 (madTrim 미달 가능)` });
    }
  }

  // R5. MSRP fallback 의심
  if (daily?.blended_median_price && l.sku_median) {
    const ratio = l.sku_median / daily.blended_median_price;
    if (ratio > 1.4 || ratio < 0.7) {
      matched.push({ rule: "R5_fallback_mismatch", severity: "high", detail: `sku_median ₩${l.sku_median.toLocaleString()} vs market_daily ₩${Number(daily.blended_median_price).toLocaleString()} (ratio ${ratio.toFixed(2)}x)` });
    }
  }

  if (matched.length > 0) {
    issues.push({
      pid,
      sku_id: skuId,
      sku_name: l.sku_name,
      comparable_key: ck,
      name: l.name,
      sku_median: l.sku_median,
      price: l.price,
      compRowCount: compRows.length,
      rules: matched,
    });
  }
}

// 보고서
const ruleCount = new Map();
const skuIssueCount = new Map();
for (const issue of issues) {
  for (const r of issue.rules) ruleCount.set(r.rule, (ruleCount.get(r.rule) ?? 0) + 1);
  skuIssueCount.set(issue.sku_id ?? "_unknown", (skuIssueCount.get(issue.sku_id ?? "_unknown") ?? 0) + 1);
}

const lines = [];
lines.push("# 풀 품질 자동 순찰 보고서");
lines.push("");
lines.push(`- generated_at: ${new Date().toISOString()}`);
lines.push(`- 점검 매물: ${poolPids.length} / 발견된 issue 매물: ${issues.length}`);
if (SKU_FILTER) lines.push(`- SKU filter: ${SKU_FILTER}`);
lines.push("");
lines.push("## 룰별 발견 카운트");
lines.push("");
for (const [rule, count] of [...ruleCount.entries()].sort((a, b) => b[1] - a[1])) {
  const label = {
    R1_sku_mismatch: "R1. SKU 매핑 의심 (같은 키 그룹에 다른 sku_id)",
    R2_generation_missing: "R2. 세대 누락 (제목엔 X세대인데 키엔 없음)",
    R3_parser_unknown: "R3. parser 옵션 누락 (unknown_*)",
    R4_outlier_distortion: "R4. outlier 시세 왜곡 (p75/p25 큰데 sample 작음)",
    R5_fallback_mismatch: "R5. fallback 의심 (sku_median vs daily 큰 차이)",
  }[rule] ?? rule;
  lines.push(`- ${label}: **${count}건**`);
}
lines.push("");
lines.push("## SKU별 issue 매물 카운트 (top 15)");
lines.push("");
for (const [sku, count] of [...skuIssueCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  lines.push(`- \`${sku}\`: ${count}건`);
}
lines.push("");
lines.push("---");
lines.push("");
lines.push("## issue 매물 상세 (severity high 우선)");
lines.push("");
const sortedIssues = issues.sort((a, b) => {
  const ah = a.rules.filter((r) => r.severity === "high").length;
  const bh = b.rules.filter((r) => r.severity === "high").length;
  return bh - ah;
});
for (const issue of sortedIssues.slice(0, 30)) {
  lines.push(`### pid ${issue.pid} — ${issue.name?.slice(0, 60) ?? ""}`);
  lines.push(`- sku: \`${issue.sku_id}\` (${issue.sku_name ?? "—"}) · 매입 ₩${issue.price?.toLocaleString()} · sku_median ₩${issue.sku_median?.toLocaleString()}`);
  lines.push(`- comparable_key: \`${issue.comparable_key}\``);
  lines.push(`- 비교 매물 ${issue.compRowCount}건`);
  for (const rule of issue.rules) {
    lines.push(`  - **${rule.severity === "high" ? "🔴" : "🟡"} ${rule.rule}**: ${rule.detail}`);
  }
  lines.push(`- 번장: https://m.bunjang.co.kr/products/${issue.pid}`);
  lines.push("");
}

const md = lines.join("\n");
const json = { generated_at: new Date().toISOString(), checked: poolPids.length, issues_found: issues.length, ruleCount: Object.fromEntries(ruleCount), skuIssueCount: Object.fromEntries(skuIssueCount), issues };
await writeFile(path.join(appDir, "reports/patrol-pool-quality-latest.md"), md);
await writeFile(path.join(appDir, "reports/patrol-pool-quality-latest.json"), JSON.stringify(json, null, 2));

console.log(`\n→ reports/patrol-pool-quality-latest.{md,json}`);
console.log(`\n총 ${issues.length}/${poolPids.length} 매물 issue 발견. 룰별:`);
for (const [rule, count] of [...ruleCount.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${rule}: ${count}건`);
}
