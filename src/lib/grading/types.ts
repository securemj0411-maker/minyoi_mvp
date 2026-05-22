// Wave 714 (2026-05-23): 신발/의류 condition grading 체계 — 5-tier S/A/B/C/D.
//
// 출처: 미뇨이 신발 raw 5-axis cross-tab 분석 11,087건 (2026-05-23).
// 기존 condition-policy.ts (전자기기 unopened/mint/clean/normal/worn 등) 와 별도 모듈.
//
// 5-tier 선정 근거 (데이터 자연 cluster):
//   Mode peak  (2.0x+):     ~140건  (kream + 미시착/풀구성 2축 이상 동시)
//   Mode premium (1.4~1.7x): ~1,100건 (단일 strong)
//   Mode baseline (0.9~1.15x): ~7,300건 (대다수, 정보 부족 포함)
//   Mode discount (0.5~0.7x):  ~280건  (경미 하자)
//   Mode deep_discount (<0.5x): ~700건 (빈티지 / 심각 하자)
//
// 한국 reseller 자체 라벨 'S/A/B급' (의류 sweep n=123 발견) 과 align — 일반인 친숙.

export type ConditionTier = "S" | "A" | "B" | "C" | "D" | "UNKNOWN";

/**
 * Tier weight (B baseline = 1.00 normalize).
 * 신발 cross-tab n=11,087 의 median ratio 기반.
 */
export const TIER_WEIGHT: Record<ConditionTier, number> = {
  S: 2.00,
  A: 1.50,
  B: 1.00,
  C: 0.65,
  D: 0.42,
  UNKNOWN: 0.85, // 보수적 default — false positive 방지 (사용자 비싸게 사도록 X)
} as const;

/** Tier ladder (인접 거리 계산용). UNKNOWN 은 ladder 밖. */
export const TIER_LADDER: ReadonlyArray<Exclude<ConditionTier, "UNKNOWN">> = [
  "S",
  "A",
  "B",
  "C",
  "D",
] as const;

/**
 * 신발 raw text → 5-axis 라벨.
 * cross-tab agent (ac955968c16adba21) 의 axis 정의 동일.
 */
export interface AxisLabels {
  /** A — 사용감 */
  wear: "unknown" | "unworn" | "worn_1to2" | "worn_3to5" | "used" | "heavily_used" | "vintage";
  /** B — 박스 */
  box: "unknown" | "full" | "box_included" | "box_only" | "no_box" | "box_damaged";
  /** C — 정품 anchor */
  auth: "none" | "kream" | "store" | "musinsa";
  /** D — 하자 (negation 차단 적용) */
  damage: "none" | "minor" | "major";
  /** E — 신발 특화 */
  shoe: "none" | "extra_laces" | "insole_changed" | "washed";
}

/**
 * 의류 raw text → 5-axis 라벨.
 * cross-tab agent (a2d7c17a34f40235e, 2026-05-23) 의 axis 정의 동일.
 *
 * 신발과 차이:
 * - box axis 무력 (97.9% B0) → tag 표현 + 시즌 + 콜라보 + 자율등급으로 대체
 * - A7_gunje (구제) 추가 — 의류 only
 * - C4_season (SS/FW 연도) 추가 — 의류 최강 anchor (3.27x)
 * - D4_repair_pos (수선) 추가 — POSITIVE 신호 (신발과 반대)
 * - E1_collab / E2_self_grade / E3_x10_score 의류 특화
 */
export interface ClothingAxisLabels {
  /** A — 사용감 (구제 포함) */
  wear:
    | "unknown"
    | "unworn"
    | "worn_1to2"
    | "worn_3to5"
    | "used"
    | "heavily_used"
    | "vintage"
    | "gunje";
  /** B — 박스/태그 (의류는 95%+ unknown) */
  box: "unknown" | "full" | "tag_attached" | "tag_only_cut" | "no_box_no_tag";
  /** C — 정품 anchor (season = SS/FW 연도 — 의류 only 최강) */
  auth: "none" | "kream" | "store" | "musinsa" | "season";
  /** D — 하자 (repair_pos = positive — 신발과 반대) */
  damage: "none" | "minor" | "major" | "repair_pos";
  /** E — 의류 특화 */
  extra: "none" | "collab" | "self_grade" | "x10_score";
}

/**
 * Brand cluster — 시세 baseline + 일부 axis weighting 차이.
 *
 * 신발 cluster:
 * - premium_snk: Jordan/Yeezy/NB/Salomon/On — baseline ₩145K, kream lift +24%
 * - run_tech: Asics/Hoka — baseline ₩133K, kream 비율 ↑
 * - volume_vintage: Nike/Adidas/Converse/Vans — baseline ₩80K, kream lift +56%
 * - casual_parts: Crocs — 박스 axis 무력 (3%만), 지비츠가 박스 자리. **별도 grading rule**.
 *
 * 의류 cluster (cross-tab agent a2d7c17a34f40235e, 2026-05-23):
 * - premium_archive: RRL/Stone Island/Arc'teryx/FOG — baseline ₩350K (3.27x)
 * - volume_vintage_cloth: Polo/Carhartt/Patagonia — baseline ₩70K, vintage 22.9% 압도
 * - collab_heavy: Stussy/BAPE/CDG/TNF — baseline ₩114K, collab 8-15%
 * - casual_mass: Adidas/MLB 의류 — baseline ₩72K, A1_unworn 1.62x
 *
 * - generic: 미분류
 */
export type BrandCluster =
  | "premium_snk"
  | "run_tech"
  | "volume_vintage"
  | "casual_parts"
  | "premium_archive"
  | "volume_vintage_cloth"
  | "collab_heavy"
  | "casual_mass"
  | "generic";

export interface TierEvidence {
  /** 매칭된 positive 표현. */
  positive: string[];
  /** 매칭된 negative (하자) 표현. */
  negative: string[];
  /** axis 라벨링 결과 (debug). 신발=AxisLabels, 의류=ClothingAxisLabels. */
  axes: AxisLabels | ClothingAxisLabels;
  /** Raw text 길이. 50 미만이면 신뢰도 낮음. */
  rawTextLength: number;
  /** bunjang_condition_label prior. */
  enumPrior: string | null;
  /** 등급 결정 이유 (debug). */
  reason: string;
}

/**
 * 부가 flag (등급 추가 X, UI 표시 + 시세 multiplier 가산).
 *
 * - tailored: 의류 수선/줄임/기장 줄임 — +10% (사용자 결정, 데이터 1.59x raw)
 * - season_anchor: 의류 SS/FW 연도 표기 — premium_archive cluster marker
 * - collab: 콜라보/한정판 — 콜라보 cluster multiplier
 */
export interface ConditionFlags {
  tailored?: boolean;
  seasonAnchor?: boolean;
  collab?: boolean;
}

export interface ConditionGrade {
  tier: ConditionTier;
  cluster: BrandCluster;
  /**
   * Confidence 0~1. raw 표현 매칭 수 + length 기반.
   * UI 신뢰도 표시용 — 낮으면 "정보 부족" 마킹.
   */
  confidence: number;
  evidence: TierEvidence;
  /** 부가 flag (의류 only — A+ multiplier). 신발은 undefined. */
  flags?: ConditionFlags;
  /**
   * 정규화된 chip key array (UI 표시 / 필터 / 검색 용).
   *
   * 형식: `<axis>:<value>` (예: "wear:unworn", "box:full", "auth:kream").
   * 한 listing 에 여러 chip 동시 보유 가능 (axis 5개 × 각 1 chip = 최대 5~6).
   *
   * 사용자 요구: "이식성 강하게 정규화" + "동시에 여러 chip" + "/me 페이지 상세보기 chip".
   * 이번 wave 는 **positive chip 만** (negative 는 다음 세션).
   * 한국어 라벨/색상 mapping: `grading/chips.ts:CHIP_LABELS`.
   */
  chips: string[];
}
