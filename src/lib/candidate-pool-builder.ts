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
};

export type PoolParsedInput = {
  category: Sku["category"] | null;
  comparable_key: string | null;
  parse_confidence: number | null;
  needs_review: boolean | null;
  parsed_json?: Record<string, unknown> | null;
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
}): CandidatePoolBuildResult {
  const entries: Record<string, unknown>[] = [];
  const invalidations: { pid: number; reason: string }[] = [];
  let skipped = 0;

  for (const row of input.rows) {
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
      max_exposure: poolMaxExposure(band),
      last_verified_at: input.now,
      updated_at: input.now,
    });
  }

  return { entries, invalidations, skipped };
}
