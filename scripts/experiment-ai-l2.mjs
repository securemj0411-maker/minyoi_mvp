/**
 * experiment-ai-l2.mjs
 *
 * AI L2 정책 v1 결정용 1회성 실험.
 *  - 4 broad lane × ~150건씩 후보 수집 → rule 기반 trigger flag 계산
 *  - gpt-4o-mini 로 L2 분류 (production target)
 *  - gpt-4o 로 무작위 100건 비교
 *  - flag/category별 overturn / false_hold / cost / p95 latency 산출
 *
 * 실행:
 *   node scripts/experiment-ai-l2.mjs              # 전체 실행 (mine + classify)
 *   node scripts/experiment-ai-l2.mjs --skip-mine  # 캐시된 후보로 재분류만
 *   node scripts/experiment-ai-l2.mjs --dry-run    # AI 호출 없이 dataset/flag만 산출
 *   node scripts/experiment-ai-l2.mjs --limit=20   # lane당 N건으로 축소
 *
 * 산출물:
 *   reports/ai-l2-experiment-<date>.json
 *   reports/ai-l2-candidates-cache.json (mine 결과 캐시)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const cachePath = path.join(reportsDir, "ai-l2-candidates-cache.json");
const intelligenceDir = path.join(appDir, "category-intelligence");

// ─── env ────────────────────────────────────────────────────────────────────
loadDotEnv();
function loadDotEnv() {
  const envPath = path.join(appDir, ".env.local");
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] != null) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("OPENAI_API_KEY missing in .env.local");
  process.exit(1);
}

// gpt-4o-mini pricing (USD per 1M tokens) — 2024-07 schedule.
// caching: input cached @ $0.075/1M; non-cached @ $0.15/1M; output @ $0.60/1M.
const PRICE = {
  "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.60 },
  "gpt-4o": { input: 2.5, cached: 1.25, output: 10.0 },
};

// ─── CLI ────────────────────────────────────────────────────────────────────
function argValue(name, fallback) {
  for (const arg of process.argv) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return fallback;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

const LIMIT_PER_LANE = Number(argValue("--limit", 150));
const COMPARE_N = Number(argValue("--compare", 100));
const CONCURRENCY = Number(argValue("--concurrency", 4));
const SKIP_MINE = hasFlag("--skip-mine");
const DRY_RUN = hasFlag("--dry-run");

// ─── Bunjang search/detail (mining 용) ───────────────────────────────────────
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchPage(query, page) {
  const url = new URL("https://api.bunjang.co.kr/api/1/find_v2.json");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "score");
  url.searchParams.set("page", String(page));
  url.searchParams.set("n", "30");
  url.searchParams.set("stat_device", "w");
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.list ?? [])
      .map((it) => ({
        pid: String(it.pid ?? ""),
        name: String(it.name ?? ""),
        price: Number(it.price ?? 0) || 0,
        numFaved: Number(it.num_faved ?? 0) || 0,
        freeShipping: it.free_shipping === true || it.free_shipping === "1",
        query,
      }))
      .filter((it) => it.pid && it.price > 0);
  } catch {
    return [];
  }
}

async function fetchDetail(pid) {
  const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const j = await res.json();
    const product = j?.data?.product ?? {};
    return {
      description: String(product.description ?? "").slice(0, 900),
      saleStatus: String(product.saleStatus ?? ""),
    };
  } catch {
    return null;
  }
}

// ─── Lane config ────────────────────────────────────────────────────────────
const LANES = {
  smartphone_broad: {
    source: { type: "local", file: "smartphone/samples.json" },
    category: "smartphone",
  },
  laptop_broad: {
    source: { type: "local", file: "laptop/samples.json" },
    category: "laptop",
  },
  headphone_broad: {
    source: {
      type: "mine",
      queries: ["헤드폰", "소니 헤드폰", "보스 헤드폰", "젠하이저 헤드폰", "오디오테크니카 헤드폰"],
      pages: 3,
    },
    category: "headphone",
  },
  desktop_custom_build: {
    source: {
      type: "mine",
      queries: ["조립 PC", "커스텀 PC", "게이밍 데스크탑", "RTX 4070 데스크탑", "데스크탑 자작"],
      pages: 3,
    },
    category: "desktop",
  },
};

async function loadLaneCandidates(lane, cfg) {
  if (cfg.source.type === "local") {
    const raw = await readFile(path.join(intelligenceDir, cfg.source.file), "utf8");
    const arr = JSON.parse(raw);
    return arr
      .filter((x) => x && x.pid && x.name && x.price > 0)
      .map((x) => ({
        pid: String(x.pid),
        name: x.name,
        price: x.price,
        numFaved: x.numFaved ?? 0,
        freeShipping: x.freeShipping ?? false,
        description: String(x.description ?? "").slice(0, 900),
        query: x.query ?? "",
        lane,
      }));
  }
  // mine
  const byPid = new Map();
  for (const q of cfg.source.queries) {
    for (let p = 0; p < cfg.source.pages; p++) {
      const items = await searchPage(q, p);
      for (const it of items) if (!byPid.has(it.pid)) byPid.set(it.pid, it);
      await sleep(140);
    }
  }
  // 룰 classify=normal 후 LIMIT_PER_LANE 보장하려고 raw 2.5x 버퍼.
  const cap = Math.min(byPid.size, Math.ceil(LIMIT_PER_LANE * 2.5));
  const list = [...byPid.values()].slice(0, cap);
  console.log(`    ${lane} search raw=${byPid.size} → enriching ${list.length}`);
  const out = [];
  let cursor = 0;
  const detailConcurrency = 4;
  async function detailWorker() {
    while (out.filter((x) => ruleClassify(x) === "normal").length < LIMIT_PER_LANE) {
      const idx = cursor++;
      if (idx >= list.length) return;
      const it = list[idx];
      const detail = await fetchDetail(it.pid);
      await sleep(100);
      if (!detail) continue;
      out.push({ ...it, description: detail.description, lane });
      if (out.length % 25 === 0) console.log(`    ${lane} detail: ${out.length} fetched (normal=${out.filter((x) => ruleClassify(x) === "normal").length})`);
    }
  }
  await Promise.all(Array.from({ length: detailConcurrency }, () => detailWorker()));
  return out;
}

// ─── Rule classifier (pipeline.ts에서 포팅, broad lane용으로 축약) ─────────────
const BUYING_KEYWORDS = ["구합니다", "구해요", "삽니다", "급구", "매입", "최고가", "전국출장", "구매합니다", "매입전문", "매입업체", "출장매입", "매입합니다", "매입문의"];
const CALLOUT_KEYWORDS = ["사지마세요", "사기당함", "사기꾼", "저격", "도용", "짝퉁", "조심", "타오바오", "taobao", "짭", "가품", "레플", "레플리카", "이미테이션", "정품아님", "비정품"];
const PARTS_KEYWORDS = ["부품용", "본체만", "유닛만", "좌측", "우측", "한쪽", "한짝", "한 쪽", "한알", "낱개", "단품", "케이스만", "충전케이스만", "충전 케이스만", "액정만", "배터리만", "교체용", "호환"];
const DAMAGED_KEYWORDS = ["고장", "작동안됨", "안켜짐", "먹통", "충전안됨", "충전 안됨", "충전이 안됨", "툭툭", "끊김", "잡음", "수리이력", "찍힘 심", "기스 심", "액정깨짐", "잠김", "초기화불가", "배터리 광탈", "방전", "잔상", "번인", "터치불량", "카메라불량", "유심인식불량", "침수", "분실폰", "도난폰", "아이클라우드 잠김"];
const ACCESSORY_TITLE_KEYWORDS = ["스트랩", "밴드", "파우치", "키링", "거치대", "충전기", "어댑터", "필름", "강화유리", "커버", "악세사리", "악세서리", "이어팁", "보호캡", "메탈밴드", "보호필름"];
const MULTI_KEYWORDS = ["일괄", "묶음", "각각", "선택", "여러개", "재고"];
const COMMERCIAL_STRONG_KEYWORDS = ["재고정리", "재고 정리", "선착순특가", "선착순 특가", "한정판매", "마지막입고", "완납폰", "제휴카드", "유심 그대로", "유심그대로", "재고확인", "전색상", "재입고", "품절임박", "대량구매", "매장방문", "중고폰 구매"];
const COMMERCIAL_WEAK_KEYWORDS = ["통신사 특가", "신규개통", "번호이동", "개통 조건", "2년 약정", "자급제 신규", "선착순"];
const NORMAL_SIGNALS = ["미개봉", "새상품", "풀박스", "풀구성", "풀세트", "정상작동", "정상 작동", "기능 정상", "문제없", "정품", "시리얼", "구매내역", "구매 영수증", "상자", "박스", "구성품", "양쪽", "노이즈 캔슬링", "노캔", "상태양호", "상태 양호"];
const SHORT_TITLE_MIN = 9;

function nrm(s) {
  return String(s ?? "").toLowerCase().replace(/[ \s]+/g, " ").trim();
}
function containsAny(text, kws) {
  const n = nrm(text);
  return kws.filter((k) => n.includes(nrm(k)));
}
function compactLen(text) {
  return String(text ?? "").replace(/\s+/g, "").length;
}
function hasNormalSignal(title, desc) {
  return containsAny(`${title}\n${desc}`, NORMAL_SIGNALS).length > 0;
}
function suspiciousModelText(title, desc) {
  const text = nrm(`${title}\n${desc}`).replace(/\s+/g, "");
  // airpods pro 3/4 등 존재하지 않는/안 나온 세대 표기
  return /에어팟프로[34]|airpodspro[34]/i.test(text);
}
function multiModelHits(title) {
  const raw = String(title ?? "").toLowerCase();
  const normalized = nrm(title);
  const compact = normalized.replace(/\s+/g, "");
  const hasChoiceSeparator = /[/|,·+]|또는|선택|중에|중 택|중택|가격\s*상이|가격상이/.test(raw);
  if (!hasChoiceSeparator) return [];
  const hits = [];
  const add = (h) => { if (!hits.includes(h)) hits.push(h); };
  if (compact.includes("에어팟맥스") || normalized.includes("airpods max")) add("airpods_max");
  if (compact.includes("에어팟프로") || normalized.includes("airpods pro")) add("airpods_pro");
  if (/(에어팟|airpods).{0,6}(2세대|2nd)|에어팟2/.test(normalized)) add("airpods_2");
  if (/(에어팟|airpods).{0,6}(3세대|3rd)|에어팟3/.test(normalized)) add("airpods_3");
  if (/(에어팟|airpods).{0,6}(4세대|4th)|에어팟4/.test(normalized)) add("airpods_4");
  if (compact.includes("애플워치울트라") || normalized.includes("applewatch ultra")) add("applewatch_ultra");
  for (const n of ["7", "8", "9", "10", "11"]) {
    if (new RegExp(`애플워치(?:시리즈)?${n}|시리즈${n}|series${n}|applewatch${n}`).test(compact)) add(`applewatch_${n}`);
  }
  // 라인업 폭이 큰 broad lane용 일반 model-token 카운트: 갤럭시 S/노트/폴드 세대 충돌
  const galaxyHits = [];
  for (const n of ["20", "21", "22", "23", "24", "25", "26"]) {
    if (new RegExp(`갤럭시\\s*s${n}|s${n}\\s*울트라|s${n}\\s*플러스`).test(normalized)) galaxyHits.push(`galaxy_s${n}`);
  }
  if (galaxyHits.length >= 2) galaxyHits.forEach(add);
  // 아이폰 세대 충돌
  const iphoneHits = [];
  for (const n of ["12", "13", "14", "15", "16", "17"]) {
    if (new RegExp(`아이폰\\s*${n}|iphone\\s*${n}`).test(normalized)) iphoneHits.push(`iphone_${n}`);
  }
  if (iphoneHits.length >= 2) iphoneHits.forEach(add);
  return hits.length >= 2 ? hits : [];
}

// 룰 분류 결과 ("normal" 이외에는 이미 노이즈로 떨어짐). 측정 대상은 normal로 통과한 것들 중
// score-flag가 켜진 후보.
function ruleClassify(item) {
  const { name: title, description: desc = "", price } = item;
  const text = `${title}\n${desc}`;
  if (containsAny(title, BUYING_KEYWORDS).length > 0) return "buying";
  if (price <= 0 || price < 5000) return "callout";
  if (containsAny(text, CALLOUT_KEYWORDS).length > 0) return "callout";
  if (containsAny(text, COMMERCIAL_STRONG_KEYWORDS).length > 0) return "commercial";
  if (containsAny(text, PARTS_KEYWORDS).length > 0) return "parts";
  if (containsAny(text, DAMAGED_KEYWORDS).length > 0) return "damaged";
  if (containsAny(title, ACCESSORY_TITLE_KEYWORDS).length > 0) return "accessory";
  const multi = containsAny(title, MULTI_KEYWORDS);
  if (/\b[2-9]\s*개\b/.test(title)) multi.push("N개");
  multi.push(...multiModelHits(title));
  if (multi.length > 0) return "multi";
  if (compactLen(title) < SHORT_TITLE_MIN && !hasNormalSignal(title, desc)) return "unknown";
  return "normal";
}

function median(values) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
function percentile(values, p) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

function computeFlags(item, laneMedian) {
  const { name: title, description: desc = "", price } = item;
  const text = `${title}\n${desc}`;
  const priceGap = laneMedian > 0 ? Math.max(0, Math.min(1, (laneMedian - price) / laneMedian)) : 0;

  const flags = [];
  if (priceGap >= 0.75) flags.push("extreme_discount_review");
  if (priceGap >= 0.55) flags.push("deep_discount_review");
  if (suspiciousModelText(title, desc)) flags.push("suspicious_model_review");
  if (multiModelHits(title).length > 0) flags.push("multi_model_review");
  if (compactLen(title) < SHORT_TITLE_MIN && !hasNormalSignal(title, desc)) flags.push("short_title");
  if (!hasNormalSignal(title, desc)) flags.push("weak_normal_signal");
  if (containsAny(text, COMMERCIAL_WEAK_KEYWORDS).length > 0) flags.push("commercial_review");

  return { priceGap, flags };
}

// ─── AI L2 분류 ─────────────────────────────────────────────────────────────
// 시스템 프롬프트 길게 유지해서 OpenAI prompt caching 활용 (≥1024 tokens 자동 캐싱)
const SYSTEM_PROMPT = `You classify Korean second-hand marketplace listings (bunjang) for resale safety. Return strict JSON ONLY.

Output schema:
{
  "listing_type": "normal" | "counterfeit" | "parts" | "buying" | "callout" | "damaged" | "accessory" | "multi" | "commercial" | "unknown",
  "confidence": "high" | "medium" | "low",
  "reason": "<one short Korean sentence>",
  "risk_keywords": ["..."]
}

Definitions:
- normal: a single, working, complete item being sold by an individual at a believable price.
- counterfeit: 가품, 짝퉁, 레플리카, 타오바오, 정품아님. classify as counterfeit even if price seems normal.
- parts: 본체만, 케이스만, 좌측/우측 유닛만, 부품용, 액정만, 배터리만, 충전기만. Anything that is not the full functional product.
- buying: 매입/구합니다/삽니다/최고가 등 매입글. 판매가 아님.
- callout: 사지마세요/사기꾼 저격글, 또는 가격 5000원 미만 같은 비정상 가격.
- damaged: 고장, 작동안됨, 액정깨짐, 침수, 분실폰, 도난폰, 잠김, 배터리 광탈, 노캔 안됨, 잡음.
- accessory: 스트랩/밴드/케이스/파우치/필름/충전기 단독 판매 (본체 미포함).
- multi: 한 게시글에 여러 SKU/세대/모델을 옵션으로 묶어 파는 것. 가격 상이 / "택1" / 슬래시·콤마로 모델 나열.
- commercial: 업자/대리점성 게시글. 재고정리, 선착순특가, 완납폰, 통신사 특가, 제휴카드, 유심 그대로, "전색상 입고", 매장방문 안내, 신규개통/번호이동 유도. 가격이 정상 분포에 들어가더라도 BM에서 제거해야 함.
- unknown: 위 어느 것에도 안정적으로 매핑 못하는 짧고 모호한 제목/설명.

Confidence:
- high: 텍스트에 결정적 단서가 1개 이상 있음.
- medium: 약한 단서들 누적 또는 가격/시그널이 정상이지만 의심.
- low: 텍스트가 짧거나 양쪽 해석이 모두 가능.

Decision policy (be conservative — false positive on hold is acceptable, false positive on normal is not):
- 가격이 시장가의 절반 이하이고 "정상 작동/풀박" 같은 normal signal이 전혀 없으면 → 최소 medium의 unknown 또는 damaged.
- 제목/설명에 통신사/완납/제휴/유심 그대로 류 단어 한 개라도 있으면 commercial.
- 단일 SKU + 정상 가격 + normal signal 있으면 normal/high.
- broad lane이라 SKU가 광범위해 보여도, 게시글 자체가 단일 모델만 다루면 normal로 분류 (multi는 옵션 나열일 때만).

Return JSON only, no commentary.`;

function makeUserPayload(item, laneMedian, flagsFired) {
  return JSON.stringify({
    listing: {
      title: item.name,
      price: item.price,
      lane_median: Math.round(laneMedian),
      price_gap_ratio: laneMedian > 0 ? Number(((laneMedian - item.price) / laneMedian).toFixed(3)) : null,
      description_preview: (item.description ?? "").slice(0, 500),
      free_shipping: item.freeShipping ?? null,
      num_faved: item.numFaved ?? null,
      rule_fired_flags: flagsFired,
    },
  });
}

async function classifyOne(model, item, laneMedian, flagsFired) {
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: makeUserPayload(item, laneMedian, flagsFired) },
        ],
      }),
    });
    const elapsedMs = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `${res.status} ${body.slice(0, 200)}`, elapsedMs };
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    let parsed = null;
    try { parsed = JSON.parse(content); } catch { /* fallthrough */ }
    if (!parsed) return { ok: false, error: "parse_fail", elapsedMs };

    const usage = json.usage ?? {};
    const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
    const promptUncached = (usage.prompt_tokens ?? 0) - cached;
    const completion = usage.completion_tokens ?? 0;
    const p = PRICE[model] ?? PRICE["gpt-4o-mini"];
    const costUsd = (promptUncached * p.input + cached * p.cached + completion * p.output) / 1_000_000;

    return {
      ok: true,
      listingType: String(parsed.listing_type ?? "unknown"),
      confidence: String(parsed.confidence ?? "low"),
      reason: String(parsed.reason ?? "").slice(0, 200),
      riskKeywords: Array.isArray(parsed.risk_keywords) ? parsed.risk_keywords.slice(0, 8) : [],
      promptTokens: usage.prompt_tokens ?? 0,
      cachedTokens: cached,
      completionTokens: completion,
      costUsd,
      elapsedMs,
      model,
    };
  } catch (err) {
    return { ok: false, error: err.message || "unknown", elapsedMs: Date.now() - t0 };
  }
}

async function classifyBatch(model, items, label) {
  console.log(`  ${label}: ${items.length} calls, concurrency=${CONCURRENCY}`);
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const { item, laneMedian, flags } = items[idx];
      const r = await classifyOne(model, item, laneMedian, flags);
      results[idx] = r;
      done += 1;
      if (done % 25 === 0) console.log(`    progress ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return results;
}

// ─── Metrics ────────────────────────────────────────────────────────────────
const FLAGS_OF_INTEREST = [
  "extreme_discount_review",
  "deep_discount_review",
  "multi_model_review",
  "suspicious_model_review",
  "weak_normal_signal",
  "short_title",
  "commercial_review",
];

// Overturn 정의:
//   "shouldAiReview"가 fire한 후보 = AI L2 검토 대상.
//   AI가 normal+confidence≥medium 으로 판정 = "AI says actually normal" = 룰을 overturn.
//   AI가 normal 이외 = 룰의 의심을 강화 (kept-hold).
//   false_hold_rate = (룰 hold 했는데 AI normal) / (룰 hold 한 전체).
//   여기서 룰 hold ≡ scoreFlags가 1개 이상 fired된 후보로 가정 (현 shouldAiReview 동치).
function computeMetrics(rows) {
  // rows: [{ pid, lane, flags, ai: {listingType, confidence, costUsd, elapsedMs, ok} }]
  const out = { generated_at: new Date().toISOString(), model: "gpt-4o-mini", flags: {}, lanes: {}, overall: {} };

  // Per-flag
  for (const flag of FLAGS_OF_INTEREST) {
    const fired = rows.filter((r) => r.flags.includes(flag) && r.ai?.ok);
    const ai_normal = fired.filter((r) => r.ai.listingType === "normal" && r.ai.confidence !== "low").length;
    const ai_noise = fired.filter((r) => r.ai.listingType !== "normal" && r.ai.confidence !== "low").length;
    const ai_low = fired.filter((r) => r.ai.confidence === "low").length;
    const overturn_rate = fired.length > 0 ? ai_normal / fired.length : null;
    const costSum = fired.reduce((a, r) => a + (r.ai.costUsd ?? 0), 0);
    const latencies = fired.map((r) => r.ai.elapsedMs).filter((x) => x != null);
    out.flags[flag] = {
      fired_n: fired.length,
      ai_normal,
      ai_noise,
      ai_low_confidence: ai_low,
      overturn_rate,
      cost_total_usd: Number(costSum.toFixed(5)),
      cost_per_overturn_usd: ai_normal > 0 ? Number((costSum / ai_normal).toFixed(5)) : null,
      p95_latency_ms: latencies.length > 0 ? percentile(latencies, 95) : null,
      median_latency_ms: latencies.length > 0 ? Math.round(median(latencies)) : null,
    };
  }

  // Per-lane
  const lanes = [...new Set(rows.map((r) => r.lane))];
  for (const lane of lanes) {
    const laneRows = rows.filter((r) => r.lane === lane && r.ai?.ok);
    const fired = laneRows.filter((r) => r.flags.length > 0);
    const ai_normal_fired = fired.filter((r) => r.ai.listingType === "normal" && r.ai.confidence !== "low").length;
    const overturn_rate = fired.length > 0 ? ai_normal_fired / fired.length : null;

    // false_hold_rate: 룰이 hold(=flag fired)했는데 AI가 normal로 뒤집은 비율
    const false_hold_rate = overturn_rate;

    // AI says noise (regardless of rule firing) — 카테고리 baseline noise 비율 참고
    const ai_says_noise = laneRows.filter((r) => r.ai.listingType !== "normal" && r.ai.confidence !== "low").length;
    const costSum = laneRows.reduce((a, r) => a + (r.ai.costUsd ?? 0), 0);

    // 결정 도움 라벨
    let recommend = "review";
    if (fired.length > 0 && overturn_rate != null) {
      if (overturn_rate >= 0.8) recommend = "skip_review (룰 hold가 거의 다 false positive)";
      else if (overturn_rate <= 0.2) recommend = "trust_rule (룰 hold 거의 다 진짜 노이즈)";
      else recommend = "needs_AI_L2";
    }

    out.lanes[lane] = {
      n: laneRows.length,
      flag_fired_n: fired.length,
      overturn_rate,
      false_hold_rate,
      ai_says_noise_total: ai_says_noise,
      noise_rate_overall: laneRows.length > 0 ? ai_says_noise / laneRows.length : null,
      cost_total_usd: Number(costSum.toFixed(5)),
      recommend,
    };
  }

  // Overall
  const ok = rows.filter((r) => r.ai?.ok);
  out.overall = {
    n_total: rows.length,
    n_classified: ok.length,
    failed: rows.length - ok.length,
    total_cost_usd: Number(ok.reduce((a, r) => a + (r.ai.costUsd ?? 0), 0).toFixed(4)),
    p95_latency_ms: percentile(ok.map((r) => r.ai.elapsedMs).filter((x) => x != null), 95),
  };

  return out;
}

function compareModels(rowsByPid, comparePids) {
  const out = { sample_size: comparePids.size, agreements: 0, disagreements: 0, gpt4o_normal: 0, mini_normal: 0, cost_sum_4o: 0, p95_latency_4o: 0 };
  const latencies = [];
  const cases = [];
  for (const pid of comparePids) {
    const m = rowsByPid.get(pid);
    if (!m || !m.miniAi?.ok || !m.fourAi?.ok) continue;
    const agree = m.miniAi.listingType === m.fourAi.listingType;
    if (agree) out.agreements += 1; else out.disagreements += 1;
    if (m.miniAi.listingType === "normal") out.mini_normal += 1;
    if (m.fourAi.listingType === "normal") out.gpt4o_normal += 1;
    out.cost_sum_4o += m.fourAi.costUsd ?? 0;
    if (m.fourAi.elapsedMs != null) latencies.push(m.fourAi.elapsedMs);
    cases.push({ pid, mini: m.miniAi.listingType, gpt4o: m.fourAi.listingType });
  }
  out.cost_sum_4o = Number(out.cost_sum_4o.toFixed(4));
  out.p95_latency_4o = percentile(latencies, 95);
  out.agreement_rate = out.sample_size > 0 ? out.agreements / out.sample_size : null;
  out.cases_disagree = cases.filter((c) => c.mini !== c.gpt4o).slice(0, 20);
  return out;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(reportsDir, { recursive: true });

  let candidatesByLane = {};
  if (SKIP_MINE && existsSync(cachePath)) {
    console.log(`Loading cached candidates from ${path.relative(appDir, cachePath)}`);
    candidatesByLane = JSON.parse(await readFile(cachePath, "utf8"));
  } else {
    console.log("Loading/mining candidates per lane");
    for (const [lane, cfg] of Object.entries(LANES)) {
      console.log(`  ${lane} (${cfg.source.type})`);
      const all = await loadLaneCandidates(lane, cfg);
      // 우선 mining/loading은 limit×1.5 정도 받아두고, ruleClassify=normal 인 것만 LIMIT_PER_LANE 만큼 쓴다
      const normalOnly = all.filter((it) => ruleClassify(it) === "normal").slice(0, LIMIT_PER_LANE);
      console.log(`    raw=${all.length} normal=${normalOnly.length}`);
      candidatesByLane[lane] = normalOnly;
    }
    await writeFile(cachePath, JSON.stringify(candidatesByLane, null, 2));
  }

  // Lane median price (broad lane proxy)
  const laneMedians = {};
  for (const [lane, items] of Object.entries(candidatesByLane)) {
    laneMedians[lane] = median(items.map((x) => x.price));
    console.log(`  ${lane} median price = ${Math.round(laneMedians[lane]).toLocaleString()}원, n=${items.length}`);
  }

  // Compute flags for all
  const rows = [];
  for (const [lane, items] of Object.entries(candidatesByLane)) {
    for (const it of items) {
      const { priceGap, flags } = computeFlags(it, laneMedians[lane]);
      rows.push({ pid: it.pid, lane, name: it.name, price: it.price, description: it.description, priceGap, flags, item: it, laneMedian: laneMedians[lane] });
    }
  }

  // Flag distribution preview
  console.log("\nFlag fire distribution:");
  for (const flag of FLAGS_OF_INTEREST) {
    const n = rows.filter((r) => r.flags.includes(flag)).length;
    console.log(`  ${flag.padEnd(28)} ${n} / ${rows.length} (${((n / rows.length) * 100).toFixed(1)}%)`);
  }

  if (DRY_RUN) {
    const out = { dry_run: true, lane_medians: laneMedians, flag_distribution: Object.fromEntries(FLAGS_OF_INTEREST.map((f) => [f, rows.filter((r) => r.flags.includes(f)).length])), rows: rows.map((r) => ({ pid: r.pid, lane: r.lane, priceGap: r.priceGap, flags: r.flags })) };
    const p = path.join(reportsDir, "ai-l2-experiment-dryrun.json");
    await writeFile(p, JSON.stringify(out, null, 2));
    console.log(`\nDry-run written to ${path.relative(appDir, p)}`);
    return;
  }

  // Classify with gpt-4o-mini (모든 후보)
  console.log("\nClassifying with gpt-4o-mini");
  const miniInputs = rows.map((r) => ({ item: r.item, laneMedian: r.laneMedian, flags: r.flags }));
  const miniResults = await classifyBatch("gpt-4o-mini", miniInputs, "gpt-4o-mini");
  for (let i = 0; i < rows.length; i++) rows[i].ai = miniResults[i];

  // Compare set: 무작위 100건 (lane별로 골고루)
  const compareSize = Math.min(COMPARE_N, rows.length);
  const perLane = Math.floor(compareSize / Object.keys(LANES).length);
  const comparePids = new Set();
  for (const lane of Object.keys(LANES)) {
    const laneRows = rows.filter((r) => r.lane === lane && r.ai?.ok);
    const shuffled = [...laneRows].sort(() => Math.random() - 0.5).slice(0, perLane);
    for (const r of shuffled) comparePids.add(r.pid);
  }
  console.log(`\nComparing ${comparePids.size} samples with gpt-4o`);
  const compareRows = rows.filter((r) => comparePids.has(r.pid));
  const fourInputs = compareRows.map((r) => ({ item: r.item, laneMedian: r.laneMedian, flags: r.flags }));
  const fourResults = await classifyBatch("gpt-4o", fourInputs, "gpt-4o");

  const rowsByPid = new Map();
  for (const r of rows) rowsByPid.set(r.pid, { miniAi: r.ai });
  for (let i = 0; i < compareRows.length; i++) {
    rowsByPid.get(compareRows[i].pid).fourAi = fourResults[i];
  }

  // Metrics
  const metrics = computeMetrics(rows);
  const compareReport = compareModels(rowsByPid, comparePids);

  const report = {
    note: "Model: gpt-4o-mini (OpenAI fallback for Haiku 4.5). gpt-4o comparison subset (Sonnet 4.6 fallback). Anthropic 본 비교는 다음 wave.",
    config: { limit_per_lane: LIMIT_PER_LANE, compare_n: comparePids.size, concurrency: CONCURRENCY },
    lane_medians_krw: laneMedians,
    metrics,
    comparison_gpt4o: compareReport,
    sample_rows: rows.slice(0, 20).map((r) => ({ pid: r.pid, lane: r.lane, name: r.name, price: r.price, flags: r.flags, ai: r.ai?.ok ? { listingType: r.ai.listingType, confidence: r.ai.confidence, reason: r.ai.reason } : { error: r.ai?.error } })),
  };

  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(reportsDir, `ai-l2-experiment-${today}.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${path.relative(appDir, outPath)}`);

  // Brief summary to stdout
  console.log("\n— Per-flag overturn —");
  for (const flag of FLAGS_OF_INTEREST) {
    const f = metrics.flags[flag];
    const rate = f.overturn_rate != null ? `${(f.overturn_rate * 100).toFixed(1)}%` : "n/a";
    console.log(`  ${flag.padEnd(28)} n=${String(f.fired_n).padStart(3)}  overturn=${rate.padStart(7)}  cost/overturn=${f.cost_per_overturn_usd ?? "n/a"}  p95=${f.p95_latency_ms ?? "n/a"}ms`);
  }
  console.log("\n— Per-lane —");
  for (const [lane, m] of Object.entries(metrics.lanes)) {
    const rate = m.overturn_rate != null ? `${(m.overturn_rate * 100).toFixed(1)}%` : "n/a";
    console.log(`  ${lane.padEnd(24)} n=${m.n}  flagged=${m.flag_fired_n}  overturn=${rate}  recommend=${m.recommend}`);
  }
  console.log(`\nTotal cost: $${metrics.overall.total_cost_usd}  p95=${metrics.overall.p95_latency_ms}ms`);
  console.log(`gpt-4o agreement (n=${compareReport.sample_size}): ${(compareReport.agreement_rate * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
