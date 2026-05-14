// Wave 90 (2026-05-15): 사용자 reveal feedback 일괄 조회 도구.
// 사용자가 pack-reveal-modal에서 매물별 검증 메모 (note) 다 작성하면,
// 이 스크립트로 전체 코멘트를 일괄 fetch → 매물 정보 + 시세 근거 + 사용자 코멘트
// 결합한 markdown report 출력. AI agent가 한 번에 읽고 검증 가능.
//
// 사용: npm run review:user-feedback [-- --since=2026-05-15] [-- --limit=200]

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

async function fetchJson(pathname) {
  const url = `${restUrl()}${pathname}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`${res.status} ${url}\n${await res.text()}`);
  return res.json();
}

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

const since = arg("since", null);
const limit = Math.max(10, Math.min(2000, Number(arg("limit", "500"))));
const userRefFilter = arg("user", null);

console.log(`[1/4] fetching reveal_feedback (note != '', limit=${limit}${since ? `, since=${since}` : ""}${userRefFilter ? `, user=${userRefFilter}` : ""})...`);

let query = `/mvp_reveal_feedback?select=id,user_ref,pid,feedback_type,note,created_at,updated_at&note=neq.&order=updated_at.desc&limit=${limit}`;
if (since) query += `&updated_at=gte.${encodeURIComponent(since)}`;
if (userRefFilter) query += `&user_ref=eq.${encodeURIComponent(userRefFilter)}`;

const feedbacks = await fetchJson(query);
console.log(`  → ${feedbacks.length}건 feedback (note 있음)`);

if (feedbacks.length === 0) {
  console.log("\n(코멘트 작성된 매물 없음)");
  process.exit(0);
}

const pids = [...new Set(feedbacks.map((f) => Number(f.pid)).filter(Number.isFinite))];
console.log(`[2/4] joining listing + parsed + market data for ${pids.length} unique pids...`);

const pidChunks = [];
for (let i = 0; i < pids.length; i += 100) pidChunks.push(pids.slice(i, i + 100));

const listingMap = new Map();
const parsedMap = new Map();
const rawMap = new Map();
const marketMap = new Map();

for (const chunk of pidChunks) {
  const ids = chunk.join(",");
  const [lis, par, raw] = await Promise.all([
    fetchJson(`/mvp_listings?select=pid,name,price,sku_name,sku_median&pid=in.(${ids})`),
    fetchJson(`/mvp_listing_parsed?select=pid,comparable_key,parse_confidence,needs_review&pid=in.(${ids})`),
    fetchJson(`/mvp_raw_listings?select=pid,sku_id,thumbnail_url,sale_status,listing_state,last_seen_at,query&pid=in.(${ids})`),
  ]);
  for (const r of lis) listingMap.set(Number(r.pid), r);
  for (const r of par) parsedMap.set(Number(r.pid), r);
  for (const r of raw) rawMap.set(Number(r.pid), r);
}

const compKeys = [...new Set([...parsedMap.values()].map((p) => p?.comparable_key).filter(Boolean))];
console.log(`[3/4] fetching market_price_daily for ${compKeys.length} comparable_keys...`);

const compChunks = [];
for (let i = 0; i < compKeys.length; i += 50) compChunks.push(compKeys.slice(i, i + 50));
for (const chunk of compChunks) {
  const filter = chunk.map((k) => `"${k}"`).join(",");
  const rows = await fetchJson(`/mvp_market_price_daily?select=comparable_key,blended_median_price,active_median_price,p25_price,p75_price,active_sample_count,sold_sample_count,confidence,computed_at&comparable_key=in.(${encodeURIComponent(filter)})&order=computed_at.desc`);
  for (const r of rows) {
    if (!marketMap.has(r.comparable_key)) marketMap.set(r.comparable_key, r);
  }
}

console.log(`[4/4] generating report...`);

const reportLines = [];
const krw = (v) => (v == null ? "—" : `₩${Number(v).toLocaleString("ko-KR")}`);

const FEEDBACK_LABEL = {
  interested: "👀 관심",
  bought: "💰 매수함",
  missed_sold: "😭 놓침",
  bad_pick: "👎 잘못된 추천",
  watching: "🔍 검증중",
};

reportLines.push("# 사용자 reveal feedback 일괄 검토");
reportLines.push("");
reportLines.push(`- generated_at: ${new Date().toISOString()}`);
reportLines.push(`- feedback rows: ${feedbacks.length}`);
reportLines.push(`- unique pids: ${pids.length}`);
if (since) reportLines.push(`- since: ${since}`);
if (userRefFilter) reportLines.push(`- user_ref filter: ${userRefFilter}`);
reportLines.push("");
reportLines.push("---");
reportLines.push("");

// 매물별 출력
let idx = 0;
for (const fb of feedbacks) {
  idx += 1;
  const pid = Number(fb.pid);
  const listing = listingMap.get(pid) || {};
  const parsed = parsedMap.get(pid) || {};
  const raw = rawMap.get(pid) || {};
  const compKey = parsed.comparable_key || null;
  const market = compKey ? marketMap.get(compKey) : null;

  reportLines.push(`## ${idx}. pid ${pid} — ${listing.name || raw.name || "(name 없음)"}`);
  reportLines.push("");
  reportLines.push(`- **사용자 코멘트**: ${fb.note}`);
  reportLines.push(`- feedback type: ${FEEDBACK_LABEL[fb.feedback_type] || fb.feedback_type}`);
  reportLines.push(`- updated_at: ${fb.updated_at}`);
  reportLines.push(`- 번장: https://m.bunjang.co.kr/products/${pid}`);
  reportLines.push("");
  reportLines.push("**매물 정보:**");
  reportLines.push(`- 매입가: ${krw(listing.price)}`);
  reportLines.push(`- 시세 (sku_median 저장값): ${krw(listing.sku_median)}`);
  reportLines.push(`- SKU: \`${raw.sku_id || "—"}\` (${listing.sku_name || "—"})`);
  reportLines.push(`- comparable_key: \`${compKey || "—"}\``);
  reportLines.push(`- parse confidence: ${parsed.parse_confidence != null ? (parsed.parse_confidence * 100).toFixed(0) + "%" : "—"}${parsed.needs_review ? " ⚠️ needs_review" : ""}`);
  reportLines.push(`- 상태: ${raw.sale_status || "—"} / listing_state ${raw.listing_state || "—"}`);
  reportLines.push(`- query: \`${raw.query || "—"}\``);
  if (market) {
    reportLines.push("");
    reportLines.push("**market_price_daily (집계):**");
    reportLines.push(`- blended median: ${krw(market.blended_median_price)}, active median: ${krw(market.active_median_price)}`);
    reportLines.push(`- p25 ${krw(market.p25_price)} · p75 ${krw(market.p75_price)}`);
    reportLines.push(`- active ${market.active_sample_count}건 / sold ${market.sold_sample_count}건 / confidence ${market.confidence || "—"}`);
    reportLines.push(`- computed_at: ${market.computed_at}`);
  } else if (compKey) {
    reportLines.push("");
    reportLines.push("⚠️ market_price_daily 집계 없음 (comparable_key는 있으나 daily aggregate 부재)");
  }
  reportLines.push("");
  reportLines.push("---");
  reportLines.push("");
}

// feedback_type별 요약
const typeCount = new Map();
for (const fb of feedbacks) typeCount.set(fb.feedback_type, (typeCount.get(fb.feedback_type) || 0) + 1);

reportLines.push("## 요약");
reportLines.push("");
for (const [type, count] of typeCount) {
  reportLines.push(`- ${FEEDBACK_LABEL[type] || type}: ${count}건`);
}

const reportMd = reportLines.join("\n");
const reportJson = {
  generated_at: new Date().toISOString(),
  total: feedbacks.length,
  pids,
  feedbacks: feedbacks.map((fb) => {
    const pid = Number(fb.pid);
    const listing = listingMap.get(pid) || {};
    const parsed = parsedMap.get(pid) || {};
    const raw = rawMap.get(pid) || {};
    const compKey = parsed.comparable_key || null;
    return {
      ...fb,
      pid,
      listing,
      parsed,
      raw,
      market: compKey ? marketMap.get(compKey) || null : null,
    };
  }),
};

const reportsDir = path.join(appDir, "reports");
await writeFile(path.join(reportsDir, "user-feedback-review-latest.md"), reportMd);
await writeFile(path.join(reportsDir, "user-feedback-review-latest.json"), JSON.stringify(reportJson, null, 2));

console.log("\n→ reports/user-feedback-review-latest.md");
console.log("→ reports/user-feedback-review-latest.json");
console.log(`\n총 ${feedbacks.length}건 검토 완료. AI 에이전트가 위 markdown 보고서 읽으면 일괄 검증 가능.`);
