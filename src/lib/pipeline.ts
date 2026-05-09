// 수집 파이프라인:
//   검색 → 분류(listing_type) → 정상 매물만 상세 enrich → 배송비 파싱 → 점수 계산 → Supabase upsert
//
// Python PoC 09_airpods_filter_refine.py + 10_shipping_fee_test.py 포팅.

import { createHash } from "node:crypto";

import { collectSearchItems, fetchDetail } from "@/lib/bunjang";
import { CATALOG, normalize, ruleMatch, type Sku } from "@/lib/catalog";
import { GENERATED_NOISE_RULES } from "@/lib/generated/noise-rules";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";

// ─── 분류 키워드 ─────────────────────────────────────────────────────────────
const BUYING_KEYWORDS = [
  "구합니다", "구해요", "삽니다", "급구", "매입", "최고가", "전국출장", "구매합니다",
  "구매만 합니다", "매입전문", "매입업체", "출장매입", "매입합니다", "구매원함", "매입문의",
  ...GENERATED_NOISE_RULES.buying,
];
const CALLOUT_KEYWORDS = [
  "사지마세요", "사기당함", "사기꾼", "저격", "도용", "짝퉁", "조심",
  "타오바오", "타오바이", "taobao", "짭", "가품", "레플", "레플리카",
  "이미테이션", "정품아님", "정품 아님", "비정품",
  ...GENERATED_NOISE_RULES.callout,
];
const PARTS_KEYWORDS = [
  "부품용", "본체만", "유닛만", "좌측", "우측", "한쪽", "한짝", "한 쪽", "한알", "낱개", "단품",
  "케이스만", "충전케이스만", "충전 케이스만", "액정만", "배터리만",
  "교체용", "호환", "익스텐션", "연장",
  ...GENERATED_NOISE_RULES.parts,
];
const DAMAGED_KEYWORDS = [
  "고장", "작동안됨", "작동 안됨", "안켜짐", "안 켜짐",
  "먹통", "충전안됨", "충전 안됨", "충전이 안됨", "충전이 안되는",
  "충전이안됨", "충전이안되는", "충전불량", "충전 불량",
  "툭툭", "끊김", "잡음", "소리 안", "소리가 안", "노캔 안됨",
  "노캔키면", "알갱이 소리", "소리 들리는",
  "수리이력", "찍힘 심", "기스 심", "액정깨짐", "잠김", "초기화불가",
  "배터리 광탈", "배터리효율 낮", "방전",
  ...GENERATED_NOISE_RULES.damaged,
];
const ACCESSORY_TITLE_KEYWORDS = [
  "스트랩", "밴드", "파우치", "키링", "거치대", "충전기", "어댑터",
  "브레이슬릿", "루프", "필름", "강화유리", "커버", "실리콘",
  "악세사리", "악세서리", "이어팁", "보호캡", "메탈밴드", "나토밴드",
  "밀레니즈", "밀레니즈 루프", "가죽스트랩", "시계줄", "충전기케이블",
  "보호필름", "메탈스트랩", "나토 스트랩", "퀵체인지 스트랩", "스포츠밴드", "d버클",
  ...GENERATED_NOISE_RULES.accessory,
];
const MULTI_KEYWORDS = ["일괄", "묶음", "각각", "선택", "여러개", "재고", ...GENERATED_NOISE_RULES.multi];
// 업자성/미끼성 매물 — 1개라도 있으면 commercial. 정상 본품 가격 분포에 절대 들어가면 안 됨.
// 스마트폰 샘플 300건에서 직접 관찰됨: 재고정리·완납폰·제휴카드·유심 그대로 류는
// 개인 판매자는 거의 쓰지 않고 통신사 대리점/도매상 매물에 집중됨.
const COMMERCIAL_STRONG_KEYWORDS = [
  "재고정리", "재고 정리", "선착순특가", "선착순 특가", "선착순 한정",
  "한정판매", "한정 판매", "마지막입고", "마지막 입고",
  "극소량보유", "극소량 보유", "완납폰", "제휴카드",
  "유심 그대로", "유심그대로",
  ...GENERATED_NOISE_RULES.commercialStrong,
];
// 단독으로는 정상 매물에도 나올 수 있으나 가격 왜곡 의심. AI 검토용 플래그만 부여.
const COMMERCIAL_WEAK_KEYWORDS = [
  "통신사 특가", "신규개통", "번호이동", "개통 조건", "2년 약정",
  "자급제 신규", "선착순",
  ...GENERATED_NOISE_RULES.commercialWeak,
];
const NORMAL_SIGNALS = [
  "미개봉", "새상품", "풀박스", "풀구성", "풀세트", "정상작동",
  "정상 작동", "기능 정상", "기능에는 아무런 문제", "문제 없이",
  "문제없", "정품", "시리얼", "구매내역", "구매 영수증",
  "상자", "박스", "구성품", "양쪽", "노이즈 캔슬링", "노캔",
  "기능적으로 문제", "문제되는 부분은 하나도", "상태양호", "상태 양호",
];
const RISK_KEYWORDS = [
  "직거래만", "현금만", "박스없음", "박스 없음", "보증서없음",
  "수리이력", "수리 이력", "배터리교체", "배터리 교체",
  "충전안됨", "충전 안됨", "충전이 안됨", "충전이 안되는",
  "기능이상", "외관손상", "액정깨짐", "잠김", "분실신고",
  "초기화불가", "고장", "불량", "먹통", "작동안됨",
];
const SHORT_TITLE_MIN = 9;
const AI_CLASSIFIER_MODEL = process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-4.1-mini";

function nrm(text: unknown): string {
  return normalize(String(text ?? ""));
}

function containsAny(text: string, keywords: string[]): string[] {
  const n = nrm(text);
  return keywords.filter((kw) => nrm(kw).trim() && n.includes(nrm(kw).trim()));
}

function compactLen(text: unknown): number {
  return String(text ?? "").replace(/\s+/g, "").length;
}

function hasNormalSignal(title: string, desc: string): boolean {
  return containsAny(`${title}\n${desc}`, NORMAL_SIGNALS).length > 0;
}

function accessoryTitleHits(title: string): string[] {
  const hits = containsAny(title, ACCESSORY_TITLE_KEYWORDS);
  const tn = nrm(title);
  const fullSetTokens = ["풀세트", "풀구성", "풀박스"];
  if (tn.includes("케이스") && !fullSetTokens.some((t) => tn.includes(t))) {
    hits.push("케이스");
  }
  return hits;
}

function partsHits(title: string, desc: string): string[] {
  const text = `${title}\n${desc}`;
  const hits = containsAny(text, PARTS_KEYWORDS);
  const compactTitle = nrm(title).replace(/\s+/g, "");
  const compactText = nrm(text).replace(/\s+/g, "");

  if (/(왼쪽|오른쪽|좌측|우측).{0,8}(유닛|이어버드)|(?:유닛|이어버드).{0,8}(왼쪽|오른쪽|좌측|우측)/.test(compactText)) {
    hits.push("side_unit");
  }
  if (/(본체|충전케이스).{0,8}(단품|만|판매|팝니다)|(?:단품|만).{0,8}(본체|충전케이스)/.test(compactText)) {
    hits.push("case_only");
  }
  if (/(l|r)\s*\/?\s*(유닛|unit)|\b(l|r)\b.{0,8}(낱개|단품)/i.test(title)) {
    hits.push("lr_unit");
  }
  if (compactTitle.includes("본체") && !containsAny(text, ["양쪽", "풀박", "풀박스", "풀세트", "풀구성"]).length) {
    hits.push("title_case_only");
  }

  return [...new Set(hits)];
}

function damagedHits(title: string, desc: string): string[] {
  const text = `${title}\n${desc}`;
  const hits = containsAny(text, DAMAGED_KEYWORDS);
  const compactText = nrm(text).replace(/\s+/g, "");

  if (compactText.includes("하자") && !/(하자없|하자전혀없|하자없이|무하자|하자는없|하자없습|하자전혀없이)/.test(compactText)) {
    hits.push("하자");
  }
  if (compactText.includes("불량") && !/(불량없|불량없이|불량이슈로없습니다)/.test(compactText)) {
    hits.push("불량");
  }
  if (/(안들림|안 들림|소리안남|소리 안남|한쪽안들림|한쪽 안들림)/.test(text)) {
    hits.push("sound_failure");
  }
  if (/(배터리(?:효율|성능)?|배터리\s*(?:효율|성능)).{0,8}([0-7][0-9])\s*%/.test(text)) {
    hits.push("low_battery_under_80");
  }
  if (/배터리(?:효율|성능)?\s*80\s*%\s*미만/.test(compactText)) {
    hits.push("low_battery_under_80");
  }

  return [...new Set(hits)];
}

function suspiciousModelText(title: string, desc: string): boolean {
  const text = nrm(`${title}\n${desc}`).replace(/\s+/g, "");
  return /에어팟프로[34]|airpodspro[34]/i.test(text);
}

function multiModelHits(title: string): string[] {
  const raw = String(title ?? "").toLowerCase();
  const normalized = nrm(title);
  const compact = normalized.replace(/\s+/g, "");
  const hasChoiceSeparator = /[/|,·+]|또는|선택|중에|중 택|중택|가격\s*상이|가격상이/.test(raw);
  if (!hasChoiceSeparator) return [];

  const hits: string[] = [];
  const add = (hit: string) => {
    if (!hits.includes(hit)) hits.push(hit);
  };

  if (compact.includes("에어팟맥스") || normalized.includes("airpods max")) add("airpods_max");
  if (compact.includes("에어팟프로") || normalized.includes("airpods pro")) add("airpods_pro");
  if (/(에어팟|airpods).{0,6}(2세대|2nd)|에어팟2/.test(normalized)) add("airpods_2");
  if (/(에어팟|airpods).{0,6}(3세대|3rd)|에어팟3/.test(normalized)) add("airpods_3");
  if (/(에어팟|airpods).{0,6}(4세대|4th)|에어팟4/.test(normalized)) add("airpods_4");

  if (compact.includes("애플워치울트라") || normalized.includes("applewatch ultra")) add("applewatch_ultra");
  if (compact.includes("애플워치se") || normalized.includes("applewatch se")) add("applewatch_se");
  for (const n of ["7", "8", "9", "10", "11"]) {
    if (new RegExp(`애플워치(?:시리즈)?${n}|시리즈${n}|series${n}|applewatch${n}`).test(compact)) add(`applewatch_${n}`);
  }

  if (compact.includes("갤럭시워치울트라") || normalized.includes("galaxywatch ultra")) add("galaxywatch_ultra");
  if (compact.includes("클래식") || normalized.includes("classic")) add("galaxywatch_classic");
  for (const n of ["4", "5", "6", "7", "8"]) {
    if (new RegExp(`갤럭시워치${n}|갤워치${n}|galaxywatch${n}|워치${n}`).test(compact)) add(`galaxywatch_${n}`);
  }

  return hits.length >= 2 ? hits : [];
}

export type ListingType = "normal" | "parts" | "multi" | "buying" | "callout" | "damaged" | "accessory" | "commercial" | "unknown";

type ClassifyResult = { listingType: ListingType; sku: Sku | null };

export function classifyListing(title: string, desc: string, price: number): ClassifyResult {
  const text = `${title}\n${desc}`;

  if (containsAny(title, BUYING_KEYWORDS).length > 0) return { listingType: "buying", sku: null };
  if (price <= 0 || price < 5000) return { listingType: "callout", sku: null };
  if (containsAny(text, CALLOUT_KEYWORDS).length > 0) return { listingType: "callout", sku: null };
  if (containsAny(text, COMMERCIAL_STRONG_KEYWORDS).length > 0) return { listingType: "commercial", sku: null };
  if (partsHits(title, desc).length > 0) return { listingType: "parts", sku: null };
  if (damagedHits(title, desc).length > 0) return { listingType: "damaged", sku: null };
  if (accessoryTitleHits(title).length > 0) return { listingType: "accessory", sku: null };

  const multiHits = containsAny(title, MULTI_KEYWORDS);
  if (/\b[2-9]\s*개\b/.test(title)) multiHits.push("N개");
  multiHits.push(...multiModelHits(title));
  if (multiHits.length > 0) return { listingType: "multi", sku: null };

  const sku = ruleMatch(title, desc);
  if (!sku) return { listingType: "unknown", sku: null };
  if (compactLen(title) < SHORT_TITLE_MIN && !hasNormalSignal(title, desc)) {
    return { listingType: "unknown", sku: null };
  }
  return { listingType: "normal", sku };
}

// ─── 배송비 파싱 ─────────────────────────────────────────────────────────────
function moneyToInt(raw: string): number | null {
  const text = raw.replace(/,/g, "").trim();
  if (!text) return null;
  if (/\d+\s*만/.test(raw)) return null;
  const v = parseInt(text, 10);
  if (!Number.isFinite(v) || v < 1000 || v > 20000) return null;
  return v;
}

function compactStr(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

const HALF_HINTS = ["반값", "반택", "gs반값", "gs", "cu", "끼리"];
const GENERAL_HINTS_STR = ["일반", "일반택배", "택배", "우체국", "편의점택배", "cj", "대한통운"];

function contextKind(ctx: string): "half" | "general" | "unknown" {
  const c = compactStr(ctx);
  if (HALF_HINTS.some((h) => c.includes(compactStr(h)))) return "half";
  if (GENERAL_HINTS_STR.some((h) => c.includes(compactStr(h)))) return "general";
  return "unknown";
}

type ShippingOption = { kind: "free" | "general" | "half" | "unknown"; amount: number };
type ShippingParsed = { min: number | null; general: number | null; options: ShippingOption[] };

export function parseShippingFromDescription(description: string): ShippingParsed {
  const text = description || "";
  const FREE_PATTERNS = [
    /무료\s*배송|무료배송|택배비\s*무료|배송비\s*무료|택배비\s*포함|택배비포함|배송비\s*포함|배송비포함|무료로\s*배송|제가\s*부담|내드릴께요|내드릴게요/,
  ];
  const hasFree = FREE_PATTERNS.some((p) => p.test(text));

  const options: ShippingOption[] = [];
  const seen = new Set<string>();

  const kwRe = /(일반\s*택배|일반|반값\s*택배|반값|반택|gs\s*반값|gs|cu|끼리|편의점\s*택배|편의점택배|우체국|택배|배송|배송비|택배비)/gi;
  const amRe = /([+]?\s*\d{1,2},?\d{3})\s*원?/;
  const combinedRe = new RegExp(kwRe.source + `[^0-9가-힣a-zA-Z]{0,12}` + amRe.source, "gi");

  for (const m of text.matchAll(combinedRe)) {
    const ctx = m[0];
    const amount = moneyToInt(m[2]);
    if (amount == null) continue;
    const kind = contextKind(ctx);
    const key = `${kind}:${amount}`;
    if (!seen.has(key)) { seen.add(key); options.push({ kind, amount }); }
  }

  const shortRe = /(택배|반택|반값|배송비|택배비)\s*([+]?\s*\d{4,5})\s*원?/gi;
  for (const m of text.matchAll(shortRe)) {
    const amount = moneyToInt(m[2]);
    if (amount == null) continue;
    const kind = contextKind(m[1]);
    const key = `${kind}:${amount}`;
    if (!seen.has(key)) { seen.add(key); options.push({ kind, amount }); }
  }

  if (hasFree && options.length === 0) {
    return { min: 0, general: 0, options: [{ kind: "free", amount: 0 }] };
  }

  const all = options.map((o) => o.amount);
  const generals = options.filter((o) => o.kind === "general").map((o) => o.amount);
  return {
    min: all.length > 0 ? Math.min(...all) : null,
    general: generals.length > 0 ? generals[0] : (all.length > 0 ? Math.max(...all) : null),
    options,
  };
}

export function parseShippingFromTrade(trade: unknown, trades: unknown): ShippingParsed {
  const options: ShippingOption[] = [];

  if (trade && typeof trade === "object") {
    const t = trade as Record<string, unknown>;
    if (t.freeShipping) {
      return { min: 0, general: 0, options: [{ kind: "free", amount: 0 }] };
    }
    const specs = t.shippingSpecs;
    if (specs && typeof specs === "object") {
      for (const [key, spec] of Object.entries(specs as Record<string, unknown>)) {
        if (!spec || typeof spec !== "object") continue;
        const s = spec as Record<string, unknown>;
        const amount = moneyToInt(String(s.fee ?? ""));
        if (amount == null) continue;
        const kind = key === "DEFAULT" ? "general" : "half";
        options.push({ kind, amount });
      }
    }
  }

  if (options.length === 0 && Array.isArray(trades)) {
    for (const block of trades) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.title !== "배송비") continue;
      for (const content of (b.contents as string[]) ?? []) {
        const parsed = parseShippingFromDescription(String(content));
        options.push(...parsed.options);
      }
    }
  }

  const all = options.map((o) => o.amount);
  const generals = options.filter((o) => o.kind === "general").map((o) => o.amount);
  return {
    min: all.length > 0 ? Math.min(...all) : null,
    general: generals.length > 0 ? generals[0] : null,
    options,
  };
}

const DEFAULT_SHIPPING_FEE = 3500;

type ShippingResult = {
  shippingFee: number;
  shippingFeeGeneral: number | null;
  shippingSource: string;
  estimatedBuyCost: number;
  grossResellGap: number;
  netGapAfterShipping: number;
};

export function resolveShipping(
  price: number,
  skuMedian: number,
  freeShipping: boolean,
  apiParsed: ShippingParsed,
  descParsed: ShippingParsed,
): ShippingResult {
  let fee: number;
  let source: string;

  if (freeShipping) {
    fee = 0; source = "search_api_free_shipping";
  } else if (apiParsed.min != null) {
    fee = apiParsed.min; source = "detail_api_trade";
  } else if (descParsed.min != null) {
    fee = descParsed.min; source = "description_parse";
  } else {
    fee = DEFAULT_SHIPPING_FEE; source = "default";
  }

  const generalFee = apiParsed.general ?? descParsed.general ?? null;
  const gross = Math.max(0, skuMedian - price);
  return {
    shippingFee: fee,
    shippingFeeGeneral: generalFee,
    shippingSource: source,
    estimatedBuyCost: price + fee,
    grossResellGap: gross,
    netGapAfterShipping: Math.max(0, gross - fee),
  };
}

// ─── 점수 계산 ───────────────────────────────────────────────────────────────
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  return values.filter((v) => v <= value).length / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── 메인 파이프라인 ─────────────────────────────────────────────────────────
export type PipelineRow = {
  pid: string;
  url: string;
  name: string;
  price: number;
  skuId: string;
  skuName: string;
  skuMedian: number;
  descriptionPreview: string;
  priceGap: number;
  numFaved: number;
  velocity: number;
  reviewRating: number | null;
  reviewCount: number;
  safety: number;
  riskHits: number;
  score: number;
  scoreFlags: string[];
  shippingFee: number;
  shippingFeeGeneral: number | null;
  shippingSource: string;
  estimatedBuyCost: number;
  grossResellGap: number;
  netGapAfterShipping: number;
};

export type PipelineResult = {
  collected: number;
  titleNormal: number;
  enriched: number;
  scored: number;
  aiReviewRequested: number;
  aiCacheHits: number;
  aiApiCalls: number;
  aiUnavailable: number;
  aiFiltered: number;
  aiKeptNormal: number;
  aiKeptLowConfidence: number;
  normal: number;
  upserted: number;
};

type AiListingType = "normal" | "counterfeit" | "parts" | "buying" | "callout" | "damaged" | "accessory" | "multi" | "commercial" | "unknown";
type AiConfidence = "high" | "medium" | "low";
type AiClassification = {
  listingType: AiListingType;
  confidence: AiConfidence;
  reason: string;
  riskKeywords: string[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  cached?: boolean;
};
type AiReviewStats = {
  requested: number;
  cacheHits: number;
  apiCalls: number;
  unavailable: number;
  filtered: number;
  keptNormal: number;
  keptLowConfidence: number;
};
type AiReviewResult = { rows: PipelineRow[]; stats: AiReviewStats };
type AiClassifyOutcome = {
  result: AiClassification | null;
  source: "cache" | "api" | "unavailable";
};
export type PipelineOptions = {
  searchQueries?: string[];
  searchDelayMs?: number;
  detailLimit?: number;
  detailConcurrency?: number;
  detailDelayMs?: number;
  aiReviewTopN?: number;
  aiReviewConcurrency?: number;
  aiReviewEnabled?: boolean;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runPipeline(pagesPerQuery?: number, options: PipelineOptions = {}): Promise<PipelineResult> {
  const config = loadPipelineRuntimeConfig();
  const resolvedPagesPerQuery = Math.max(1, Math.min(config.maxPagesPerQuery, pagesPerQuery ?? config.pagesPerQuery));
  const searchQueries = options.searchQueries?.length ? options.searchQueries : config.searchQueries;
  const searchDelayMs = Math.max(0, options.searchDelayMs ?? config.searchDelayMs);
  const detailLimit = Math.max(0, Math.min(config.maxDetailLimit, options.detailLimit ?? config.detailLimit));
  const detailConcurrency = Math.max(1, Math.min(config.maxDetailConcurrency, options.detailConcurrency ?? config.detailConcurrency));
  const detailDelayMs = Math.max(0, options.detailDelayMs ?? config.detailDelayMs);
  const aiReviewEnabled = options.aiReviewEnabled ?? true;
  const aiReviewTopN = Math.max(0, Math.min(config.maxAiReviewTopN, options.aiReviewTopN ?? config.aiReviewTopN));
  const aiReviewConcurrency = Math.max(1, Math.min(config.maxAiReviewConcurrency, options.aiReviewConcurrency ?? config.aiReviewConcurrency));

  // 1. 검색
  const searchItems = await collectSearchItems(searchQueries, resolvedPagesPerQuery, searchDelayMs);

  // 2. 분류 — 검색 결과에서 normal만 추출 (상세 API 없이 제목만으로 1차 필터)
  type NormalCandidate = { pid: string; skuId: string; skuName: string };
  const normalCandidates: NormalCandidate[] = [];
  for (const item of searchItems.values()) {
    const { listingType, sku } = classifyListing(item.name, "", item.price);
    if (listingType === "normal" && sku) {
      normalCandidates.push({ pid: item.pid, skuId: sku.id, skuName: sku.modelName });
    }
  }

  // 3. 상세 enrich
  type Enriched = { pid: string; skuId: string; skuName: string; detail: NonNullable<Awaited<ReturnType<typeof fetchDetail>>>; freeShipping: boolean; price: number; numFaved: number; };
  const enriched: Enriched[] = [];
  const enrichTargets = normalCandidates.slice(0, detailLimit);
  let enrichCursor = 0;
  async function enrichNext() {
    const c = enrichTargets[enrichCursor++];
    if (!c) return;
    const item = searchItems.get(c.pid)!;
    const detail = await fetchDetail(c.pid);
    if (detailDelayMs > 0) await sleep(detailDelayMs);
    if (detail) {
      // 2차 필터: 상세 description 포함해 재분류
      const { listingType } = classifyListing(item.name, detail.description, item.price);
      if (listingType === "normal") {
        enriched.push({ pid: c.pid, skuId: c.skuId, skuName: c.skuName, detail, freeShipping: item.freeShipping, price: item.price, numFaved: item.numFaved });
      }
    }
    await enrichNext();
  }
  await Promise.all(
    Array.from({ length: Math.min(detailConcurrency, enrichTargets.length) }, () => enrichNext()),
  );

  // 4. SKU별 시세 계산 (normal 매물 가격 중앙값)
  const pricesBySku = new Map<string, number[]>();
  const favsBySku = new Map<string, number[]>();
  for (const r of enriched) {
    if (!pricesBySku.has(r.skuId)) pricesBySku.set(r.skuId, []);
    pricesBySku.get(r.skuId)!.push(r.price);
    if (!favsBySku.has(r.skuId)) favsBySku.set(r.skuId, []);
    favsBySku.get(r.skuId)!.push(r.numFaved);
  }

  // SKU 중앙값이 적으면 MSRP*0.5 fallback
  const skuMsrpMap = new Map(CATALOG.map((s) => [s.id, s.msrpKrw]));
  function skuMedianFor(skuId: string): number {
    const prices = pricesBySku.get(skuId) ?? [];
    if (prices.length >= 5) return median(prices);
    return (skuMsrpMap.get(skuId) ?? 300000) * 0.5;
  }

  // 5. 점수 계산 + 배송비 결정
  const scored: PipelineRow[] = [];
  for (const r of enriched) {
    const skuMed = skuMedianFor(r.skuId);
    const priceGap = skuMed <= 0 ? 0 : clamp((skuMed - r.price) / skuMed);
    const velocity = percentileRank(favsBySku.get(r.skuId) ?? [], r.numFaved);

    const ratingRaw = r.detail.shopReviewRating;
    const safetyBase = ratingRaw == null ? 0.5 : clamp(ratingRaw / 5);
    const reviewBonus = r.detail.shopReviewCount >= 100 ? 0.05 : 0;
    const riskHits = RISK_KEYWORDS.filter((kw) =>
      r.detail.description.toLowerCase().includes(kw.toLowerCase())
    ).length;
    const safety = clamp(safetyBase + reviewBonus - Math.min(0.5, riskHits * 0.1));
    const score = (priceGap * 0.5 + velocity * 0.4 + safety * 0.1) * 100;

    const flags: string[] = [];
    if (priceGap >= 0.55) flags.push("deep_discount_review");
    if (suspiciousModelText(searchItems.get(r.pid)?.name ?? "", r.detail.description)) flags.push("suspicious_model_review");
    if (multiModelHits(searchItems.get(r.pid)?.name ?? "").length > 0) flags.push("multi_model_review");
    if (compactLen(r.detail.description === "" ? (searchItems.get(r.pid)?.name ?? "") : r.detail.description) < SHORT_TITLE_MIN) {
      if (!hasNormalSignal(searchItems.get(r.pid)?.name ?? "", r.detail.description)) flags.push("short_title");
    }
    if (!hasNormalSignal(searchItems.get(r.pid)?.name ?? "", r.detail.description)) flags.push("weak_normal_signal");
    if (containsAny(`${searchItems.get(r.pid)?.name ?? ""}\n${r.detail.description}`, COMMERCIAL_WEAK_KEYWORDS).length > 0) flags.push("commercial_review");

    const apiParsed = parseShippingFromTrade(r.detail.tradeData, r.detail.tradesData);
    const descParsed = parseShippingFromDescription(r.detail.description);
    const shipping = resolveShipping(r.price, skuMed, r.freeShipping, apiParsed, descParsed);

    scored.push({
      pid: r.pid,
      url: searchItems.get(r.pid)!.url,
      name: searchItems.get(r.pid)!.name,
      price: r.price,
      skuId: r.skuId,
      skuName: r.skuName,
      skuMedian: Math.round(skuMed),
      descriptionPreview: r.detail.description.slice(0, 200),
      priceGap,
      numFaved: r.numFaved,
      velocity,
      reviewRating: ratingRaw,
      reviewCount: r.detail.shopReviewCount,
      safety,
      riskHits,
      score,
      scoreFlags: flags,
      ...shipping,
    });
  }

  // 6. Tier 2 AI — 상위권 애매 후보만 판정. 실패/키 없음이면 룰 기반 결과 유지.
  const aiReview = await applyAiReview(scored, { enabled: aiReviewEnabled, topN: aiReviewTopN, concurrency: aiReviewConcurrency });

  // 7. Supabase upsert
  const upserted = await upsertToSupabase(aiReview.rows);

  return {
    collected: searchItems.size,
    titleNormal: normalCandidates.length,
    enriched: enriched.length,
    scored: scored.length,
    aiReviewRequested: aiReview.stats.requested,
    aiCacheHits: aiReview.stats.cacheHits,
    aiApiCalls: aiReview.stats.apiCalls,
    aiUnavailable: aiReview.stats.unavailable,
    aiFiltered: aiReview.stats.filtered,
    aiKeptNormal: aiReview.stats.keptNormal,
    aiKeptLowConfidence: aiReview.stats.keptLowConfidence,
    normal: aiReview.rows.length,
    upserted,
  };
}

// ─── Supabase upsert ─────────────────────────────────────────────────────────
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates",
  };
}

function supabaseUrl(table: string): string {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const base = raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  return `${base}/rest/v1/${table}`;
}

async function upsertRows(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(supabaseUrl(table), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} upsert failed: ${res.status} ${body}`);
  }
}

function contentHash(row: PipelineRow): string {
  return createHash("sha256")
    .update(JSON.stringify({
      name: row.name,
      price: row.price,
      skuName: row.skuName,
      descriptionPreview: row.descriptionPreview,
    }))
    .digest("hex");
}

function shouldAiReview(row: PipelineRow): boolean {
  return row.scoreFlags.length > 0 || row.priceGap >= 0.55 || suspiciousModelText(row.name, row.descriptionPreview);
}

async function fetchAiCache(row: PipelineRow, hash: string): Promise<AiClassification | null> {
  const url = `${supabaseUrl("mvp_listing_ai_classifications")}?select=listing_type,confidence,reason,risk_keywords,model&pid=eq.${encodeURIComponent(row.pid)}&content_hash=eq.${encodeURIComponent(hash)}&limit=1`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) return null;
  const rows = await res.json() as Array<{
    listing_type: AiListingType;
    confidence: AiConfidence;
    reason: string | null;
    risk_keywords: string[] | null;
    model: string | null;
  }>;
  const cached = rows[0];
  if (!cached) return null;
  return {
    listingType: cached.listing_type,
    confidence: cached.confidence,
    reason: cached.reason ?? "",
    riskKeywords: cached.risk_keywords ?? [],
    model: cached.model ?? "cache",
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    cached: true,
  };
}

async function upsertAiCache(row: PipelineRow, hash: string, result: AiClassification): Promise<void> {
  try {
    await upsertRows("mvp_listing_ai_classifications", [{
      pid: parseInt(row.pid, 10),
      content_hash: hash,
      listing_type: result.listingType,
      confidence: result.confidence,
      reason: result.reason,
      risk_keywords: result.riskKeywords,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      classified_at: new Date().toISOString(),
    }]);
  } catch {
    // Cache is an optimization. Do not fail collection if the table is absent.
  }
}

function parseAiClassification(raw: unknown): AiClassification | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const listingType = String(obj.listing_type ?? obj.listingType ?? "unknown") as AiListingType;
  const confidence = String(obj.confidence ?? "low") as AiConfidence;
  const allowedTypes: AiListingType[] = ["normal", "counterfeit", "parts", "buying", "callout", "damaged", "accessory", "multi", "commercial", "unknown"];
  const allowedConfidence: AiConfidence[] = ["high", "medium", "low"];
  return {
    listingType: allowedTypes.includes(listingType) ? listingType : "unknown",
    confidence: allowedConfidence.includes(confidence) ? confidence : "low",
    reason: String(obj.reason ?? ""),
    riskKeywords: Array.isArray(obj.risk_keywords)
      ? obj.risk_keywords.map(String).slice(0, 8)
      : (Array.isArray(obj.riskKeywords) ? obj.riskKeywords.map(String).slice(0, 8) : []),
    model: AI_CLASSIFIER_MODEL,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
  };
}

async function classifyWithAi(row: PipelineRow): Promise<AiClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_CLASSIFIER_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Classify Korean secondhand marketplace listings for resale. Return only JSON with listing_type, confidence, reason, risk_keywords. Be conservative: counterfeit/parts/buying/callout/damaged/accessory/multi should not be shown as normal.",
          },
          {
            role: "user",
            content: JSON.stringify({
              allowed_listing_type: ["normal", "counterfeit", "parts", "buying", "callout", "damaged", "accessory", "multi", "commercial", "unknown"],
              allowed_confidence: ["high", "medium", "low"],
              policy: "If the listing explicitly says fake/replica/Taobao/counterfeit, classify counterfeit. If it is only a charging case/body/unit/one side, classify parts. If it is a buying post, classify buying. If the title lists multiple different models/SKUs or selectable models with one price, classify multi. If it is a commercial/dealer-style listing — stock liquidation (재고정리), first-come specials (선착순특가), telco bundle deals (완납폰/제휴카드/유심 그대로/통신사 특가), bait-style new-product clearance with multiple model options — classify commercial. If unsure, unknown.",
              listing: {
                title: row.name,
                price: row.price,
                sku: row.skuName,
                sku_median: row.skuMedian,
                price_gap: row.priceGap,
                flags: row.scoreFlags,
                description: row.descriptionPreview.slice(0, 500),
              },
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = parseAiClassification(JSON.parse(content));
    if (!parsed) return null;
    parsed.inputTokens = Number.isFinite(json.usage?.prompt_tokens) ? json.usage.prompt_tokens : null;
    parsed.outputTokens = Number.isFinite(json.usage?.completion_tokens) ? json.usage.completion_tokens : null;
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyWithCache(row: PipelineRow): Promise<AiClassifyOutcome> {
  const hash = contentHash(row);
  const cached = await fetchAiCache(row, hash);
  if (cached) return { result: cached, source: "cache" };
  if (!process.env.OPENAI_API_KEY) return { result: null, source: "unavailable" };
  const fresh = await classifyWithAi(row);
  if (!fresh) return { result: null, source: "unavailable" };
  if (fresh) await upsertAiCache(row, hash, fresh);
  return { result: fresh, source: "api" };
}

export async function applyAiReview(
  rows: PipelineRow[],
  options: { enabled: boolean; topN: number; concurrency: number },
): Promise<AiReviewResult> {
  const emptyStats: AiReviewStats = {
    requested: 0,
    cacheHits: 0,
    apiCalls: 0,
    unavailable: 0,
    filtered: 0,
    keptNormal: 0,
    keptLowConfidence: 0,
  };
  if (!options.enabled || options.topN <= 0) return { rows, stats: emptyStats };

  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const reviewRows = sorted.slice(0, options.topN).filter(shouldAiReview);
  const reviewPids = new Set(reviewRows.map((row) => row.pid));
  const stats: AiReviewStats = { ...emptyStats, requested: reviewPids.size };
  if (reviewPids.size === 0) return { rows, stats };

  const reviewed = new Map<string, PipelineRow | null>();
  let cursor = 0;
  async function reviewNext() {
    const row = reviewRows[cursor++];
    if (!row) return;
    const { result, source } = await classifyWithCache(row);
    if (source === "cache") stats.cacheHits += 1;
    if (source === "api") stats.apiCalls += 1;
    if (source === "unavailable") stats.unavailable += 1;

    if (!result) {
      reviewed.set(row.pid, { ...row, scoreFlags: [...row.scoreFlags, "ai_review_unavailable"] });
      await reviewNext();
      return;
    }

    if (result.listingType === "normal" && result.confidence !== "low") {
      stats.keptNormal += 1;
      reviewed.set(row.pid, { ...row, scoreFlags: [...row.scoreFlags, "ai_normal"] });
      await reviewNext();
      return;
    }

    if (result.listingType !== "normal" && result.confidence !== "low") {
      // AI-confirmed noise: do not upsert as a visible candidate.
      stats.filtered += 1;
      reviewed.set(row.pid, null);
      await reviewNext();
      return;
    }

    stats.keptLowConfidence += 1;
    reviewed.set(row.pid, { ...row, scoreFlags: [...row.scoreFlags, `ai_${result.listingType}_low_confidence`] });
    await reviewNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, reviewRows.length) }, () => reviewNext()),
  );

  const output: PipelineRow[] = [];
  for (const row of rows) {
    if (!reviewPids.has(row.pid)) {
      output.push(row);
      continue;
    }
    const reviewedRow = reviewed.get(row.pid);
    if (reviewedRow) output.push(reviewedRow);
  }
  return { rows: output, stats };
}

async function upsertToSupabase(rows: PipelineRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const now = new Date().toISOString();

  // rank by score desc
  const sorted = [...rows].sort((a, b) => b.score - a.score);

  const listings = sorted.map((r) => ({
    pid: parseInt(r.pid, 10),
    url: r.url,
    name: r.name,
    price: r.price,
    sku_name: r.skuName,
    sku_median: r.skuMedian,
    description_preview: r.descriptionPreview,
    shipping_fee: r.shippingFee,
    shipping_fee_general: r.shippingFeeGeneral,
    shipping_source: r.shippingSource,
    estimated_buy_cost: r.estimatedBuyCost,
    gross_resell_gap: r.grossResellGap,
    net_gap_after_shipping: r.netGapAfterShipping,
    source_json: {},
    generated_at: now,
    updated_at: now,
  }));

  const analyses = sorted.map((r, i) => ({
    pid: parseInt(r.pid, 10),
    price_gap: r.priceGap,
    num_faved: r.numFaved,
    velocity: r.velocity,
    review_rating: r.reviewRating,
    review_count: r.reviewCount,
    safety: r.safety,
    risk_hits: r.riskHits,
    score: r.score,
    score_flags: r.scoreFlags,
    candidate_rank: i + 1,
    source_json: {},
    analyzed_at: now,
    updated_at: now,
  }));

  await upsertRows("mvp_listings", listings);
  await upsertRows("mvp_listing_analysis", analyses);
  return sorted.length;
}
