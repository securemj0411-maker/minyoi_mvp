import {
  evaluateCategoryReadiness,
  evaluateLaneReadinessForSku,
  LANE_READINESS,
  type CategoryReadinessDecision,
  type CategoryReadinessMap,
  type LaneReadinessMap,
} from "@/lib/category-readiness";
import type { Sku } from "@/lib/catalog";
import {
  bandFromProfit,
  computePoolConfidence,
  poolMaxExposure,
  poolSkipReason,
} from "@/lib/pool-policy.mjs";
import { RESELL_SHIPPING_FEE, SAFETY_BUFFER, SELLING_FEE_RATE } from "@/lib/profit";

// 2026-05-15 (사용자 코멘트 pid 400051960): 풀 진입 가격 상한.
// "200만원 이상은 안 하기로 했는데 왜 나옴" 정책 결정 반영.
// 일반 사용자 결제 부담 + 단일 매물 risk + 한정판/고가 모델 노이즈 차단.
const MAX_POOL_PRICE_KRW = 2_000_000;

// Wave 132 (2026-05-16): 댓글 수 상한 — 사용자 정책.
// "댓글 8개 이상 = 흥정 호가 괴리 큼. 추천해봤자 의미 없음 → pool 진입 X".
// num_comment는 detail-worker가 patchRows("mvp_raw_listings", {num_comment: detail.commentCount})로 박음.
// NULL = detail 아직 미수집 매물 (gate 통과 — 다음 tick에서 enrich 후 재평가).
const MAX_POOL_NUM_COMMENT = 8;

// Wave 137 (2026-05-16): 수량 상한 — Wave 136 audit 발견.
// product.qty > 1 = 대량 판매업자 (예: 냉장고 88개, 게이밍PC 35개). 일반 사용자 1:1 거래 X.
// qty = 1 = 일반 매물. qty > 1 즉시 pool 진입 차단.
// NULL = detail 미수집 (통과 — 다음 tick 재평가).
const MAX_POOL_QTY = 1;

// Wave 138 (2026-05-16): 같은 seller_uid 다수 매물 차단 — qty 위장 업자 탐지.
// DB 발견: 1명 셀러가 같은 매물명 46/45/40/36건 반복 등록 (qty=1로 분산).
// 정책: 셀러당 pool 매물 1개만 허용 (가장 score 높은 매물). 나머지 차단.
// MAX_POOL_LISTINGS_PER_SELLER = 1 = strict 1매물 정책.
const MAX_POOL_LISTINGS_PER_SELLER = 1;

// Wave 138b (2026-05-16): 같은 description hash + 다른 seller 2+ = 다중 ID 사기 그룹.
// 같은 사람이 부캐 N개 운영하면서 동일 description 복붙. DB 발견 27건/7셀러 패턴.
// MIN_SELLERS_FOR_FRAUD_GROUP = 2 = 같은 hash에 다른 셀러 2명 이상이면 사기 그룹.
const MIN_SELLERS_FOR_FRAUD_GROUP = 2;

// Wave 129 (2026-05-16): parse_confidence threshold 명시 — 사업 보고서 L1.
// "AI normalization 매칭 confidence < 0.85면 매물 풀에서 제외".
// 우리 정책 (LAUNCH_PLAN 12b precision-first):
// - HIGH (0.85+): 사용자 ready pool 진입 가능 (보고서 권장)
// - MEDIUM (0.65~0.85): pool 진입 OK, AI L2 review 대상
// - LOW (<0.65): pool 진입 차단 (시세 학습만)
// - needs_review=true: 무조건 차단
export const PARSE_CONFIDENCE_HIGH = 0.85;
export const PARSE_CONFIDENCE_MEDIUM = 0.65;
export const PARSE_CONFIDENCE_LOW = 0.55;

export type PoolCandidateInput = {
  pid: number | string;
  price: number;
  skuMedian: number;
  estimatedBuyCost: number;
  shippingFee: number;
  shippingFeeGeneral: number | null;
  riskHits: number;
  thumbnailUrl?: string | null;
  poolEligible?: boolean | null;
  skuId: string | null;
  score: number;
  scoreFlags: string[];
  saleStatus?: string | null;
  // Wave 132 (2026-05-16): 댓글 수 — 8개 이상이면 pool 진입 차단 (사용자 정책).
  // 흥정/문의 댓글 많음 = 호가-실거래 괴리 큼 → 추천 의미 없음.
  // NULL = detail 아직 미수집 (검증 못 했으므로 일단 통과).
  numComment?: number | null;
  // Wave 137 (2026-05-16): 수량 — qty > 1 = 대량 판매업자 (1:1 거래 X) → pool 진입 차단.
  // Wave 136 audit 발견 (qty 88/35/26 = 대량 판매업자, qty 1 = 일반 매물).
  qty?: number | null;
  // Wave 138 (2026-05-16): seller_uid — 같은 셀러가 다수 매물 등록 시 차단 (qty 위장 업자).
  // DB 발견: 1명 셀러가 같은 매물명 46/45/40/36건 반복 등록 패턴.
  sellerUid?: string | null;
  // Wave 138b (2026-05-16): description hash — 다중 ID 사기 그룹 탐지.
  // DB 발견: 동일 description 27건이 7명 셀러 ID로 분산 (복붙 = 부캐).
  descriptionHash?: string | null;
  // Wave 145 (2026-05-16): 셀러 신뢰도 — 가품 detection v2 강화.
  // 신뢰도 낮은 셀러 (review_count < 5 OR rating < 4.5) + msrp * 0.25 이하 = 가품 의심.
  shopReviewCount?: number | null;
  shopReviewRating?: number | null;
  // Wave 148 (2026-05-16): 광고/소매 매물 차단 — description 검사.
  // 사이즈 다중 표기 / "행사할인특가" / "[구매하기]" 같은 광고문 매물 = 개인 거래 아님.
  // 시세 부정확 + 가품 risk + 카드 추천 부적합.
  descriptionPreview?: string | null;
};

export type PoolParsedInput = {
  category: Sku["category"] | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json?: Record<string, unknown> | null;
  // Wave 130 (2026-05-16): condition_class — pool entry에 박아서 시세/profit 계산 시 조회.
  condition_class?: string | null;
};

export type CandidatePoolBuildResult = {
  entries: Record<string, unknown>[];
  invalidations: { pid: number; reason: string }[];
  skipped: number;
};

// Lane-aware pool gate. A SKU tagged with a `ready` laneKey enters the pool
// even when its broader category is `internal_only`. SKUs without a lane (or
// whose lane is itself blocked) fall back to the category gate.
export function evaluatePoolGate(
  input: { sku?: Sku | null; category: Sku["category"] | null },
  maps: { categoryReadiness?: CategoryReadinessMap; laneReadiness?: LaneReadinessMap } = {},
): CategoryReadinessDecision {
  const laneMap = maps.laneReadiness ?? LANE_READINESS;
  const laneDecision = evaluateLaneReadinessForSku(input.sku ?? undefined, laneMap);
  if (laneDecision && laneDecision.status === "ready") return laneDecision;

  const categoryDecision = evaluateCategoryReadiness(input.category, maps.categoryReadiness);

  // Lane exists but is blocked → surface the lane reason instead of silently
  // falling through to category readiness (which might be `ready`).
  if (laneDecision && laneDecision.status !== "ready") {
    return {
      ...categoryDecision,
      status: "blocked",
      canEnterPool: false,
      reason: laneDecision.reason,
      laneKey: laneDecision.laneKey,
    };
  }
  return categoryDecision;
}

export function buildCandidatePoolRows(input: {
  rows: PoolCandidateInput[];
  parsedByPid: Map<number, PoolParsedInput>;
  catalogById: Map<string, Sku>;
  categoryReadiness: CategoryReadinessMap;
  laneReadiness?: LaneReadinessMap;
  now: string;
  // Wave 138 (2026-05-16): pool에 이미 있는 셀러별 매물 수 (tick-pipeline이 사전 fetch).
  // 같은 seller_uid가 이미 N개 매물 가지면 추가 매물 차단.
  existingPoolSellerCounts?: Map<string, number>;
  // Wave 138b (2026-05-16): pool + raw_listings의 description_hash별 unique seller set.
  // 같은 hash + 다른 셀러 2+ = 다중 ID 사기 그룹 → 그 hash 매물 모두 차단.
  fraudGroupHashes?: Set<string>;
}): CandidatePoolBuildResult {
  const entries: Record<string, unknown>[] = [];
  const invalidations: { pid: number; reason: string }[] = [];
  let skipped = 0;

  // Wave 138: 이번 batch 안에서 seller별 counter (외부 existing 합산).
  // 가장 score 높은 매물부터 통과시켜야 정확. rows를 score 내림차순 sort.
  const existingSellerCounts = input.existingPoolSellerCounts ?? new Map<string, number>();
  const batchSellerCounts = new Map<string, number>();
  // Wave 138b: fraud group hash set (외부 사전 계산). 같은 hash 다른 셀러 2+ 인 hash들.
  const fraudGroupHashes = input.fraudGroupHashes ?? new Set<string>();
  const sortedRows = [...input.rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  for (const row of sortedRows) {
    const pid = Number(row.pid);
    if (row.poolEligible === false) {
      skipped += 1;
      invalidations.push({ pid, reason: "pool_eligible_false" });
      continue;
    }

    // 2026-05-15: 200만원 이상 매물 풀 차단 (정책).
    if (Number.isFinite(row.price) && row.price > MAX_POOL_PRICE_KRW) {
      skipped += 1;
      invalidations.push({ pid, reason: "price_above_pool_max" });
      continue;
    }

    // Wave 148 (2026-05-16): 광고/소매 매물 차단 — description 광고문 패턴.
    // 발견: 81건 광고 매물 (25명 셀러). "행사할인특가" / "[구매하기]" / 사이즈 다중 표기.
    // 광고 매물 = 개인 거래 X, 시세 부정확, 가품 risk.
    if (row.descriptionPreview && typeof row.descriptionPreview === "string") {
      const desc = row.descriptionPreview;
      const AD_PATTERNS = [
        /\[구매하기\]/,
        /요청\s*사항에\s*(원하|색상|사이즈)/,
        /배송\s*평균\s*\d/,
        /배송\s*기간\s*평균/,
        /주문\s*방법/,
        /행사\s*할인\s*특가/,
        /행사\s*기간/,
        // 사이즈 다중 표기 (4+ 사이즈 콤마 구분) — 재고 보유 광고 매물
        /\b2[2-9]\d\s*[,\/]\s*2[2-9]\d\s*[,\/]\s*2[2-9]\d\s*[,\/]\s*2[2-9]\d/,
        // 가격 변동 공지
        /행사\s*기간\s*후\s*금액/,
        /가격\s*변동\s*있을/,
      ];
      if (AD_PATTERNS.some((re) => re.test(desc))) {
        skipped += 1;
        invalidations.push({ pid, reason: "ad_or_retail_listing" });
        continue;
      }
    }

    // Wave 132 (2026-05-16): 댓글 수 >= 8 매물 풀 진입 차단 (사용자 정책).
    // 흥정/문의 많음 = 호가-실거래 괴리 → 추천 의미 없음. NULL은 통과 (detail 미수집 → 다음 tick에서 재평가).
    if (row.numComment != null && Number.isFinite(row.numComment) && row.numComment >= MAX_POOL_NUM_COMMENT) {
      skipped += 1;
      invalidations.push({ pid, reason: `num_comment_above_${MAX_POOL_NUM_COMMENT}` });
      continue;
    }

    // Wave 137 (2026-05-16): 수량 > 1 매물 풀 진입 차단 (Wave 136 audit 발견).
    // qty > 1 = 대량 판매업자 (1:1 거래 X). 일반 사용자 추천 의미 없음.
    if (row.qty != null && Number.isFinite(row.qty) && row.qty > MAX_POOL_QTY) {
      skipped += 1;
      invalidations.push({ pid, reason: `qty_above_${MAX_POOL_QTY}` });
      continue;
    }

    // Wave 138 (2026-05-16): 같은 seller_uid 다수 매물 차단 — qty 위장 업자 탐지.
    // DB 발견 패턴: 1명 셀러가 같은 매물 46/45/40/36건 반복 등록 (qty=1 분산).
    // 정책: 셀러당 pool 매물 1개만 허용 (score 가장 높은 것). 나머지 차단.
    if (row.sellerUid) {
      const existingCount = existingSellerCounts.get(row.sellerUid) ?? 0;
      const batchCount = batchSellerCounts.get(row.sellerUid) ?? 0;
      if (existingCount + batchCount >= MAX_POOL_LISTINGS_PER_SELLER) {
        skipped += 1;
        invalidations.push({ pid, reason: `seller_above_${MAX_POOL_LISTINGS_PER_SELLER}_listings` });
        continue;
      }
      batchSellerCounts.set(row.sellerUid, batchCount + 1);
    }

    // Wave 138b (2026-05-16): 다중 ID 사기 그룹 차단 — description hash 다른 셀러 2+.
    // DB 발견: 동일 description text 27건이 7명 셀러 ID로 분산 (복붙 = 부캐 그룹).
    // tick-pipeline이 사전 계산한 fraudGroupHashes set 활용.
    if (row.descriptionHash && fraudGroupHashes.has(row.descriptionHash)) {
      skipped += 1;
      invalidations.push({ pid, reason: `multi_id_fraud_group_${MIN_SELLERS_FOR_FRAUD_GROUP}_sellers` });
      continue;
    }

    // 2026-05-15 (사용자 코멘트 pid 407879893): multi_device_bundle 매물 풀 차단.
    // 예: "아이폰17 + 애플워치 SE3" — 양쪽 카테고리 시세 어느 쪽과도 정확히 비교 불가.
    //
    // Wave 106 정책 정정 (#46): MJ 명시 — bundle/미개봉/애플케어는 풀 허용 (꿀 매물).
    //   - "본품 시세보다 싸면 무조건 핫딜". 풀 차단 시 핫딜 매물 X.
    //   - 시세 sample 에서만 제외 (tick-pipeline.ts:2484+ Wave 106 #43c) → 시세 정확.
    //   - 미개봉은 별도 카테고리 추후 박을 예정.
    // 진짜 풀 차단해야 할 것:
    //   - multi_device_bundle (양쪽 카테고리 어느 쪽과도 비교 불가)
    //   - display_defect / screen_replaced / faceid_issue (사용자가 사면 명확한 손해)
    const preCheckNotes = (input.parsedByPid.get(pid)?.parsed_json?.condition_notes as string[] | undefined) ?? [];
    // 2026-05-15 Wave 117: parts_only 추가 (부품용/수리용/셀러용 명시 매물).
    // 일반 사용자 풀 차단 — 리셀 업자 lane 신설 시 해당 lane 전용 builder 가 별도 풀로 흡수.
    const POOL_BLOCK_NOTES = [
      "multi_device_bundle",
      "display_defect",
      "screen_replaced",
      "faceid_issue",
      "parts_only",
    ];
    const noteHit = POOL_BLOCK_NOTES.find((n) => preCheckNotes.includes(n));
    if (noteHit) {
      skipped += 1;
      invalidations.push({ pid, reason: `condition_note_${noteHit}` });
      continue;
    }

    const sellFee = Math.round(row.skuMedian * SELLING_FEE_RATE);
    const buyMax = row.price + (row.shippingFeeGeneral ?? row.shippingFee);
    const buyMin = row.estimatedBuyCost;
    const profitMax = Math.max(0, row.skuMedian - buyMin - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const profitMin = Math.max(0, row.skuMedian - buyMax - sellFee - RESELL_SHIPPING_FEE - SAFETY_BUFFER);
    const band = bandFromProfit(profitMin, profitMax);
    if (band === null) {
      skipped += 1;
      invalidations.push({ pid, reason: "profit_below_pack_band" });
      continue;
    }

    const parsed = input.parsedByPid.get(pid);
    const sku = input.catalogById.get(row.skuId ?? "");
    const category = parsed?.category ?? sku?.category ?? null;

    // Wave 141 (2026-05-16): 시세 floor 가품 detection — 신발/가방 카테고리.
    // 패턴: price < max(msrp, skuMedian) * 0.15 (85% 이상 할인) → 가품 확실
    // 발견 (Iter 3): 990v5 msrp 269k → 9k (3.3%), 2976 9k (3.8%), 327 10k (7.2%) 등
    //   shop_review_count 높아도 가품 가능 → msrp 기준 차단이 가장 안전.
    // 한정판 매물도 fair: skuMedian이 msrp보다 크면 시세 기준.
    // 신발/가방만 적용 (제조 진입장벽 낮음). 전자기기는 fake 적음.
    // Wave 145 (2026-05-16): v2 강화 — 셀러 신뢰도 + 가격 floor 결합.
    //   tier 1: price < ref * 0.15 (85% 할인) → 가품 확실 (review 무관)
    //   tier 2: price < ref * 0.25 (75% 할인) + 셀러 review_count < 5 OR rating < 4.5 → 가품 의심
    const FAKE_FLOOR_CATEGORIES = new Set<string>(["shoe", "bag"]);
    const FAKE_FLOOR_RATIO_T1 = 0.15;
    const FAKE_FLOOR_RATIO_T2 = 0.25;
    if (
      sku?.msrpKrw &&
      row.price > 0 &&
      category &&
      FAKE_FLOOR_CATEGORIES.has(category)
    ) {
      const referencePrice = Math.max(sku.msrpKrw, row.skuMedian ?? 0);
      // Tier 1: 절대 가품 (review 무관)
      if (row.price < referencePrice * FAKE_FLOOR_RATIO_T1) {
        skipped += 1;
        invalidations.push({ pid, reason: `fake_suspect_t1_below_${Math.round(FAKE_FLOOR_RATIO_T1 * 100)}pct` });
        continue;
      }
      // Tier 2 (Wave 145): 25% 이하 + 셀러 신뢰도 낮음
      const reviewCount = row.shopReviewCount ?? null;
      const reviewRating = row.shopReviewRating ?? null;
      const lowSellerTrust = (reviewCount != null && reviewCount < 5) || (reviewRating != null && reviewRating < 4.5);
      if (row.price < referencePrice * FAKE_FLOOR_RATIO_T2 && lowSellerTrust) {
        skipped += 1;
        invalidations.push({ pid, reason: `fake_suspect_t2_unverified_seller_below_${Math.round(FAKE_FLOOR_RATIO_T2 * 100)}pct` });
        continue;
      }
    }

    // Wave 106 #47 정정: smartphone carrier null 차단 revert.
    // Wave 115/115b 가 catalog narrow lane 에 자급제 동의어 박아 ("정상해지/확정기변/노옵션/
    // 타통신사/유심꽂고/무약정") narrow lane 통과 = 자급제 의미 부여.
    // 단 parser 의 parseCarrier 는 옛 그대로 ("자급제" 만 매칭) → narrow lane 통과한 진짜 자급제
    // 매물도 carrier=null 가능 → #43c 차단이 자급제 매물 빼냄.
    // 차단 정책 자체 폐기. narrow lane 가 자급제 의미 보장.

// Wave 106: comparable_key 에 critical_unknown 토큰 박힌 매물 풀 진입 차단 (systemic).
    // option-parser.ts:criticalUnknown 정의 — 카테고리별 critical:
    //   tablet: unknown_chip, unknown_screen, unknown_storage, unknown_connectivity
    //   laptop: unknown_generation, unknown_chip, unknown_ram, unknown_ssd
    //   smartphone: unknown_storage
    //   smartwatch: unknown_size
    //   earphone: unknown_connector, unknown_anc
    //   desktop: unknown_ram, unknown_ssd (Wave 106 추가)
    // unknown_X 박힌 매물 풀 진입 시 같은 unknown 그룹 내 다른 변형과 시세 mixed →
    // 사용자 카드에 잘못된 sku_median (베타테스터 보고 #40 패턴).
    // 정확성 우선 (§12b): 식별 안 되는 옵션 매물은 풀 진입 X.
    // unknown_connectivity 만 less critical (wifi/cellular 가격 차이 작음) — 차단 안 함.
    const comparableKeyEarly = parsed?.comparable_key ?? "";
    const CRITICAL_UNKNOWN_TOKENS = [
      "unknown_chip", "unknown_generation", "unknown_storage", "unknown_screen",
      "unknown_ram", "unknown_ssd", "unknown_size", "unknown_connector", "unknown_anc",
    ];
    const unknownHit = CRITICAL_UNKNOWN_TOKENS.find((t) => comparableKeyEarly.includes(t));
    if (unknownHit) {
      skipped += 1;
      invalidations.push({ pid, reason: `comparable_key_${unknownHit}` });
      continue;
    }

    const readiness = evaluatePoolGate(
      { sku, category },
      { categoryReadiness: input.categoryReadiness, laneReadiness: input.laneReadiness },
    );
    const confidence = computePoolConfidence(Number(parsed?.parse_confidence ?? 0.5), row.scoreFlags);
    const comparableKey = parsed?.comparable_key ?? null;
    const skipReason = poolSkipReason({
      profitMin,
      price: row.price,
      saleStatus: row.saleStatus,
      skuMedian: row.skuMedian,
      riskHits: row.riskHits,
      thumbnailUrl: row.thumbnailUrl,
      categoryCanEnterPool: readiness.canEnterPool,
      categoryReason: readiness.reason,
      comparableKey,
      needsReview: Boolean(parsed?.needs_review),
      confidence,
      scoreFlags: row.scoreFlags,
    });

    if (skipReason) {
      skipped += 1;
      invalidations.push({ pid, reason: skipReason });
      continue;
    }

    entries.push({
      pid,
      profit_band: band,
      category,
      expected_profit_min: profitMin,
      expected_profit_max: profitMax,
      score: row.score,
      confidence,
      comparable_key: comparableKey,
      // Wave 130 (2026-05-16): 매물 condition_class — pack open 시 condition별 시세 매칭에 사용.
      // parsed.condition_class가 없으면 normal (default).
      condition_class: parsed?.condition_class ?? "normal",
      max_exposure: poolMaxExposure(band),
      last_verified_at: input.now,
      updated_at: input.now,
    });
  }

  return { entries, invalidations, skipped };
}
