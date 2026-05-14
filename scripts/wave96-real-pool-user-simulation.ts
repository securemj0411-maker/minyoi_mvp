// Wave 96: 실 candidate_pool 매물 검수 시뮬레이션.
// 1주 대기 없이, 지금 ready 풀에 박혀있는 매물 529건을 사용자 관점에서 평가.
//
// 검수 metric (per 매물):
//   - 가격 vs 시세 median (저렴/적정/비싼)
//   - 시세 outlier (±3σ 밖)
//   - 위험 신호 (가품/부품/사고 패턴 in title)
//   - 판매 상태 (active vs sold/disappeared)
//   - description preview 분석 (가품 anxiety / 손상)
//
// 출력: SKU별 안전 비율 + 위험 매물 샘플 + 사용자 추천 가능 비율

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// Wave 94/95에서 발견한 패턴들 + 추가 위험 신호
// Wave 96 v2: regex를 strict하게 (false positive 줄임).
// 명시적 "단품/만/단독" 종결 패턴만 reject. 본품 + 액세서리 포함 매물은 OK.
const RISK_PATTERNS = {
  fake_anxiety: /정품\s*보증\s*X|감정\s*가능|감정\s*문의|정가품\s*문의|레플리카|st급|미러급|특\s*a\s*급|sa\s*급|이미테이션|복각|오라리/i,
  parts_only: /한짝|왼발만|오른발만|박스만|더스트백만|스트랩만|영수증만|프레임만|포크만|휠셋만|안장만|배터리만|충전기만|렌즈만|핸들바\s*단품|순정휠셋\s*단품|유닛\s*단품|왼쪽\s*유닛|오른쪽\s*유닛/,
  damage: /파손\s*심함|크랙|찢어짐|구멍|얼룩\s*심함|변색\s*심함|곰팡이|악취\s*심함|수리\s*필요|침수|배터리\s*불량/,
  case_only: /케이스만|보호\s*케이스\s*만|에어팟\s*케이스\s*단품|버즈\s*케이스\s*단품|케이스\s*1회\s*사용/,
  accessory_only: /거치대\s*만|스탠드\s*만|마운트\s*만|악세사리\s*단품|소모품\s*세트|필터\s*만|브러시\s*만|충전기\s*만/,
  buying_intent: /^삽니다|^구합니다|구매원함|구매원합니다|매입\s*합니다|최고가\s*매입/,
  fraud: /전문사기조직|사기조직|사기\s*신고|사기꾼|먹튀\s*경고/i,
};

type PoolRow = {
  pid: number;
  profit_band: number;
  category: string | null;
  comparable_key: string | null;
  score: number;
  confidence: number;
  status: string;
};

type RawRow = {
  pid: number;
  name: string;
  price: number;
  description_preview: string;
  sku_id: string | null;
  sku_name: string | null;
  listing_state: string;
  sale_status: string;
};

type MarketRow = {
  comparable_key: string;
  blended_median_price: number | null;
  active_median_price: number | null;
  p25_price: number | null;
  p75_price: number | null;
  active_sample_count: number;
};

type Verdict = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  category: string | null;
  price: number;
  title: string;
  median: number | null;
  priceVsMedianPct: number | null;
  listingState: string;
  saleStatus: string;
  riskFlags: string[];
  pricePosition: "below" | "in_range" | "above" | "outlier_low" | "outlier_high" | "unknown";
  userSafeRating: "good" | "ok" | "risky" | "very_risky";
  reasoning: string;
};

async function loadJsonAll<T>(baseUrl: string, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const url = `${baseUrl}&offset=${offset}&limit=${pageSize}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const chunk = (await res.json()) as T[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

async function main() {
  console.log("Wave 96 실 풀 시뮬레이션 — 사용자 추천 대상 매물 직접 검수\n");

  // 1. candidate_pool ready 매물
  const pool = await loadJsonAll<PoolRow>(`${tableUrl("mvp_candidate_pool")}?select=pid,profit_band,category,comparable_key,score,confidence,status&status=eq.ready`);
  console.log(`pool ready 매물: ${pool.length}건`);

  // 2. raw_listings 정보 (pid in pool)
  const pids = pool.map((p) => p.pid);
  const pidChunks: number[][] = [];
  for (let i = 0; i < pids.length; i += 100) pidChunks.push(pids.slice(i, i + 100));
  const rawAll: RawRow[] = [];
  for (const chunk of pidChunks) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,price,description_preview,sku_id,sku_name,listing_state,sale_status&pid=in.(${chunk.join(",")})`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    rawAll.push(...(await res.json() as RawRow[]));
  }
  const rawByPid = new Map(rawAll.map((r) => [r.pid, r]));
  console.log(`raw 정보 로드: ${rawAll.length}건`);

  // 3. 시세 정보 (comparable_key)
  const keys = [...new Set(pool.map((p) => p.comparable_key).filter((k): k is string => Boolean(k)))];
  const keyChunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 50) keyChunks.push(keys.slice(i, i + 50));
  const marketAll: MarketRow[] = [];
  for (const chunk of keyChunks) {
    const encoded = chunk.map((k) => encodeURIComponent(k)).join(",");
    const url = `${tableUrl("mvp_market_price_daily")}?select=comparable_key,blended_median_price,active_median_price,p25_price,p75_price,active_sample_count&comparable_key=in.(${encoded})&order=date.desc,computed_at.desc&limit=${chunk.length * 5}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    marketAll.push(...(await res.json() as MarketRow[]));
  }
  const marketByKey = new Map<string, MarketRow>();
  for (const m of marketAll) {
    if (!marketByKey.has(m.comparable_key)) marketByKey.set(m.comparable_key, m);
  }
  console.log(`시세 정보 로드: ${marketByKey.size}개 comparable_key\n`);

  // 4. 매물별 검수
  const verdicts: Verdict[] = [];
  for (const p of pool) {
    const raw = rawByPid.get(p.pid);
    if (!raw) continue;
    const m = p.comparable_key ? marketByKey.get(p.comparable_key) : undefined;
    const median = m?.blended_median_price ?? m?.active_median_price ?? null;
    const priceVsMedianPct = median != null && median > 0 ? Math.round((raw.price / median) * 1000) / 10 : null;

    // 위험 신호
    const text = `${raw.name}\n${raw.description_preview ?? ""}`;
    const flags: string[] = [];
    for (const [k, re] of Object.entries(RISK_PATTERNS)) {
      if (re.test(text)) flags.push(k);
    }
    if (raw.listing_state === "sold" || raw.listing_state === "disappeared") flags.push("terminal_state");

    // 가격 포지션
    let pricePosition: Verdict["pricePosition"] = "unknown";
    if (median != null && m?.p25_price != null && m?.p75_price != null) {
      if (raw.price < median * 0.3) pricePosition = "outlier_low";
      else if (raw.price > median * 3) pricePosition = "outlier_high";
      else if (raw.price < m.p25_price) pricePosition = "below";
      else if (raw.price > m.p75_price) pricePosition = "above";
      else pricePosition = "in_range";
    }

    // 사용자 안전 평가
    let userSafeRating: Verdict["userSafeRating"];
    let reasoning = "";
    if (flags.includes("fraud") || flags.includes("fake_anxiety")) {
      userSafeRating = "very_risky"; reasoning = "가품/사기 의심 표현";
    } else if (flags.includes("parts_only") || flags.includes("case_only") || flags.includes("accessory")) {
      userSafeRating = "very_risky"; reasoning = "본품 아닌 부품/케이스/액세서리 의심";
    } else if (flags.includes("damage")) {
      userSafeRating = "risky"; reasoning = "손상 매물";
    } else if (flags.includes("terminal_state")) {
      userSafeRating = "risky"; reasoning = "이미 팔린 매물";
    } else if (pricePosition === "outlier_low" || pricePosition === "outlier_high") {
      userSafeRating = "risky"; reasoning = "가격 outlier (시세 대비 비정상)";
    } else if (flags.includes("buying_intent")) {
      userSafeRating = "risky"; reasoning = "구매 의도 매물 (셀러 아님)";
    } else if (pricePosition === "below" || pricePosition === "in_range") {
      userSafeRating = "good"; reasoning = `시세 ${pricePosition === "below" ? "저렴" : "적정"}`;
    } else if (pricePosition === "above") {
      userSafeRating = "ok"; reasoning = "시세보다 약간 비쌈";
    } else {
      userSafeRating = "ok"; reasoning = "시세 정보 부족";
    }

    verdicts.push({
      pid: p.pid, sku_id: raw.sku_id, sku_name: raw.sku_name, category: p.category,
      price: raw.price, title: raw.name, median, priceVsMedianPct,
      listingState: raw.listing_state, saleStatus: raw.sale_status,
      riskFlags: flags, pricePosition, userSafeRating, reasoning,
    });
  }

  // 5. 집계
  const byRating = { good: 0, ok: 0, risky: 0, very_risky: 0 };
  for (const v of verdicts) byRating[v.userSafeRating] += 1;
  console.log("=== 사용자 안전도 평가 ===");
  console.log(`총 ${verdicts.length}건 ready 매물:`);
  console.log(`  ✅ good        ${byRating.good}건 (${Math.round(byRating.good/verdicts.length*1000)/10}%)`);
  console.log(`  🟢 ok          ${byRating.ok}건 (${Math.round(byRating.ok/verdicts.length*1000)/10}%)`);
  console.log(`  ⚠️ risky       ${byRating.risky}건 (${Math.round(byRating.risky/verdicts.length*1000)/10}%)`);
  console.log(`  🚨 very_risky  ${byRating.very_risky}건 (${Math.round(byRating.very_risky/verdicts.length*1000)/10}%)`);

  // 카테고리별
  console.log("\n=== 카테고리별 안전도 ===");
  const cats = [...new Set(verdicts.map((v) => v.category).filter(Boolean))] as string[];
  for (const cat of cats) {
    const ca = verdicts.filter((v) => v.category === cat);
    const safe = ca.filter((v) => v.userSafeRating === "good" || v.userSafeRating === "ok").length;
    const risk = ca.filter((v) => v.userSafeRating === "risky" || v.userSafeRating === "very_risky").length;
    console.log(`  ${cat.padEnd(18)}: ${ca.length}건 (안전 ${safe} / 위험 ${risk}, 위험율 ${Math.round(risk/ca.length*1000)/10}%)`);
  }

  // 위험 매물 샘플
  console.log("\n=== 🚨 VERY_RISKY 매물 (사용자 추천 위험) ===");
  const dangerous = verdicts.filter((v) => v.userSafeRating === "very_risky");
  for (const v of dangerous.slice(0, 20)) {
    console.log(`  [${v.sku_id}] ₩${v.price.toLocaleString()} ${v.riskFlags.join(",")} "${v.title.slice(0, 60)}"`);
  }
  if (dangerous.length > 20) console.log(`  ... (${dangerous.length - 20}개 더)`);

  console.log("\n=== ⚠️ RISKY 매물 (사용자 추천 주의) ===");
  const risky = verdicts.filter((v) => v.userSafeRating === "risky");
  for (const v of risky.slice(0, 15)) {
    const medianStr = v.median ? `시세 ₩${v.median.toLocaleString()}` : "시세 ?";
    console.log(`  [${v.sku_id}] ₩${v.price.toLocaleString()} (${medianStr}, ${v.pricePosition}) "${v.title.slice(0, 55)}"`);
  }
  if (risky.length > 15) console.log(`  ... (${risky.length - 15}개 더)`);

  await writeFile(
    path.join(appDir, "reports/wave96-real-pool-simulation-latest.json"),
    JSON.stringify({
      wave: 96,
      measured_at: new Date().toISOString(),
      total_pool_ready: pool.length,
      verdicts_count: verdicts.length,
      by_rating: byRating,
      by_category: cats.map((c) => {
        const ca = verdicts.filter((v) => v.category === c);
        return {
          category: c,
          total: ca.length,
          good: ca.filter((v) => v.userSafeRating === "good").length,
          ok: ca.filter((v) => v.userSafeRating === "ok").length,
          risky: ca.filter((v) => v.userSafeRating === "risky").length,
          very_risky: ca.filter((v) => v.userSafeRating === "very_risky").length,
        };
      }),
      verdicts,
    }, null, 2),
  );
  console.log(`\n→ reports/wave96-real-pool-simulation-latest.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
