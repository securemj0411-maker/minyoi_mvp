import { createHash } from "node:crypto";

import type { Sku } from "@/lib/catalog";
// Wave 92: 신규 카테고리 (shoe/bag/bike) parser는 별도 모듈에서 dispatch.
import { parseFashionMobility } from "@/lib/parsers/wave92-fashion-mobility";
import { parseGameConsoleListing } from "@/lib/game-console-parser";
// Wave 182 Phase 3 (2026-05-17): base option fallback (옵션 명시 X → 가장 낮은 옵션 가정).
import { baseOptionsFor } from "@/lib/sku-base-options";
import { parseEarphoneConditionEvidence } from "@/lib/condition-evidence/earphone";
import { parseTechDeviceConditionEvidence } from "@/lib/condition-evidence/tech-device";

export type ParsedListingOptions = {
  parserVersion: string;
  contentHash: string;
  category: Sku["category"] | null;
  family: string | null;
  model: string | null;
  variantKey: string | null;
  comparableKey: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  releaseYear: number | null;
  batteryHealth: number | null;
  batteryCycles: number | null;
  carrier: string | null;
  connectivity: string | null;
  conditionScore: number;
  conditionNotes: string[];
  // Wave 130 (2026-05-16): condition_notes로부터 derive된 단일 등급 (5-class).
  // 시세 산정/조회 시 condition별 grouping에 사용. 사업 보고서 L2 retention factor.
  // 같은 SKU+옵션 매물이라도 condition별 시세 spread 15~40% 측정됨 (airpods_max|usbc: mint 550K vs worn 430K).
  conditionClass: ConditionClass;
  parseConfidence: number;
  needsReview: boolean;
  parsedJson: Record<string, unknown>;
};

// Wave 130 (2026-05-16): condition class 5단계. 같은 SKU+옵션 매물에서 condition별 시세 분리용.
// 우선순위 (높은 → 낮은): flawed > mint > low_batt > clean > worn > normal
// - flawed: 손상/문제 매물 (시세 산정 및 풀 진입 모두 차단 — 현재 정책 유지)
// - mint: 새상품/미개봉/배터리 100%
// - low_batt: 배터리 <85% (가격 영향 큼, 별도 트래킹)
// - clean: S급/풀세트/애플케어 (프리미엄)
// - worn: 사용감/기스/스크래치 (시장 평균보다 약간 낮음)
// - normal: 마킹 없거나 일반 사용 (default)
// 2026-05-16 (N4 사용자 코멘트 id 104/109): "민트랑 새상품 미개봉은 다르다".
// unopened (박스 안 뜯음, 다나와 새 가격 비교) vs mint (실사용 거의 없음 S급, 중고 시세 비교) 분리.
// Wave 130까지는 new_or_open_box → mint 합쳐졌었음. N4에서 unopened 별도 클래스로 분리.
export type ConditionClass =
  | "flawed"
  | "unopened"
  | "mint"
  | "low_batt"
  | "clean"
  | "worn"
  | "normal";

// 2026-05-17 v46 cleanup: export — condition-policy.ts 가 POOL_BLOCK_NOTES subset 검증에 사용.
export const FLAWED_NOTES = [
  "display_defect",
  "device_body_damage",
  "foldable_hinge_damage",
  "screen_replaced",
  "faceid_issue",
  "camera_issue",
  "camera_lens_damage",
  "sim_or_carrier_issue",
  "water_damage",
  "locked_or_lost_signal",
  "parts_only",
  "multi_device_bundle",
  "repair_or_defect_signal",
  "device_charging_or_sensor_issue",
  "refurbished_or_repaired",
  "installment_risk",
  // Wave 204 (2026-05-18): buy-intent 매물 (구함/삽니다/매입) — 정상 거래 X (사용자 손해 명확).
  "buying_post",
  "exchange_only",
  // Wave 207 (2026-05-18): earphone single-side (한쪽만) — 페어 단위 매물 아님 (시세 부풀림).
  "single_side_only",
  // Wave 208 (2026-05-18): "X용 + 액세서리" 호환 매물 — 본품 sku 매칭 잘못 (시세 부풀림).
  "accessory_compatible_for_other_product",
] as const;

// Wave 203 (2026-05-18): "battery_high_health" 추가 — 95~99% 배터리 객관적 신호.
// 100% 만 박힌 battery_perfect 보다 약하지만 사용감 적은 매물 강한 객관 증거.
const CLEAN_NOTES = ["good_condition", "full_set", "applecare_premium", "battery_perfect", "battery_high_health"] as const;

/**
 * Wave 130: condition_notes[] → ConditionClass (single label).
 * 우선순위 처리: flawed가 하나라도 있으면 flawed (시세/풀 차단 대상).
 * 명시적 신호가 없으면 normal로 default. accessory_bundle은 condition이 아니라
 * "본품+액세서리 묶음"이라 시세 sample에서 제외되지만 condition_class에는 영향 X.
 */
// 2026-05-16 v46: conservative ordering — negative signal always wins.
// 기존: flawed > unopened > low_batt > clean > worn > normal (positive 신호 우선)
// 문제: cosmetic_wear + good_condition 동시 → clean 으로 정확도 손실 (pid 352131281 케이스)
// 새: flawed > low_batt > worn > unopened > clean > normal (negative 우선, positive 중엔 강한 거)
// 사용자 정책: "둘 중 낮은 등급" — description 자체 multi-signal 도 같은 원칙.
export function extractConditionClass(conditionNotes: readonly string[]): ConditionClass {
  if (!Array.isArray(conditionNotes) || conditionNotes.length === 0) return "normal";
  const set = new Set(conditionNotes);
  // 1순위: 손상/문제 — 강한 negative, 항상 우선
  for (const n of FLAWED_NOTES) {
    if (set.has(n)) return "flawed";
  }
  // 2순위: 배터리 저하 — special (가격 modifier, condition_class 와 별개로 가격 영향 큼)
  if (set.has("low_battery_health")) return "low_batt";
  // 3순위: 사용감/기스 — negative description 신호. positive 신호 (clean/unopened) 있어도 우선.
  // 이유: 셀러가 "기스 있어요" 라고 명시 = 정직. positive 신호는 인플레 가능. 보수적 선택.
  if (set.has("cosmetic_wear")) return "worn";
  // 4순위: new_or_open_box — positive 중 가장 강한 신호 (박스 미개봉)
  if (set.has("new_or_open_box")) return "unopened";
  // 5순위: S급/풀세트/애플케어/배터리100 (프리미엄 positive)
  for (const n of CLEAN_NOTES) {
    if (set.has(n)) return "clean";
  }
  return "normal";
}

// Wave 236f (2026-05-19): ParseInput 통합 export — wave92-fashion-mobility 도 같은 type 사용 (drift 방지).
//   audit 발견: option-parser.ts + wave92-fashion-mobility.ts 둘 다 ParseInput 별도 정의 →
//     향후 한쪽 update 잊으면 silent drift. 통합 import 로 fix.
export type ParseInput = {
  title: string;
  description?: string;
  skuId?: string | null;
  skuName?: string | null;
  category?: Sku["category"] | null;
  // Wave 140 (2026-05-16 사용자 코멘트 #122): 번개 detail API 의 product.condition.
  // "사용감 많음" / "사용감 적음" / "사용감 없음" / "거의 새것" / "새상품" 등.
  // 셀러가 직접 선택한 metadata — description 자연어 false positive 보다 신뢰도 높음.
  bunjangConditionLabel?: string | null;
  // Wave 236d (2026-05-19): catalog SKU 의 defaultProductType (model=type 1개 확정인 SKU만).
  //   text 에서 product-type regex 실패 시 fallback. 미박힘 SKU → needsReview 차단.
  defaultProductType?: string | null;
};

// Wave 140 (2026-05-16): 번개 condition label → condition_class 매핑.
// 2026-05-16 v46: 더 이상 strong override 아님. resolveConditionClass 에서 conservative 결합.
// 2026-05-17 v47: bunjang detail API 실제 응답은 **영어 enum** (DAMAGED/HEAVILY_USED/USED/LIGHTLY_USED/LIKE_NEW/NEW).
//   이전엔 한글 정규식만 매칭 → 3,798건 metadata 전부 무시 + AI trigger도 skip (`!detail.conditionLabel`).
//   영어 enum 매핑 추가 + 한글 fallback 보존 (legacy/edge).
export function bunjangLabelToConditionClass(label: string | null | undefined): ConditionClass | null {
  if (!label) return null;
  // 영어 enum (bunjang detail API 실제 응답)
  const upper = label.trim().toUpperCase().replace(/\s+/g, "_");
  if (upper === "DAMAGED") return "flawed";
  if (upper === "HEAVILY_USED") return "worn";
  if (upper === "USED") return "worn"; // 15건만, 명시 "사용감 있음" — 보수적
  if (upper === "LIGHTLY_USED") return "normal";
  if (upper === "LIKE_NEW") return "clean";
  if (upper === "NEW") return "unopened";
  // 한글 fallback (legacy/edge)
  const lk = label.toLowerCase().replace(/\s+/g, "");
  if (/사용감많음|많이사용/.test(lk)) return "worn";
  if (/사용감없음|사용감거의없음|거의새것|새것같|새상품급/.test(lk)) return "clean";
  if (/사용감적음|상태좋|좋음/.test(lk)) return "normal";
  if (/새상품|미개봉/.test(lk)) return "unopened";
  return null;
}

// 2026-05-16 v46: condition_class ranking — 낮을수록 낮은 등급.
// low_batt 는 special (가격 modifier, ordering 밖).
// Wave 254.5 step 1 (2026-05-20): export — fashion parser 도 worst-of 결합에 사용.
export const CONDITION_RANK: Record<Exclude<ConditionClass, "low_batt">, number> = {
  flawed: 0,
  worn: 1,
  normal: 2,
  clean: 3,
  mint: 4,
  unopened: 5,
};

// 2026-05-16 v46: metadata + description 결합. 사용자 정책 "보수적 (낮은 등급) 우선".
//   - meta 없음 → notes 만
//   - notes == normal (무신호) → meta 신뢰
//   - low_batt 한쪽 있음 → low_batt (가격 modifier, 항상 우선)
//   - 둘 다 신호 → worse-of (낮은 rank)
// Wave 209 (2026-05-18): 객관적 measurement 우선 — strong objective signal 은 metadata worse-of 무시.
// 사용자 통찰 (재확인): "메타데이터는 신뢰도 높지 않아서 ... 배터리 효율 / 사이클수 객관적 새거면 다르게 봐야".
// Wave 203 박았는데도 사용자 #159 매물 normal — worse-of 가 metadata "사용감 적음" 우선.
// 근본 fix: notes 에 objective clean signal (battery_high_health / battery_perfect) 있으면 description 우선.
//   - 객관적 measure (배터리 95+) = 셀러 자연어/metadata 보다 강한 신호.
//   - 단 cosmetic_wear 등 description negative 신호 있으면 그대로 worse-of (사용자 정책 유지).
export function resolveConditionClass(
  fromMeta: ConditionClass | null,
  fromNotes: ConditionClass,
  hasObjectiveCleanSignal: boolean = false,
): ConditionClass {
  if (!fromMeta) return fromNotes;
  if (fromMeta === "low_batt" || fromNotes === "low_batt") return "low_batt";
  if (fromNotes === "normal") return fromMeta;
  // Wave 209: objective clean signal 우선 — metadata override 무시.
  // notes 가 clean 이상이고 객관적 신호 있으면 description 신뢰 (metadata 의 "사용감 적음" worse-of 차단).
  // 단 metadata flawed (DAMAGED — 셀러 명시적 손상) 는 무조건 우선 — 객관적 신호로 무시 안 함 (안전).
  if (hasObjectiveCleanSignal && fromMeta !== "flawed" && CONDITION_RANK[fromNotes] >= CONDITION_RANK.clean) {
    return fromNotes;
  }
  return CONDITION_RANK[fromMeta] <= CONDITION_RANK[fromNotes] ? fromMeta : fromNotes;
}

// 2026-05-16 v46 cleanup: export — reparse-listings/route.ts 등 다른 곳에서 import.
// 이전: route.ts 에 별도 const 박혀서 silent drift 위험 (수동 sync 필요).
// Wave 202 (2026-05-18) v49: 액세서리 generation 노이즈 제거 + model 분기 우선 (iPad Air/Pro/Mini).
// 이전: "에어 4 + 애플펜슬 2세대" → 2_gen|a8x 잘못 매칭 (액세서리 "2세대"가 generation 으로 캡처).
// Wave 203 (2026-05-18) v50: 셀러 "미개봉" + 배터리 measure 모순 감지 — 거짓 unopened 차단.
//   진짜 미개봉이면 배터리 % measure 불가능 (박스 안 뜯음). 셀러 거짓말 false positive 차단.
//   + battery 95~99% "battery_high_health" 신호 추가 (객관적 clean 증거).
// Wave 204 (2026-05-18) v51: buy-intent 매물 broad catalog 일반 차단.
//   사용자 코멘트 #155 — "갤탭 구함" broad SKU 통과. narrow lane only → 일반화.
//   buying_post note 신규 → FLAWED + POOL_BLOCK + COMPARABLE_EXCLUDE 모두 추가.
// Wave 205 (2026-05-18) v52: refurbished 분리 — 공식 리퍼 vs 사설/부분 수리.
//   사용자 코멘트 #158 — "DJI 오즈모 포켓3 리퍼 미개봉" → flawed 분류 잘못.
//   refurbished_factory (FLAWED 아님) vs refurbished_or_repaired (FLAWED) 분리.
// Wave 206 (2026-05-18): damage signal 변형 보강 ("떨어트림", 본체 안 닫힘).
//   사용자 코멘트 #160 — "본체가 안닫히고 떨어트림 많음" → worn (잘못).
// Wave 207 (2026-05-18): earphone single-side (한쪽만) 매물 차단.
//   사용자 코멘트 #153 — "에어팟프로2세대 C타입 왼쪽" → 본체 SKU 매칭 잘못.
// Wave 208 (2026-05-18) v53: "X용 + 액세서리" 호환 매물 일반 차단.
//   사용자 코멘트 #157 — "DJI 오즈모 액션6 용 pov 렌즈" → 본체 매칭 잘못.
//   drone-only catalog NOISE → parser 일반 detection.
// Wave 209 (2026-05-18) v54: objective measurement 우선 (worse-of 무시).
//   사용자 #159 재확인 — Wave 203 박았는데 worse-of 가 metadata "사용감 적음" 우선해서 여전히 normal.
//   battery 95+ 객관적 신호 있으면 metadata override 차단.
// Wave 531 (2026-05-22) v55: exchange-only + explicit accessory/parts-only title blocks.
//   Recent operator comments: iPhone exchange posts, Dyson Airwrap accessory-only,
//   DJI Osmo Pocket Type-C base were polluting full-unit comparable samples.
export const PARSER_VERSION = "option-parser-v69";  // Wave 941: visible display damage guard

// Wave 760d (2026-05-24): game_console / sport_golf 만 ConditionClass → 5-tier (S/A/B/C/reject) 매핑.
//   의류/신발/가방: fashion parser 가 자체 parseConditionTier() 사용 (옷 사이즈/실착 횟수 등 정밀 추출).
//   전자기기/시계/모니터/스피커/카메라: 7-tier ConditionClass 그대로 (배터리/저장공간/세대/통신사 등 옵션 축 많아 5-tier 무의미).
//   게임/골프: 옵션 축 적음 (sub-model + condition + box) → 5-tier 직관적. 의류/신발 UX 통일.
//   토대: extractConditionClass() 결과를 단순 매핑 — parsing 핵심 로직 변경 없음 (post-process only).
//   PARSER_VERSION v57 bump → drift gate trigger → 게임/골프 매물만 reparse 큐 (다른 카테고리 영향 0, parser_version unchanged for them).
const GAME_GOLF_TIER_CATEGORIES = new Set<NonNullable<Sku["category"]>>([
  "game_console",
  "sport_golf",
]);
function conditionClassToFiveTier(
  conditionClass: ConditionClass,
): "s_grade" | "a_grade" | "b_grade" | "c_grade" | "reject" {
  if (conditionClass === "flawed") return "reject";
  if (conditionClass === "unopened") return "s_grade";
  if (conditionClass === "mint") return "s_grade"; // mint == unopened tier (둘 다 박스 미개봉 + 사용 0).
  if (conditionClass === "clean") return "a_grade"; // S급/풀세트/applecare premium.
  if (conditionClass === "worn") return "c_grade";
  if (conditionClass === "low_batt") return "c_grade"; // 배터리 저하 = 사용감 동급. game/golf 는 사실상 미사용.
  return "b_grade"; // normal → default 중간 (등급 미상 안전).
}

const APPLE_LAPTOP_MODEL_HINTS: Record<string, { screenSizeIn?: number; chip?: string; releaseYear?: number }> = {
  a1278: { screenSizeIn: 13, chip: "intel" },
  a1286: { screenSizeIn: 15, chip: "intel" },
  a1297: { screenSizeIn: 17, chip: "intel" },
  a1369: { screenSizeIn: 13, chip: "intel" },
  a1370: { screenSizeIn: 11, chip: "intel" },
  a1398: { screenSizeIn: 15, chip: "intel" },
  a1465: { screenSizeIn: 11, chip: "intel" },
  a1466: { screenSizeIn: 13, chip: "intel" },
  a1502: { screenSizeIn: 13, chip: "intel" },
  a1534: { screenSizeIn: 12, chip: "intel" },
  a1706: { screenSizeIn: 13, chip: "intel" },
  a1707: { screenSizeIn: 15, chip: "intel" },
  a1708: { screenSizeIn: 13, chip: "intel" },
  a1932: { screenSizeIn: 13, chip: "intel" },
  a1989: { screenSizeIn: 13, chip: "intel" },
  a1990: { screenSizeIn: 15, chip: "intel" },
  a2141: { screenSizeIn: 16, chip: "intel", releaseYear: 2019 },
  a2159: { screenSizeIn: 13, chip: "intel", releaseYear: 2019 },
  a2179: { screenSizeIn: 13, chip: "intel", releaseYear: 2020 },
  a2251: { screenSizeIn: 13, chip: "intel", releaseYear: 2020 },
  a2289: { screenSizeIn: 13, chip: "intel", releaseYear: 2020 },
  a2337: { screenSizeIn: 13, chip: "m1", releaseYear: 2020 },
  a2338: { screenSizeIn: 13, chip: "m1", releaseYear: 2020 },
  a2442: { screenSizeIn: 14, releaseYear: 2021 },
  a2485: { screenSizeIn: 16, releaseYear: 2021 },
  a2681: { screenSizeIn: 13, chip: "m2", releaseYear: 2022 },
  a2686: { screenSizeIn: 13, chip: "m2", releaseYear: 2022 },
  a2779: { screenSizeIn: 14, releaseYear: 2023 },
  a2780: { screenSizeIn: 16, releaseYear: 2023 },
  a2918: { screenSizeIn: 13, chip: "m3", releaseYear: 2024 },
  a2991: { screenSizeIn: 14, releaseYear: 2023 },
  a2992: { screenSizeIn: 16, releaseYear: 2023 },
  a3113: { screenSizeIn: 13, chip: "m3", releaseYear: 2024 },
};

const LG_GRAM_MODEL_HINTS: Record<string, { screenSizeIn?: number; releaseYear?: number }> = {
  "17z90s": { screenSizeIn: 17, releaseYear: 2024 },
  "17zd90s": { screenSizeIn: 17, releaseYear: 2024 },
  "17zd90su": { screenSizeIn: 17, releaseYear: 2024 },
};

const MONITOR_MODEL_HINTS: Record<string, {
  screenSizeIn?: number;
  monitorResolution?: string;
  monitorRefreshRate?: number;
  monitorPanelType?: string;
  monitorShape?: string;
}> = {
  "24gl600f": { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "tn" },
  "27gl650f": { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "ips" },
  "27gp850": { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 165, monitorPanelType: "ips" },
  "27gs85q": { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 180, monitorPanelType: "ips" },
  "27ml600sw": { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 75, monitorPanelType: "ips" },
  "27mp37vq": { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 60, monitorPanelType: "ips" },
  "27up850n": { screenSizeIn: 27, monitorResolution: "uhd_4k", monitorRefreshRate: 60, monitorPanelType: "ips" },
  "27us550": { screenSizeIn: 27, monitorResolution: "uhd_4k", monitorRefreshRate: 60, monitorPanelType: "ips" },
  "32m2n8800": { screenSizeIn: 32, monitorResolution: "uhd_4k", monitorRefreshRate: 240, monitorPanelType: "oled" },
  "34gs95qe": { screenSizeIn: 34, monitorResolution: "wqhd", monitorRefreshRate: 240, monitorPanelType: "oled" },
  "39gx900a": { screenSizeIn: 39, monitorResolution: "wqhd", monitorRefreshRate: 240, monitorPanelType: "oled", monitorShape: "curved_ultrawide" },
  "247fm100": { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 100 },
  aw2525hm: { screenSizeIn: 25, monitorResolution: "fhd", monitorRefreshRate: 320, monitorPanelType: "ips" },
  bg27fm3: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 240, monitorPanelType: "tn" },
  ls27f354fhk: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 60, monitorPanelType: "pls" },
  mb27f165: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 165 },
  odyssey_g4: { monitorResolution: "fhd", monitorRefreshRate: 240, monitorPanelType: "ips" },
  odyssey_g5: { monitorResolution: "qhd", monitorRefreshRate: 165 },
  pg248qp: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 540, monitorPanelType: "tn" },
  pg27aqdp: { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 480, monitorPanelType: "oled" },
  x24f165: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 165 },
  xg2401: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144 },
  xg27acdms: { screenSizeIn: 27, monitorResolution: "qhd", monitorRefreshRate: 280, monitorPanelType: "oled" },
  xl2411: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "tn" },
  xl2411k: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 144, monitorPanelType: "tn" },
  xl2540k: { screenSizeIn: 24.5, monitorResolution: "fhd", monitorRefreshRate: 240, monitorPanelType: "tn" },
  xl2540x: { screenSizeIn: 24, monitorResolution: "fhd", monitorRefreshRate: 280, monitorPanelType: "tn" },
  xl2720: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 144 },
  xl2720z: { screenSizeIn: 27, monitorResolution: "fhd", monitorRefreshRate: 144 },
};

const MONITOR_CM_SIZE_HINTS: Record<number, number> = {
  48: 19,
  51: 20,
  54: 21.5,
  56: 22,
  58: 24,
  59: 24,
  61: 24,
  68: 27,
  69: 27,
  71: 28,
  80: 32,
  81: 32,
  86: 34,
  95: 38,
  99: 39,
  124: 49,
};

function parseAppleLaptopModelNumber(text: string) {
  const match = normalize(text).match(/\ba\s*(\d{4})\b/i);
  return match?.[1] ? `a${match[1]}` : null;
}

function parseLgGramModelNumber(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/\b(17zd90su|17zd90s|17z90s)(?!p)[a-z0-9-]*\b/);
  return match?.[1] ?? null;
}

// v33+: Apple silicon chip + (model, screen) tuple → unique release year mapping.
// §12b 준수: chip 단독 추정 X. (model, chip, screen)이 unique한 조합만 매핑.
// 예: "M1 맥북에어" → 2020 (M1 Air는 2020만), "M2 맥북에어 13" → 2022 (M2 Air 13는 2022만).
// "M3 맥북프로" 같은 다년식 chip은 leave unknown.
function appleChipToReleaseYear(
  family: string | null,
  model: string | null,
  chip: string | null,
  screenSizeIn: number | null,
): number | null {
  if (!chip || family !== "macbook") return null;
  const c = chip.toLowerCase();
  if (model === "macbook_air") {
    // Air는 chip 출시 연도와 1대1 매핑 (Air는 항상 1세대 chip만 받음)
    if (c === "m1") return 2020; // M1 Air 2020만
    if (c === "m2") {
      if (screenSizeIn === 13) return 2022;
      if (screenSizeIn === 15) return 2023;
      // size 미상이면 leave unknown
    }
    if (c === "m3") return 2024; // M3 Air 13/15 모두 2024
    if (c === "m4") return 2025; // M4 Air 2025
    if (c === "m5") return 2026; // M5 Air 2026 (가정 — Apple 발표 기준)
  }
  if (model === "macbook_pro") {
    // Pro는 13" base chip vs 14"/16" Pro/Max chip로 분리
    if (c === "m1") {
      if (screenSizeIn === 13) return 2020; // M1 MBP 13는 2020만
      // 14"/16"는 M1 Pro/Max만 (chip 명시 다름)
    }
    if (c === "m1_pro" || c === "m1_max") return 2021; // 14"/16" 2021
    if (c === "m2") {
      if (screenSizeIn === 13) return 2022; // M2 MBP 13는 2022만
    }
    if (c === "m2_pro" || c === "m2_max") return 2023; // 14"/16" 2023
    // M3/M4 Pro/Max는 다년식 가능 (2023~2024) → leave unknown
    if (c === "m5" || c === "m5_pro" || c === "m5_max") return 2025; // M5 Pro/Max 2025
  }
  return null;
}

function parseLaptopReleaseYear(text: string) {
  const lower = normalize(text).toLowerCase();
  const fullYear = firstMatch(lower, [
    /\b(20(?:0[8-9]|1[0-9]|2[0-6]))\s*(?:년형|년식|형|model)(?:[^0-9a-z가-힣]|$)/,
    /\b(?:early|mid|late)\s*(20(?:0[8-9]|1[0-9]|2[0-6]))\b/,
    /\b(20(?:0[8-9]|1[0-9]|2[0-6]))\s*(?:맥북|macbook|에어|프로|air|pro)\b/,
    // v32: reverse order — "맥북프로 2019", "맥북에어 m1 2020", "맥북프로2017", "맥북 프로 16인치 2019"
    // \b가 한글 boundary로 안 먹어서 explicit char class 사용. 사이 token은 chip/inch 등 최대 15자.
    // "2025년 2월 구매" 같은 purchase year context는 brand에서 멀어서 자동 회피.
    // Wave 106 #51: char class 에 한글 (가-힣) 추가 — "맥북에어 2020", "맥북 프로 m2 2020" 같이
    // 사이 토큰에 한글 (에어/프로/실버 등) 들어간 매물 매칭. 옛 char class 한글 누락이 root cause —
    // production 매물 50건 sample 확인 결과 다수 release_year=null 이라 unknown_chip/generation 박힘.
    /(?:맥북|macbook|에어|프로|air|pro|gram|그램)[a-z0-9가-힣\s./()\-]{0,15}?(20(?:0[8-9]|1[0-9]|2[0-6]))(?:[^0-9]|$)/,
  ]);
  if (fullYear?.[1]) return Number(fullYear[1]);

  // v32+: Intel "N세대" → release year mapping (laptop context only).
  // Gen 13 = 2023 (Raptor Lake), Gen 12 = 2022, Gen 11 = 2021, ... — Intel official launch years.
  // Note: 이 함수는 laptop category에서만 호출되므로 iPad "5세대" 같은 다른 카테고리 충돌 없음.
  const intelGen = lower.match(/(\d{1,2})\s*세대/);
  if (intelGen?.[1]) {
    const gen = Number(intelGen[1]);
    const intelGenToYear: Record<number, number> = {
      8: 2018, 9: 2019, 10: 2020, 11: 2021, 12: 2022, 13: 2023, 14: 2024,
    };
    if (intelGenToYear[gen]) return intelGenToYear[gen];
  }

  const shortYear = firstMatch(lower, [
    /(?:^|[^0-9])([0-2][0-9])\s*(?:년형|년식)(?:[^0-9]|$)/,
    /\b(?:early|mid|late)\s*([0-2][0-9])\b/,
    // v32: "19년" / "20년" — short year + 년 suffix
    /(?:^|[^0-9])([0-2][0-9])\s*년(?:[^0-9형식]|$)/,
  ]);
  if (!shortYear?.[1]) return null;
  const twoDigit = Number(shortYear[1]);
  if (twoDigit >= 8 && twoDigit <= 26) return 2000 + twoDigit;
  return null;
}

function laptopGenerationKey(
  releaseYear: number | null,
  modelNumber: string | null,
  chip: string | null = null,
) {
  if (releaseYear) return `${releaseYear}y`;
  if (modelNumber) return modelNumber;
  // Wave 182 Phase 4 (2026-05-17): Intel Core/Ultra chip (Arrow Lake 등) generation 매핑 추가.
  // m1~m9 (Apple Silicon) + core5/7/9 (Intel Arrow Lake) + ultra5/7/9 (Intel Core Ultra).
  if (chip && /^(m[1-9]|core[3579]|ultra[3579])(?:_[a-z]+|[a-z]*)?$/i.test(chip)) {
    return `${chip.toLowerCase().replaceAll("_", "")}_gen`;
  }
  return null;
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function normalize(text: string) {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/usb[\s_-]*c/g, " usbc ")
    .replace(/c[\s_-]*type/g, " usbc ")
    .replace(/c\s*타입|타입\s*c|씨\s*타입|타입\s*씨/g, " usbc ")
    .replace(/[^0-9a-z가-힣./\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string | null | undefined) {
  return normalize(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function cap01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

function parseGb(raw: string | undefined) {
  if (!raw) return null;
  const lower = raw.toLowerCase().replace(/,/g, "");
  const compact = lower.replace(/\s+/g, "");
  const num = Number(compact.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(num)) return null;
  if (/tb|테라|^[124]t$/.test(compact)) return Math.round(num * 1024);
  return Math.round(num);
}

function parseStorageGb(text: string, category: Sku["category"] | null) {
  const lower = normalize(text).toLowerCase();
  const storage = firstMatch(lower, [
    /(?:용량|스토리지|저장공간)\s*[:：]?\s*(32|64|128|256|512|[12]\s*(?:t|tb|테라))\s*(?:gb|g|기가|테라|tb)?/,
    /\b(32|64|128|256|512)\s*(?:gb|g|기가)\b/,
    /(?:^|[^0-9])([12]\s*(?:t|tb|테라))(?:[^0-9]|$)/,
  ]);
  if (storage) return parseGb(storage[1]);

  if (category === "smartphone" || category === "tablet") {
    const bare = lower.match(/(?:^|[^0-9])(32|64|128|256|512)(?:[^0-9]|$)/);
    const rawBare = text.toLowerCase().match(/(?:^|[^0-9])(32|64|128|256|512)\s*(?:gb|g|기가)?(?:[^0-9]|$)/);
    return parseGb(bare?.[1] ?? rawBare?.[1]);
  }
  return null;
}

function parseLooseDeviceStorageGb(text: string, category: Sku["category"] | null) {
  if (category !== "smartphone" && category !== "tablet") return null;
  const lower = normalize(text).toLowerCase();
  const modelAdjacent = lower.match(/(?:아이폰|iphone|갤럭시|galaxy|s[0-9]{2}|z플립|z폴드|ipad|아이패드|갤럭시탭|갤탭|tab|프로|울트라|플러스).{0,48}?(32|64|128|256|512)\s*(?:gb|g|기가)?(?:[^0-9]|$)/);
  return parseGb(modelAdjacent?.[1]);
}

function parseRamAndSsd(text: string, category: Sku["category"] | null) {
  const lower = normalize(text).toLowerCase();
  // Wave 109b (2026-05-15): 18 추가 — MacBook Pro M3/M4 Pro의 base RAM. 매물 명시 다수.
  const ramPattern = "4|6|8|12|16|18|24|32|36|48|64|96|128";
  const pair = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*\\/\\s*(128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)(?:[^0-9]|$)`));
  const pairWithUnits = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)?\\s*\\/\\s*(128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)\\s*(?:gb|g|기가|t|tb|테라)?(?:[^0-9]|$)`));
  const looseLaptopPair = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s+(128|256|500|512)(?:[^0-9]|$)`))
    : null;
  const adjacentLaptopPair = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)\\s+(121|128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)\\s*(?:gb|g|기가|t|tb|테라|ssd)?(?:[^0-9]|$)`))
    : null;
  const reversedPair = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(128|250|256|500|512|1\\s*t|1\\s*tb|2\\s*t|2\\s*tb|4\\s*t|4\\s*tb|1테라|2테라|4테라)\\s*(?:gb|g|기가|t|tb|테라)?\\s+(${ramPattern})\\s*(?:gb|g|기가)?(?:[^0-9]|$)`))
    : null;
  const ramExplicit = lower.match(new RegExp(`(?:램|ram|memory|메모리|통합\\s*메모리)\\s*[:：]?\\s*(${ramPattern})\\s*(?:gb|g|기가)?`));
  const ramSuffix = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:(?:gb|g|기가)\\s*)?(?:램|ram|memory|메모리|통합\\s*메모리)(?:[^0-9a-z가-힣]|$)`));
  const ramBeforeMemory = lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)(?=.{0,16}(?:통합\\s*메모리|메모리|램|ram))`));
  const ramBeforeSsd = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)(?=.{0,20}(?:ssd|저장공간|스토리지))`))
    : null;
  const singleLaptopRam = category === "laptop"
    ? lower.match(new RegExp(`(?:^|[^0-9])(${ramPattern})\\s*(?:gb|g|기가)(?:[^0-9a-z가-힣]|$)`))
    : null;
  const ssdExplicit = lower.match(/(?:ssd|hdd|하드|용량|저장\s*공간|저장공간|저장\s*장치|스토리지)\s*[:：]?\s*(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)?/);
  const ssdSuffix = lower.match(/\b(121|128|250|256|500|512|1\s*t|1\s*tb|2\s*t|2\s*tb|4\s*t|4\s*tb|1테라|2테라|4테라)\s*(?:gb|g|기가|t|tb|테라)\s*(?:ssd|용량|저장\s*공간|저장공간|저장\s*장치|스토리지)?\b/);
  const ramGb = parseGb(ramExplicit?.[1] ?? ramSuffix?.[1] ?? ramBeforeMemory?.[1] ?? ramBeforeSsd?.[1] ?? pairWithUnits?.[1] ?? pair?.[1] ?? adjacentLaptopPair?.[1] ?? looseLaptopPair?.[1] ?? reversedPair?.[2] ?? singleLaptopRam?.[1]);
  const bareLaptopSsd = category === "laptop"
    ? lower.match(/(?:^|[^0-9])(121|128|250|256|500|512)(?:[^0-9]|$)/)
    : null;
  const compactSsd = category === "laptop"
    ? lower.match(/\b(121|128|250|256|500|512)\s*ssd\b/)
    : null;
  const teraSsd = category === "laptop"
    ? lower.match(/(?:^|[^0-9])([124])\s*(?:t|tb|테라)(?:[^0-9]|$)/)
    : null;
  const ssdGb = parseGb(ssdExplicit?.[1] ?? pairWithUnits?.[2] ?? pair?.[2] ?? adjacentLaptopPair?.[2] ?? looseLaptopPair?.[2] ?? reversedPair?.[1] ?? ssdSuffix?.[1] ?? compactSsd?.[1] ?? (teraSsd?.[1] ? `${teraSsd[1]}tb` : undefined) ?? bareLaptopSsd?.[1]);
  return { ramGb, ssdGb };
}

function parseScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/(?:^|[^0-9])(7\.9|8\.3|9\.7|10\.2|10\.5|10\.9|11|12\.4|12\.9|13|13\.1|13\.3|14|14\.6|15|15\.6|16|17)\s*(?:인치|inch|"|형)/);
  return match ? Number(match[1]) : null;
}

function parseMonitorBrand(text: string) {
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const brandPatterns: Array<[string, RegExp]> = [
    ["lg", /\blg\b|엘지|울트라기어|ultragear/],
    ["samsung", /삼성|samsung|오디세이|odyssey/],
    ["benq", /벤큐|benq|zowie|조위/],
    ["dell", /\bdell\b|델\s*(?:모니터|monitor)|alienware|에일리언웨어/],
    ["asus", /asus|에이수스|아수스|rog|tuf/],
    ["msi", /\bmsi\b|엠에스아이/],
    ["gigabyte", /gigabyte|기가바이트|aorus/],
    ["viewsonic", /viewsonic|뷰소닉/],
    ["hansung", /한성|hansung/],
    ["jooyontech", /주연|jooyon/],
  ];
  for (const [brand, pattern] of brandPatterns) {
    if (pattern.test(lower) || pattern.test(compact)) return brand;
  }
  return null;
}

function parseMonitorModelCode(text: string) {
  const lower = normalize(text).toLowerCase();
  const odyssey = lower.match(/(?:오디세이|odyssey)\s*(g[3-9])\b/i);
  if (odyssey?.[1]) return `odyssey_${slug(odyssey[1])}`;
  const legion = lower.match(/\blegion\s+(\d{2}q)\s+(\d{2})\b/);
  if (legion?.[1] && legion[2]) return `${legion[1]}_${legion[2]}`;
  const matches = lower.match(/\b(?:[a-z]{1,6}\d{2,5}[a-z0-9]{0,8}|\d{2,3}[a-z]{1,5}[-_]?\d{1,5}[a-z0-9]{0,8}|\d{2,3}[a-z]{2,5})\b/g) ?? [];
  const ignored = new Set(["1080p", "1440p", "2160p"]);
  for (const raw of matches) {
    const value = slug(raw);
    if (!value || ignored.has(value)) continue;
    if (/^\d+(?:hz|gb|tb|mm|cm|in)$/.test(value)) continue;
    if (/^(fhd|qhd|uhd|oled|ips|va|tn)$/.test(value)) continue;
    return value;
  }
  return null;
}

function parseMonitorScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/(?:^|[^0-9])(13\.3|15\.6|16|17|19|20|21|22|23|24|24\.5|25|27|28|29|30|32|34|38|40|43|45|49|55)\s*(?:인치|inch|"|형)(?:[^0-9]|$)/);
  if (match) return Number(match[1]);
  const cmMatch = lower.match(/(?:^|[^0-9])(48|51|54|56|58|59|61|68|69|71|80|81|86|95|124)\s*(?:cm|센치|센티)(?:[^0-9]|$)/);
  const cm = cmMatch?.[1] ? Number(cmMatch[1]) : null;
  return cm ? (MONITOR_CM_SIZE_HINTS[cm] ?? null) : null;
}

function parseMonitorScreenSizeFromModelCode(modelCode: string | null) {
  if (!modelCode) return null;
  const compact = modelCode.replace(/_/g, "");
  const match = compact.match(/^(?:[a-z]{0,3})(13|15|16|17|19|20|21|22|23|24|25|27|28|29|30|32|34|38|40|43|45|49|55)(?=[a-z0-9])/);
  if (!match?.[1]) return null;
  const size = Number(match[1]);
  return Number.isFinite(size) ? size : null;
}

function parseMonitorResolution(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/3840\s*[x/]\s*2160|\b2160p\b|\buhd\b|\b4k\b/.test(lower)) return "uhd_4k";
  if (/3440\s*[x/]\s*1440|\b(?:u?wqhd|uwqhd)\b/.test(lower)) return "wqhd";
  if (/2560\s*[x/]\s*1440|\b1440p\b|\bqhd\b|\b2k\b/.test(lower)) return "qhd";
  if (/1920\s*[x/]\s*1080|\b1080p\b|\bfhd\b|\bwfhd\b|풀\s*hd/.test(lower)) return "fhd";
  return null;
}

function parseMonitorRefreshRate(text: string) {
  const lower = normalize(text).toLowerCase();
  const refreshPattern = "60|75|100|120|144|160|165|170|180|200|240|280|300|320|360|480|500|540";
  const explicit = lower.match(new RegExp(`(?:^|[^0-9])(${refreshPattern})\\s*(?:hz|헤르츠)(?:[^0-9]|$)`));
  if (explicit?.[1]) return Number(explicit[1]);

  const bareAfterContext = lower.match(new RegExp(`(?:주사율|고주사율|게이밍|게임용|리얼|모니터|fhd|qhd|wqhd|uwqhd|uhd|4k).{0,18}?(?:^|[^0-9])(${refreshPattern})(?:[^0-9]|$)`));
  if (bareAfterContext?.[1]) return Number(bareAfterContext[1]);

  const bareBeforeContext = lower.match(new RegExp(`(?:^|[^0-9])(${refreshPattern})(?:[^0-9]|$).{0,18}?(?:주사율|고주사율|게이밍|게임용|리얼|모니터|fhd|qhd|wqhd|uwqhd|uhd|4k)`));
  return bareBeforeContext?.[1] ? Number(bareBeforeContext[1]) : null;
}

function parseMonitorPanelType(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/\boled\b|올레드/.test(lower)) return "oled";
  if (/[a-z0-9]ips\b/.test(lower)) return "ips";
  if (/\bips\b/.test(lower)) return "ips";
  if (/(?:^|[^a-z])va(?:[^a-z]|$)/.test(lower)) return "va";
  if (/(?:^|[^a-z])tn(?:[^a-z]|$)/.test(lower)) return "tn";
  return null;
}

function parseMonitorShape(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/울트라\s*와이드|ultra\s*wide|ultrawide|21\s*[:/]\s*9/.test(lower)) return "ultrawide";
  if (/커브드|curved|곡면/.test(lower)) return "curved";
  if (/평면|flat/.test(lower)) return "flat";
  return null;
}

// Wave 202 (2026-05-18) FIX: 액세서리의 generation 표기 ("애플펜슬 2세대" 등) 가
// tablet generation 으로 잘못 매칭되는 버그 fix. 사용자 보고:
// "아이패드 에어 4 + 애플펜슬 2세대" → 2_gen|a8x 잘못 박힘 (실제 Air 4 = a14).
function stripAccessoryGenerationMarker(text: string): string {
  return text.replace(
    /(?:애플\s*펜슬|애플펜슬|팬슬|애펜|apple\s*pencil|pencil|매직\s*키보드|매직키보드|magic\s*keyboard|폴리오|smart\s*folio)\s*\d+\s*세대?/gi,
    "",
  );
}

function parseTabletGeneration(text: string, model: string | null) {
  if (!model) return null;
  const lower = normalize(text).toLowerCase();
  // Wave 202: 액세서리 generation 제거 후 매칭 (예: "애플펜슬 2세대" 같은 노이즈 차단).
  const cleaned = stripAccessoryGenerationMarker(lower);

  // Wave 202: model 분기 우선 (정확한 모델 매칭이 "X세대" marker 보다 우선).
  // 이전: "X세대" 우선 → "애플펜슬 2세대" 매칭 → 잘못된 generation 박힘.
  if (model === "ipad_pro") {
    // Wave 90: chip prefix (m4, m2, m1, a14, a17 등) 다음 숫자가 generation으로 잘못
    // 캡처되는 버그 fix. 사용자 코멘트로 발견 (pid 402181838 "프로 m4 13인치" → 4).
    // negative lookahead로 직전이 m/M/a/A/c/C/i/I (chip prefix) 면 캡처 안 함.
    const match = firstMatch(cleaned, [
      /(?:아이패드\s*)?(?:프로|pro)\s+(?:[^0-9.]{0,12}?)?(?<![maciMACI])(\d)(?:[^0-9.]|$)/,
      /(?:^|[^0-9.])(?<![maciMACI])(\d)(?:[^0-9.]{0,12})?(?:프로|pro)/,
    ]);
    if (match) return Number(match[1]);
  }
  if (model === "ipad_mini") {
    if (/\ba\s*17\b|a17\s*pro|a17pro/.test(cleaned)) return 7;
    // Wave 91: \s+ → \s* (공백 없이 "미니6" 같은 매물도 캡처). 사용자 코멘트로 발견 (pid 367574084 "아이패드 미니6 256 셀룰러").
    const match = firstMatch(cleaned, [
      /(?:아이패드\s*)?(?:미니|mini)\s*(?:[^0-9.]{0,12}?)?(\d)(?:[^0-9.]|$)/,
      /(?:^|[^0-9.])(\d)(?:[^0-9.]{0,12})?(?:미니|mini)/,
    ]);
    if (match) return Number(match[1]);
  }
  if (model === "ipad_air") {
    const match = firstMatch(cleaned, [
      /(?:아이패드\s*)?(?:에어|air)\s*(\d)(?:[^0-9.]|$)/,
      /(?:^|[^0-9.])(\d)\s*(?:에어|air)/,
    ]);
    if (match) return Number(match[1]);
  }

  // Fallback: model 분기에서 못 잡은 경우만 "X세대" marker 사용.
  // 액세서리 제거된 cleaned 텍스트에서 검색 (안전).
  const genWithMarker = cleaned.match(/(\d)\s*세대/);
  if (genWithMarker?.[1]) return Number(genWithMarker[1]);

  return null;
}

function parseTabletGenerationChip(text: string, model: string | null, screenSizeIn: number | null) {
  const generation = parseTabletGeneration(text, model);
  if (!generation) return null;

  // Wave 90 (2026-05-15): iPad Pro 12.9 1st~4th + 11 1st~2nd 추가 매핑.
  // 기존엔 5세대(M1)부터만 chip 매핑되고 1~4세대는 chip null → comparable_key에 chip
  // 안 들어가서 모든 세대가 한 그룹으로 묶이는 시세 왜곡. 사용자 코멘트로 발견.
  if (model === "ipad_pro") {
    if (screenSizeIn === 11) {
      if (generation === 1) return "a12x"; // 11" 1st (2018)
      if (generation === 2) return "a12z"; // 11" 2nd (2020)
      if (generation === 3) return "m1";   // 11" 3rd (2021)
      if (generation === 4) return "m2";   // 11" 4th (2022)
      if (generation === 5) return "m4";   // 11" 5th (2024)
    }
    if (screenSizeIn === 12.9 || screenSizeIn === 13) {
      if (generation === 1) return "a9x";  // 12.9" 1st (2015)
      if (generation === 2) return "a10x"; // 12.9" 2nd (2017)
      if (generation === 3) return "a12x"; // 12.9" 3rd (2018)
      if (generation === 4) return "a12z"; // 12.9" 4th (2020)
      if (generation === 5) return "m1";   // 12.9" 5th (2021)
      if (generation === 6) return "m2";   // 12.9" 6th (2022)
      if (generation === 7) return "m4";   // 13" 7th (2024) — Apple은 12.9→13으로 명칭 변경
    }
    // Wave 106 #53: 옛 iPad Pro 10.5"/9.7" (단종) chip 매핑 추가.
    if (screenSizeIn === 10.5) return "a10x"; // iPad Pro 10.5" (2017, 1st & only)
    if (screenSizeIn === 9.7) return "a9x";   // iPad Pro 9.7" (2016, 1st & only)
  }

  if (model === "ipad_air") {
    // Wave 106 #53: iPad Air 1/2/3 옛 모델 chip 매핑 추가.
    if (generation === 1) return "a7";   // Air 1 (2013)
    if (generation === 2) return "a8x";  // Air 2 (2014)
    if (generation === 3) return "a12";  // Air 3 (2019)
    if (generation === 4) return "a14";  // Air 4 (2020)
    if (generation === 5) return "m1";   // Air 5 (2022)
    if (generation === 6) return "m2";   // Air 6 (2024)
    if (generation === 7) return "m3";   // Air 7 (2025)
  }

  if (model === "ipad_mini") {
    // Wave 106 #53: iPad Mini chip 매핑 0개 → 전체 추가.
    if (generation === 1) return "a5";       // Mini 1 (2012)
    if (generation === 2) return "a7";       // Mini 2 (2013)
    if (generation === 3) return "a7";       // Mini 3 (2014)
    if (generation === 4) return "a8";       // Mini 4 (2015)
    if (generation === 5) return "a12";      // Mini 5 (2019)
    if (generation === 6) return "a15";      // Mini 6 (2021)
    if (generation === 7) return "a17_pro";  // Mini 7 (2024)
  }

  return null;
}

function tabletChipAxis(model: string | null, chip: string | null) {
  // Wave 106 #53: ipad_mini 추가 (옛 모델 chip 매핑 추가됨).
  // Wave 182 (2026-05-17): narrow id (ipad_mini_6_64_wifi 등)는 model이 narrow → broader case 안 들어감 → chip axis null.
  // narrow id 자체가 unique 식별자라 chip axis 안 박혀도 OK (기존 ipad-mini-7-128-wifi 패턴 동일).
  if (model === "ipad_pro" || model === "ipad_air" || model === "ipad_mini") return chip ?? "unknown_chip";
  return null;
}

function hasTabletBundlePriceReview(text: string) {
  const lower = normalize(text).toLowerCase();
  return /(애플\s*펜슬|애플펜슬|애펜|apple\s*pencil|pencil|매직\s*키보드|magic\s*keyboard|키보드\s*포함|펜슬\s*포함|\+\s*(?:펜슬|키보드|케이스)|(?:펜슬|키보드|케이스).{0,16}(?:포함|같이|증정|드림|드립니다))/.test(lower);
}

function parseBareTabletScreenSizeIn(text: string, model: string | null) {
  const lower = normalize(text).toLowerCase();
  const screenPattern = "(7\\.9|8\\.3|9\\.7|10\\.2|10\\.5|10\\.9|11|12\\.4|12\\.9|13|13\\.1|14\\.6)";
  const ipadModelBefore = new RegExp(`(?:아이패드\\s*(?:프로|에어|미니)|아이패드(?:프로|에어|미니)|ipad\\s*(?:pro|air|mini)|프로|에어|미니|pro|air|mini).{0,40}?${screenPattern}(?:[^0-9]|$)`);
  const ipadModelAfter = new RegExp(`(?:^|[^0-9])${screenPattern}.{0,40}?(?:아이패드\\s*(?:프로|에어|미니)|아이패드(?:프로|에어|미니)|ipad\\s*(?:pro|air|mini)|프로|에어|미니|pro|air|mini)`);
  const galaxyTabBefore = new RegExp(`(?:갤럭시\\s*탭|갤럭시탭|갤탭|galaxy\\s*tab|tab).{0,32}?${screenPattern}(?:[^0-9]|$)`);
  const galaxyTabAfter = new RegExp(`(?:^|[^0-9])${screenPattern}.{0,32}?(?:갤럭시\\s*탭|갤럭시탭|갤탭|galaxy\\s*tab|tab)`);

  const match = lower.match(ipadModelBefore)
    ?? lower.match(ipadModelAfter)
    ?? lower.match(galaxyTabBefore)
    ?? lower.match(galaxyTabAfter);
  if (match?.[1]) return Number(match[1]);

  if (model === "ipad_pro" || model === "ipad_air") {
    const compact = lower.match(/(?:아이패드(?:프로|에어)|ipad(?:pro|air)|프로|에어)(11|13)(?:[^0-9]|$)/);
    if (compact?.[1]) return Number(compact[1]);
  }
  return null;
}

// Wave 182 (2026-05-17): narrow tablet SKU id → broader model (ipad_pro/ipad_air/ipad_mini).
// parseTabletScreenSizeIn / tabletChipAxis 에서 chip/screen 추론 시 broader case 활용.
// model 자체는 narrow 유지 (comparable_key 정확성 — 기존 test 호환).
function broaderTabletModel(model: string | null): string | null {
  if (!model) return null;
  if (model.startsWith("ipad_mini")) return "ipad_mini";
  if (model.startsWith("ipad_air")) return "ipad_air";
  if (model.startsWith("ipad_pro")) return "ipad_pro";
  return model;
}

function parseTabletScreenSizeIn(text: string, model: string | null) {
  const explicit = parseScreenSizeIn(text);
  if (explicit) return explicit;
  const broader = broaderTabletModel(model);
  const bare = parseBareTabletScreenSizeIn(text, broader);
  if (bare) return bare;

  const generation = parseTabletGeneration(text, broader);
  if (broader === "ipad_mini") {
    if (generation && generation <= 5) return 7.9;
    if (generation && generation >= 6) return 8.3;
  }
  if (broader === "ipad_air") {
    if (generation === 1 || generation === 2) return 9.7;
    if (generation === 3) return 10.5;
    if (generation === 4 || generation === 5) return 10.9;
  }
  return defaultTabletScreenSizeIn(model);
}

function parseLaptopScreenSizeIn(text: string) {
  const lower = normalize(text).toLowerCase();
  const explicit = parseScreenSizeIn(text);
  if (explicit) return explicit;
  const macbookBare = lower.match(/(?:맥북\s*에어|맥북에어|macbook\s*air|맥북\s*프로|맥북프로|macbook\s*pro).{0,24}?\b(13|14|15|16)\b/);
  if (macbookBare) return Number(macbookBare[1]);
  return null;
}

function parseWatchSizeMm(text: string) {
  const lower = normalize(text).toLowerCase();
  // 1. 정확한 "Xmm" 표기 (최우선)
  const withMm = lower.match(/\b(40|41|42|43|44|45|46|47|49)\s*m{1,2}\b/);
  if (withMm) return Number(withMm[1]);
  // Wave 109b (2026-05-15): 워치 모델명 12자 이내 size 숫자 단독 — "애플워치9 45" / "갤럭시워치 7 40" 같은 매물.
  // false positive risk: 모델명 컨텍스트 안에서만 잡음. battery/cycle 등 noise는 모델명 직후 안 옴.
  // Wave 106 #51b: char class 에 한글 (가-힣) 추가 — "애플워치 ultra 알루미늄 49mm" 같이 한글 토큰 (알루미늄/스테인리스/스타라이트) 사이에 있는 매물 매칭.
  const watchContext = lower.match(/(?:애플\s?워치|applewatch|갤럭시\s?워치|galaxywatch)[a-z0-9가-힣\s]{0,12}?\b(40|41|42|43|44|45|46|47|49)\b/);
  if (watchContext) return Number(watchContext[1]);
  return null;
}

function parseChip(text: string) {
  const lower = normalize(text).toLowerCase();
  const coreUltra = firstMatch(lower, [
    /코어\s*울트라\s*([579])/,
    /core\s*ultra\s*([579])/,
    /\bultra\s*([579])\b/,
  ]);
  if (coreUltra?.[1]) return `ultra${coreUltra[1]}`;
  // Wave 182 Phase 4 (2026-05-17): Intel Core 5/7/9 (Arrow Lake, 2024+) — Galaxy Book 4/5 등.
  // Wave 188 (2026-05-18): "코어 3", "코어3" 도 추가 (Intel Core 3 low-end). i3/i5/i7/i9 와 구분.
  const intelCore = firstMatch(lower, [
    /(?:인텔\s*)?core\s*([3579])(?!\d|\s*ultra)/i,
    /(?:인텔\s*)?코어\s*([3579])(?!\d|\s*울트라)/,
  ]);
  if (intelCore?.[1]) return `core${intelCore[1]}`;
  // 2026-05-15 Wave 124: \b → lookbehind/lookahead. \b는 "맥북프로14m5"의 "4m" 사이에서 안 잡힘 (둘 다 word char).
  // lookbehind (?<![a-z]): 앞에 영문 없으면 OK (숫자/한글/공백/start). lookahead (?![a-z0-9]): 뒤에 영문/숫자 없음.
  // "맥북프로14m5 미개봉" → m5 매칭. "맥북에어m4" → m4 매칭. "m5pro" → m5 + pro 매칭. "m12" → fail (숫자 lookahead).
  const match = firstMatch(lower, [
    /(?<![a-z])(m[1-5])\s*(ultra|max|pro|max)?(?![a-z0-9])/i,
    /(?<![a-z])(i[3579])\s*(?:-| )?(\d{4,5}[a-z]*)?(?![a-z0-9])/i,
  ]);
  if (!match) return null;
  return slug([match[1], match[2]].filter(Boolean).join(" "));
}

function parseLgGramChipFromModelNumber(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = lower.match(/\b17z(?:d)?90s(?:u)?\s+g[a-z]?([57])/);
  return match?.[1] ? `ultra${match[1]}` : null;
}

function parseBatteryHealth(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = firstMatch(lower, [
    /(?:배터리\s*)?(?:효율|성능)\s*[:：]?\s*(100|9[0-9]|8[0-9]|7[0-9])\s*%?/,
    /(?:배효)\s*[:：]?\s*(100|9[0-9]|8[0-9]|7[0-9])\s*%?/,
    /신품\s*대비\s*(100|9[0-9]|8[0-9]|7[0-9])\s*%?/,
  ]);
  return match ? Number(match[1]) : null;
}

function parseBatteryCycles(text: string) {
  const lower = normalize(text).toLowerCase();
  const match = firstMatch(lower, [
    /(?:사이클|cycle|충전\s*횟수)\s*[:：]?\s*(\d{1,4})\s*(?:회)?/,
  ]);
  return match ? Number(match[1]) : null;
}

function parseConnectivity(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/셀룰러|cellular|lte|5g/.test(lower)) return "cellular";
  if (/와이\s*파이|wifi|wi\s*fi|wi-fi/.test(lower)) return "wifi";
  if (/gps|블루투스|bluetooth|bt/.test(lower)) return "gps";
  return null;
}

function parseCarrier(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/자급제/.test(lower)) return "unlocked";
  if (/\bskt\b|sk텔레콤/.test(lower)) return "skt";
  if (/\bkt\b/.test(lower)) return "kt";
  if (/유플|u\+|lg u/.test(lower)) return "lgu";
  return null;
}

// Wave 885 (2026-05-26): catalog modelName 의 부속 설명 (paren / em-dash / slash 모델 나열) 떼어내기.
//   기존 fallback `return name || id` 는 "Seiko (broad — narrow 미박힘 catch-all)" 같은 modelName 을
//   `seiko_broad_narrow_미박힘_catch_all` 로 슬러그화해 comparable_key 에 그대로 박았음 → 사용자 노출 + sample 폭주.
//   본 함수는 paren/em-dash/slash-나열 토큰을 떼어내 깨끗한 model 토큰만 남긴다.
function cleanCatalogName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/\([^)]*\)/g, " ")                  // (foo) — 부속 설명 제거
    .replace(/—.*$/, " ")                          // em-dash 뒤 전체 제거
    .replace(/–.*$/, " ")                          // en-dash 뒤 전체 제거
    .replace(/\/\s*[A-Za-z0-9가-힣\-+_.]+/g, " ") // "/V10" 같은 slash-모델 나열 제거
    .replace(/\s+/g, " ")
    .trim();
}

function modelFromSku(skuId?: string | null, skuName?: string | null) {
  const id = slug(skuId);
  const name = slug(cleanCatalogName(skuName));
  if (id.startsWith("iphone_")) return id.replace(/^iphone_/, "iphone_");
  if (id.startsWith("galaxy_s")) return id;
  if (id.startsWith("ipad_")) return id;
  if (id.startsWith("galaxy_tab")) return id;
  if (id.startsWith("macbook_air")) return "macbook_air";
  if (id.startsWith("macbook_pro")) return "macbook_pro";
  if (id === "lg_gram_17_2024") return "lg_gram_17_2024";
  if (id.startsWith("applewatch")) return id;
  if (id.startsWith("galaxywatch")) return id;
  if (id.startsWith("airpods")) return id;
  if (id === "camera_canon_eos_r6_mark_ii") return "eos_r6_mark_ii";
  if (id === "camera_sony_a7m3") return "a7_iii";
  if (id === "camera_sony_a7c") return "a7c";
  if (id === "camera_sony_a5100") return "a5100";
  if (id === "camera_canon_eos_m6") return "eos_m6";
  if (id === "camera_nikon_z9") return "z9";
  if (id === "camera_canon_eos_6d") return "eos_6d";
  if (id === "camera_fujifilm_x_t4") return "x_t4";
  // Wave 67/74: 신 사업 카테고리 mapping. 짧고 정밀한 model name으로 confidence 안정화.
  if (id === "camera_sony_a6400") return "a6400";
  if (id === "watch_casio_gshock_dw5600") return "gshock_dw5600";
  if (id === "watch_casio_gshock_ga2100") return "gshock_ga2100";
  if (id === "watch_casio_gshock_gmwb5000") return "gshock_gmwb5000";
  if (id === "watch_tnf_supreme_gshock_dw6900" || id === "clothing_tnf_supreme_gshock") return "tnf_supreme_gshock_dw6900";
  if (id === "watch_seiko_5_sports_srpd") return "seiko5_srpd";
  if (id === "watch_seiko_5_sports_sbsa") return "seiko5_sbsa";
  if (id === "sport_golf_titleist_tsr2_driver") return "titleist_tsr2_driver";
  if (id === "sport_golf_titleist_tsr3_driver") return "titleist_tsr3_driver";
  // Wave 187 (2026-05-18): 가민 워치 (smartwatch). narrow lane id 그대로 model 로 사용 (size/connectivity default 매핑 위해).
  if (id.startsWith("garmin_")) return id;
  return name || id || null;
}

function familyFrom(category: Sku["category"] | null, model: string | null) {
  if (!model) return null;
  if (model.includes("iphone")) return "iphone";
  if (model.includes("galaxy_s")) return "galaxy_s";
  if (model.includes("ipad")) return "ipad";
  if (model.includes("galaxy_tab")) return "galaxy_tab";
  if (model.includes("macbook")) return "macbook";
  if (model.includes("lg_gram")) return "lg_gram";
  if (model.includes("applewatch")) return "applewatch";
  if (model.includes("galaxywatch")) return "galaxywatch";
  if (model.includes("airpods")) return "airpods";
  if (category === "monitor") return "monitor";
  if (category === "speaker") return "speaker";
  if (category === "camera") {
    if (model.startsWith("eos_")) return "canon";
    if (model.startsWith("a")) return "sony";
    if (model.startsWith("z")) return "nikon";
    if (model.startsWith("x_")) return "fujifilm";
    return "camera";
  }
  // Wave 67/74: 신 사업 카테고리 brand 매핑.
  if (category === "watch") {
    if (model.startsWith("gshock") || model.includes("gshock") || model.includes("casio")) return "casio";
    if (model.startsWith("seiko")) return "seiko";
    return "watch";
  }
  if (category === "sport_golf") {
    if (model.startsWith("titleist")) return "titleist";
    return "sport_golf";
  }
  return category;
}

function parseAirpodsConnector(text: string) {
  const lower = normalize(text).toLowerCase();
  if (/usb\s*-?\s*c|usbc|c타입|타입c|씨타입|타입씨|c-type|ctype|c터입|c핀|c\s*핀|\ba3184\b|\bmww\d{2}/.test(lower)) return "usbc";
  if (/라이트닝|lightning|8핀|8\s*핀|팔핀|팔\s*핀|\ba2096\b/.test(lower)) return "lightning";
  return null;
}

function defaultAirpodsConnector(model: string | null, text: string) {
  const lower = normalize(text).toLowerCase();
  if (!model?.includes("airpods")) return null;
  // 2026-05-16: airpods_pro_2 통합 (Lightning + USB-C 한 SKU). connector default 안 박음 — 시세 단일 sample.
  if (model === "airpods_pro_2" || model.startsWith("airpods_pro_2_")) return null;
  if (
    model.includes("airpods_4") ||
    model.includes("airpods_pro_3")
  ) return "usbc";
  if (
    model.includes("airpods_2") ||
    model.includes("airpods_3") ||
    model.includes("airpods_pro_1")
  ) return "lightning";
  if (model.includes("airpods_max")) {
    if (/202[4-6]|c타입|타입c|usb\s*-?\s*c|usbc|ctype|c핀|c\s*핀|미드나이트|스타라이트|퍼플|오렌지|\ba3184\b|\bmww\d{2}/.test(lower)) return "usbc";
    if (/맥스\s*2|맥스2|max\s*2|max2|2세대|2 세대/.test(lower)) return "usbc";
    if (/1세대|1 세대|8핀|8\s*핀|팔핀|팔\s*핀|라이트닝|lightning|\ba2096\b|202[0-3]|2[0-3]\s*년/.test(lower)) return "lightning";
  }
  return null;
}

function parseAirpodsMaxGeneration(model: string | null, text: string) {
  if (!model?.includes("airpods_max")) return null;
  const lower = normalize(text).toLowerCase();
  // Wave 429 (2026-05-21): NFKC가 "ㄴㄴ"을 초성 자모로 분해해 no-ANC 부정 표현을 놓쳤다.
  // raw text는 그대로 lower 처리해서 "노캔 ㄴㄴ" / "노캔ㄴㄴ"을 보존한다.
  const rawLower = (text ?? "").toLowerCase();
  const rawCompact = rawLower.replace(/\s+/g, "");

  const ambiguous =
    /(?:1st|1\s*세대|1세대|1)\s*(?:or|또는|혹은|\/|,|와|과)\s*(?:2nd|2\s*세대|2세대|2)/.test(rawLower) ||
    /(?:1st|1\s*세대|1세대|1).{0,12}(?:2nd|2\s*세대|2세대|2).{0,12}(?:generation|세대)/.test(rawLower) ||
    /1(?:st)?or2(?:nd)?|1세대또는2세대|1세대2세대|1\/2세대/.test(rawCompact);
  if (ambiguous) return "unknown_generation";

  const usbCSignal = /202[4-6]|c타입|타입c|usb\s*-?\s*c|usbc|ctype|c핀|c\s*핀|미드나이트|스타라이트|퍼플|오렌지|\ba3184\b|\bmww\d{2}|맥스\s*2|맥스2|max\s*2|max2|2세대|2 세대/.test(lower);
  const lightningSignal = /1세대|1 세대|8핀|8\s*핀|팔핀|팔\s*핀|라이트닝|lightning|\ba2096\b|202[0-3]|2[0-3]\s*년/.test(lower);
  const legacyColorSignal = /스페이스\s*그레이|space\s*gr[ae]y|실버|silver|그린|green|핑크|pink/.test(lower);

  if (usbCSignal && legacyColorSignal) return "unknown_generation";
  if (usbCSignal && lightningSignal) return "unknown_generation";
  if (usbCSignal) return "max_usbc";
  if (lightningSignal) return "max_lightning";
  return "unknown_generation";
}

function hasAirpodsMaxFullProductContext(text: string) {
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  return (
    /(풀박스|풀박|풀구성|풀세트|박스\s*포함|구성품|본품|본체|정품|새상품|미개봉|a급|s급|헤드폰|헤드셋|headphone|headset)/.test(lower) ||
    /에어팟맥스.{0,12}(정상|상태좋|상태굿|사용감|실사용|구매|애플케어|보증)|(?:정상|상태좋|상태굿|사용감|실사용|구매|애플케어|보증).{0,12}에어팟맥스/.test(compact)
  );
}

function parseAirpodsNoiseControl(model: string | null, text: string) {
  if (!model?.includes("airpods_4")) return null;
  const rawLower = (text ?? "").normalize("NFKC").toLowerCase();
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const rawCompact = rawLower.replace(/\s+/g, "");

  if (
    /노캔.{0,20}(?:모르|되는지\s*안\s*되는지)|노캔.{0,20}되는지안되는지/.test(lower) ||
    /노캔.{0,20}(?:모르|되는지\s*안\s*되는지)|노캔.{0,20}되는지안되는지/.test(rawLower)
  ) {
    return "unknown_anc";
  }

  if (
    /노캔\s*(?:x|×|❌|ㄴㄴ|ᄂᄂ|노노|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원)|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)\s*(?:x|×|❌|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원)|anc\s*(?:x|no|없|미지원)/.test(rawLower) ||
    /노캔\s*(?:x|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원)|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)\s*(?:x|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원)|anc\s*(?:x|no|없|미지원)/.test(lower) ||
    /노캔이되는모델은아니|노캔안되는|노캔안돼|노캔없는|노캔x|노캔❌|노캔ㄴㄴ|노캔ᄂᄂ|노캔노노|노캔아님|노캔아니|노캔착각|노클x|노이즈캔슬링안되는|노이즈캔슬안되는|ancx/.test(rawCompact) ||
    /노캔이되는모델은아니|노캔안되는|노캔안돼|노캔없는|노캔x|노캔아님|노캔아니|노캔착각|노클x|노이즈캔슬링안되는|노이즈캔슬안되는|ancx/.test(compact) ||
    /일반\s*모델|일반형|기본\s*모델|기본모델|유선\s*충전|유선충전|mxp63/.test(lower) ||
    // Wave 90: "비노캔" 키워드 추가 (사용자 코멘트로 발견 — pid 403846241)
    /비\s*노캔|비노캔|비\s*노이즈\s*캔슬|비노이즈캔슬/.test(lower) ||
    /비\s*노캔|비노캔|비\s*노이즈\s*캔슬|비노이즈캔슬/.test(rawLower)
  ) {
    return "no_anc";
  }

  if (
    /노캔\s*(?:0|o|○|지원|되는|가능|됩니다|됨|되요|돼요|있|있음|모델|제품|상품|미개봉|풀박스|풀박|판매|팔아)|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|액티브\s*노이즈|anc\s*(?:o|yes|지원)?/.test(lower) ||
    /노캔0|노캔o|노캔되는|노캔가능|노캔됩니다|노캔됨|노캔있음|노캔모델|노캔제품|노캔상품|노캔미개봉|노캔풀박|노이즈캔슬링|노이즈켄슬링|노이즈캔슬|노이즈켄슬/.test(compact) ||
    /노캔\s*(?:미개봉|풀박스|풀박|모델)?\s*$/.test(rawLower.trim())
  ) {
    return "anc";
  }

  return "unknown_anc";
}

function defaultWatchSizeMm(model: string | null) {
  if (!model) return null;
  if (model.includes("applewatch_ultra")) return 49;
  if (model.includes("galaxywatch_ultra")) return 47;
  // Wave 187 (2026-05-18): 가민 워치 size default (narrow lane 모델별 명확).
  if (model === "garmin_fenix_7" || model === "garmin_fenix_8" || model === "garmin_forerunner_955" || model === "garmin_forerunner_965" || model === "garmin_forerunner_970" || model === "garmin_epix_pro") return 47;
  if (model === "garmin_fenix_7s") return 42;
  if (model === "garmin_fenix_7x") return 51;
  if (model === "garmin_forerunner_265") return 46;
  if (model === "garmin_instinct_2" || model === "garmin_venu_3") return 45;
  return null;
}

function defaultConnectivity(model: string | null) {
  if (!model) return null;
  if (model.includes("applewatch_ultra") || model.includes("galaxywatch_ultra")) return "cellular";
  // Wave 109 (2026-05-15): Apple Watch SE/Series, Galaxy Watch 6/7 — cellular 명시 없으면 GPS default.
  // 한국 reseller 시장에서 GPS 모델이 95%+ (Cellular는 별도 통신사 plan 필요 + 매물 표기 명시).
  // 정책 12c "모델코드 기반 정확성 보강" 해석. 시세 영향 작음 (모집단 95% GPS → 평균 GPS 수렴).
  // unknown_connectivity 800건 → cellular 명시 매물 외 GPS 분류 → narrow lane 진입 가능.
  if (
    model.includes("applewatch_se") ||
    model.includes("applewatch_series") ||
    model.includes("galaxywatch_6") ||
    model.includes("galaxywatch_7")
  ) {
    return "gps";
  }
  // Wave 187 (2026-05-18): 가민 워치 — 모두 GPS default (운동 시계 핵심).
  if (model.startsWith("garmin_")) return "gps";
  return null;
}

function defaultTabletScreenSizeIn(model: string | null) {
  if (!model) return null;
  if (model === "ipad_10") return 10.9;
  if (model === "ipad_11") return 11;
  // Wave 182 (2026-05-17): iPad 7/8/9 일반 (Pro/Air/Mini 아닌) — 10.2".
  if (model === "ipad_7" || model === "ipad_8" || model === "ipad_9") return 10.2;
  if (/^ipad_(?:pro|air)_11_/.test(model)) return 11;
  if (/^ipad_(?:pro|air)_13_/.test(model)) return 13;
  // Wave 182 (2026-05-17): iPad Pro 12.9 M1 + iPad Air 4/5 narrow lane 추가.
  if (/^ipad_pro_12_9_/.test(model)) return 12.9;
  if (/^ipad_air_(?:4|5)_/.test(model)) return 10.9;
  if (/^ipad_mini_/.test(model)) return 8.3;
  // Wave 182 chunk 6 (2026-05-17): Galaxy Tab S6 (2019.8, 10.5") + S6 Lite (2020.5, 10.4") 추가.
  if (model === "galaxy_tab_s6") return 10.5;
  if (model === "galaxy_tab_s6_lite") return 10.4;
  if (model === "galaxy_tab_s7" || model === "galaxy_tab_s8" || model === "galaxy_tab_s9") return 11;
  if (model === "galaxy_tab_s9_fe") return 10.9;
  if (model === "galaxy_tab_s9_fe_plus") return 12.4;
  if (model === "galaxy_tab_s10_fe_plus") return 13.1;
  // Wave 182 (2026-05-17): Galaxy Tab S7 변형 추가.
  if (model === "galaxy_tab_s7_plus" || model === "galaxy_tab_s7_fe") return 12.4;
  if (model === "galaxy_tab_s8_plus" || model === "galaxy_tab_s9_plus" || model === "galaxy_tab_s10_plus") return 12.4;
  if (model === "galaxy_tab_s8_ultra" || model === "galaxy_tab_s9_ultra" || model === "galaxy_tab_s10_ultra") return 14.6;
  return null;
}

function defaultLaptopMemory(category: Sku["category"] | null, model: string | null, chip: string | null, screenSizeIn: number | null, text: string) {
  if (category !== "laptop" || !model) return { ramGb: null, ssdGb: null };
  const lower = normalize(text).toLowerCase();
  const baseSignal = /기본형|기본\s*모델|깡통|베이스\s*모델|base\s*model/.test(lower);
  if (!baseSignal) return { ramGb: null, ssdGb: null };

  if (model === "macbook_air") {
    return { ramGb: 8, ssdGb: 256 };
  }

  if (model === "macbook_pro") {
    if (screenSizeIn === 13) return { ramGb: 8, ssdGb: 256 };
    if (screenSizeIn === 14 || screenSizeIn === 16 || chip?.includes("pro") || chip?.includes("max")) {
      return { ramGb: 16, ssdGb: 512 };
    }
  }

  return { ramGb: null, ssdGb: null };
}

function conditionFromText(
  text: string,
  batteryHealth: number | null,
  cycles: number | null,
  category: Sku["category"] | null = null,
) {
  // Wave 204/207 (2026-05-18): title-only matching 위해 raw text 에서 첫 줄 분리.
  // normalize 가 \n 을 공백으로 합치므로 정규화 후엔 title/description 구분 불가.
  // raw text 의 \n split → 첫 줄만 normalize.
  const rawTitle = (text ?? "").split("\n")[0] ?? "";
  const titleNormalized = normalize(rawTitle).toLowerCase();
  const lower = normalize(text).toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const defectRiskText = lower
    .replace(/리퍼\s*(?:제품\s*)?(?:아님|아닙니다|아닌|아니고|아니며)/g, " ")
    .replace(/(?:수리|교체)\s*(?:이력|내역)?\s*(?:없|없음|없습니다|없고|무|x|안함|안\s*함|한\s*적\s*없)/g, " ")
    .replace(/(?:하자|불량|파손|깨짐)(?:이나|이나요|은|는|이|가)?\s*(?:전혀\s*)?(?:없|없음|없습니다|없고|없이|아님|아닙니다|x)/g, " ")
    .replace(/(?:액정|화면|디스플레이).{0,18}(?:하자|문제|파손|깨짐|깨진\s*곳|불량|기스|손상).{0,12}(?:없|없음|없습니다|없이|아님|멀쩡|정상|깨끗)/g, " ")
    .replace(/(?:액정|화면|디스플레이|스크린).{0,18}(?:깨진\s*것|깨진거|깨짐|파손).{0,16}(?:아니|아님|아닙|필름)|(?:깨진\s*것|깨진거|깨짐|파손).{0,12}(?:필름).{0,16}(?:액정\s*x|액정\s*아님|액정\s*아니)/g, " ")
    .replace(/(?:화면|액정|디스플레이|스크린).{0,18}(?:깨짐|깨진\s*것|깨진거|파손).{0,24}(?:필름(?:이|만)?\s*(?:깨진|깨짐|금)|필름\s*붙)|(?:보호\s*)?(?:필름|강화\s*유리|유리\s*필름).{0,18}(?:깨진|깨짐|금).{0,24}(?:화면|액정|디스플레이|스크린).{0,12}(?:아니|아님|아닙)/g, " ")
    .replace(/(?:화면|액정|디스플레이|스크린).{0,12}깨진\s*거\s*처럼.{0,40}(?:없|없음|없습니다|아님|아니)|(?:화면|액정|디스플레이|스크린).{0,20}깨지거나.{0,20}(?:없|없음|없습니다)/g, " ")
    .replace(/(?:시스템|크라운|디스플레이|액정|화면)\s*불량\s*없이/g, " ")
    .replace(/(?:문제|하자|기능\s*이상).{0,20}(?:교환|환불|보상|기간|정책)/g, " ")
    .replace(/잔상을\s*제외|잔상\s*제외|잔상\s*[:：]?\s*(?:양호|정상)/g, " ")
    .replace(/(?:고객\s*부주의|본인\s*과실|단순\s*변심|기능\s*문제가\s*아닌).{0,50}(?:파손|침수|충격|액정\s*나감|액정나감|꺼짐|멍).{0,50}(?:교환|환불|반품).{0,12}불가/g, " ")
    .replace(/(?:파손|깨짐|고장).{0,12}(?:동의|면책).{0,18}(?:택배|배송)|(?:택배|배송).{0,18}(?:파손|깨짐|고장).{0,12}(?:동의|면책|우려|위험)/g, " ")
    .replace(/(?:시계줄|워치\s*줄|줄|스트랩|밴드).{0,28}(?:교체|길이\s*조정\s*불가|조정\s*불가|줄임|줄여)/g, " ")
    .replace(/(?:충전기|충전\s*기|충전독|충전\s*독|충전케이블|충전\s*케이블|케이블).{0,16}(?:없|없음|없습니다|분실|미포함|제외)/g, " ")
    .replace(/(?:램|ram|메모리).{0,16}교체.{0,10}불가능/g, " ")
    .replace(/크랙\s*버전|크랙버전|crack\s*version/g, " ")
    .replace(/(?:공식|애플\s*스토어|애플스토어|공식\s*센터|서비스\s*센터).{0,30}(?:배터리|키캡|키보드).{0,20}교체/g, " ")
    .replace(/(?:카메라|렌즈).{0,28}(?:기스|흠집|찍힘|깨짐|깨진|깨져|파손|크랙|금|멍|문제|이상|불량).{0,14}(?:없|없음|없습니다|없어요|없이|아님|아닙니다|x)/g, " ")
    .replace(/카메라\s*보호\s*필름|카메라보호필름|렌즈\s*보호\s*필름|렌즈보호필름|카메라\s*섬\s*주변.{0,16}(?:생활\s*기스|기스\s*정도|미세\s*기스)/g, " ")
    .replace(/침수(?:폰)?\s*(?:없|없음|없습니다|아님|취급하지|취급\s*안)|침수.{0,12}(?:이력|내역).{0,12}(?:없|없음|없습니다|전혀\s*없)/g, " ")
    .replace(/분실.{0,8}도난.{0,20}(?:취급하지|취급\s*안)|(?:분실|도난).{0,12}(?:없|없음|없습니다|취급하지|취급\s*안)/g, " ")
    .replace(/(?:깨짐|기스|스크래치).{0,12}(?:없|없음|없습니다|없고)/g, " ")
    .replace(/(?:액정|디스플레이|화면)\s*(?:깨짐|파손|불량)\s*(?:없|없음|없습니다|없고)/g, " ")
    .replace(/무상\s*수리\s*가능/g, " ")
    .replace(/추후.{0,20}(?:파손|수리).{0,20}시/g, " ")
    .replace(/(?:펜슬|애플펜슬|키보드|케이스).{0,24}(?:충전|연결|작동).{0,12}(?:안되|안됨|불량|문제)/g, " ")
    .replace(/택배.{0,20}(?:파손|고장|문제).{0,20}(?:되면|생길\s*수|위험)/g, " ");
  let score = 0.75;
  const notes: string[] = [];
  const add = (note: string, delta: number) => {
    notes.push(note);
    score += delta;
  };

  // Wave 91 (사용자 요청 pid 368060006): 미개봉/새상품 detection 변형 흡수.
  // 2026-05-16 (Iteration 5 audit): false positive 차단. sampling 결과 5,068건 중 ~27% false positive 발견.
  // 패턴:
  //   - "새상품과 같은 상태" / "새상품 같은" — 실사용인데 새상품 비교 표현
  //   - "거의 새거" / "거의새거" — 실사용 매물
  //   - "실사용 X번" — 사용 매물 명시
  //   - "사용 얼마 안" — 실사용 매물
  //   - "새 것 같은" / "새거 같은" / "새상품급" — 새상품 아님
  // 2026-05-16 (사용자 코멘트 id 107 pid 407909846): "새상품 구입 후 2주 정도 사용" — false positive.
  //   - "구입/구매 후 X (시간단위) 사용" 명시 매물은 실사용. new_or_open_box 차단.
  //   - condition_class 는 별도 로직 (mint/clean 가능).
  //   - 다나와 reference_price 매핑 차단 → 진짜 중고 시세로 비교.
  const newSignalNegativePattern = /새\s*(?:상품|제품|것|거)\s*(?:과\s*)?(?:같은|처럼|급|레벨|수준|상태)/i.test(lower) ||
    /거의\s*새/i.test(lower) ||
    /실사용\s*\d+\s*번/i.test(lower) ||
    /사용\s*얼마\s*(?:안|않)/i.test(lower) ||
    /(?:구입|구매|받은|개봉)\s*(?:후|뒤|지|한지)\s*[0-9]+\s*(?:주|일|개월|년|달|시간)\s*(?:정도\s*|쯤\s*|만\s*)?사용/i.test(lower) ||
    /[0-9]+\s*(?:주|일|개월|년|달)\s*(?:정도\s*|쯤\s*)?사용\s*했/i.test(lower);
  // 2026-05-16 (사용자 코멘트 #121 pid 350167397): "스트랩(새거)" 가 본체 "새거"로 false positive.
  // "새것/새거/새 것" 단독 매칭 제거 — 액세서리/구성품 context 에서 자주 false positive.
  // 본체 미개봉만 잡으려면 명확한 키워드 (미개봉/박스 미개봉/포장 안 뜯음/brand new) 만 유지.
  // 2026-05-16 (사용자 코멘트 id 115/116/82 — pid 334814973/334403685/403851792):
  //   "정품 스트랩... 새제품" / "새 제품입니다" 셀러 인플레 / 액세서리 context false positive 다수.
  //   "새상품/새 제품/새제품" 단독 매칭 제거. "박스 새상품 미개봉" 같은 명시 키워드만 유지.
  //   "새상품" 단어가 본체 unopened 신호인 케이스가 액세서리/인플레 false positive 보다 적음.
  // Wave 203 (2026-05-18): 사용자 통찰 — "미개봉인데 어떻게 97%? 상식적으로 모순".
  //   진짜 미개봉이면 배터리 % / 사이클 measure 불가능 (박스 안 뜯음 = 한 번도 안 켜).
  //   셀러가 "미개봉" 박았는데 배터리/사이클 measure 명시 = 거짓 미개봉.
  //   → 자연어 new 신호 무시 (객관적 measurement 가 자연어 false positive 차단).
  const hasMeasuredUsage = (batteryHealth != null && batteryHealth > 0) || (cycles != null && cycles > 0);
  const explicitNewSignal = !newSignalNegativePattern
    && !hasMeasuredUsage
    && /미개봉|미\s*개봉|단순개봉|미사용\s*(?:신|새|상품|제품)|박스\s*(?:미개봉|새상품)|포장\s*(?:미개봉|안\s*뜯|안뜯)|개봉\s*안\s*함|개봉\s*안함|뜯지\s*않은|언박싱\s*전|brand\s*new|미\s*뜯|안\s*뜯/.test(lower);
  if (explicitNewSignal) add("new_or_open_box", 0.15);
  // 2026-05-16 (사용자 코멘트 id 82/115 pid 403851792/334403685): batteryHealth=100 단독 unopened 마킹 제거.
  //   기존 정책 (Wave 91): Apple 100% = 새제품 가정. 시세 sample 평균 끌어올림 차단 의도.
  //   문제: 셀러 "새 제품입니다" 인플레 + 100% / "풀박X 100%" 사용 매물 false positive 다수.
  //   사용자 의도: 명시적 unopened 키워드 (미개봉/박스 미개봉) 없으면 clean (mint) 까지만 분류.
  //   시세 sample 분리는 별도 mechanism (condition_class 별 grouping — Wave 130).
  if (!explicitNewSignal && batteryHealth != null && batteryHealth >= 100) {
    add("battery_perfect", 0.05);
  }
  // Wave 203 (2026-05-18): battery 95~99% 객관적 신호 — 사용감 적은 매물 강한 증거.
  // 사용자 통찰: "객관적 measure 값이 자연어보다 강해야 한다".
  if (batteryHealth != null && batteryHealth >= 95 && batteryHealth < 100) {
    add("battery_high_health", 0.05);
  }
  if (/풀박스|풀박|풀구성|풀세트|구성품\s*전부/.test(lower)) add("full_set", 0.05);

  // Wave 204 (2026-05-18): buy-intent 매물 broad catalog 일반 차단.
  // 사용자 코멘트 #155 (pid 397387660): "갤탭 s9 fe 플러스 구함" — broad SKU (galaxy-tab-s9-fe-plus) 진입.
  // 기존: option-parser.ts:1842/1857/1880 narrow lane 3개 (ipad_pro_11_m4 / sony_wh1000xm4 / iphone_15_pro_128) 만 buying_post reject.
  // catalog.ts mustNotContain "삽니다/매입/구합니다" 일부 SKU 에만 박힘 (drift 위험).
  // 근본 fix: parser 일반 detection → FLAWED + POOL_BLOCK + COMPARABLE_EXCLUDE 일반화. 모든 SKU 자동 적용.
  // title-only matching (description false positive 보수적 차단 — §12b 정확성 우선).
  if (/(?:구함|구합니다|구해요|구해봅니다|삽니다|매입|구매\s*합니다|구매합니다|\bwtb\b|사고\s*싶어요|사고싶어요)/i.test(titleNormalized)) {
    add("buying_post", -0.4);
  }

  // Wave 531 (2026-05-22): exchange-only listings are not buyable acquisition targets.
  // Keep "교환/환불 불가" and "교환 가능" sale disclaimers out of this block by requiring
  // directional/exclusive wording in the title.
  const exchangeOnlyPattern = /\[\s*교환\s*\]|^교환\s+|(?:^|[\s[\]()])교환글|(?:^|[\s[\]()])교환\s*(?:해요|합니다|희망|원해|구해|구합니다|만|글)|(?:->|→).{0,36}교환|교환.{0,12}(?:->|→)/i;
  if (exchangeOnlyPattern.test(titleNormalized)) {
    add("exchange_only", -0.4);
  }

  // Wave 207 (2026-05-18): earphone single-side (한쪽만) 매물 차단.
  // 사용자 코멘트 #153 (pid 343583659): "에어팟프로2세대 C타입 왼쪽, A-급" → AirPods Pro 2 본체 SKU 매칭.
  // 무선 이어폰류는 페어 단위 시세 — 한쪽만 매물은 단품 (정상 거래 X, 시세 부풀림).
  // 근본 fix: earphone 카테고리 single_side_only note → FLAWED + POOL_BLOCK.
  // title-only matching (description "왼쪽 이어폰 잘 됨" 같은 정상 표현 false positive 차단).
  if (category === "earphone") {
    const singleSidePattern = /(?:^|[\s\[(/,])(?:왼쪽(?:만)?|오른쪽(?:만)?|좌측(?:만)?|우측(?:만)?|왼유닛|오른유닛|left\s*only|right\s*only|l\s*유닛|r\s*유닛|한\s*쪽만|한쪽만)(?:[\s\])\/,]|$)/i;
    if (singleSidePattern.test(titleNormalized)) {
      add("single_side_only", -0.4);
    }
  }

  // Wave 760 (2026-05-24): 게임 카트리지 (game_console isGameTitle SKU) 특화 condition signal.
  //   Wave 760 sweep: 미개봉/풀박/한정판 매물 시세 1.5~3x normal. used 라벨 손상/디스크 흠집 매물 시세 절반.
  //   적용: 카트만 (박스 없음) / 디스크 손상 / 라벨 손상 / 정품 박스 / 한정판 / DLC 사용 여부.
  if (category === "game_console") {
    // 카트리지/디스크 단품 (박스/매뉴얼/케이스 없음) — 정품 박스 대비 -20~30% 시세.
    //   "카트만" / "카트리지만" / "디스크만" / "타이틀만" 등.
    //   negation: "카트 + 박스" / "박스 포함" 같은 풀구성 표현.
    const noBoxNegation = /(?:박스|케이스|매뉴얼|설명서|풀박|풀세트|풀구성)\s*(?:포함|있|같이|모두)|구성\s*(?:완벽|풀)/.test(lower);
    if (!noBoxNegation && /카트(?:리지)?\s*(?:만|단품|단독)|디스크\s*(?:만|단품|단독)|타이틀\s*(?:만|단품)|소프트(?:웨어)?\s*(?:만|단품)|(?:박스|케이스|매뉴얼|설명서)\s*(?:없|미포함|분실|없음|없습니다)/.test(lower)) {
      add("game_cart_only_no_box", -0.1);
    }
    // 라벨/디스크 손상 — 게임 매물의 핵심 손상 signal. 작동은 되지만 외관/리딩 문제.
    //   라벨: "라벨 찢" / "라벨 까짐" / "라벨 손상" / "라벨 더러움".
    //   디스크: "디스크 깨" / "디스크 금" / "디스크 흠집" / "디스크 손상" / "리딩 불량" / "인식 불량".
    const noGameDamage = /(?:라벨|디스크|카트)\s*(?:손상|훼손|상처|흠집|문제|불량)\s*(?:없|없음|아님|깨끗|새것)/.test(lower);
    if (!noGameDamage && /라벨\s*(?:찢|까짐|벗겨|손상|훼손|더러|이염|찍힘|기스|많이\s*닳)|디스크\s*(?:깨|금\s*갔|크랙|손상|훼손|심한\s*기스|많이\s*긁힘|동작\s*불량|리딩\s*불량|인식\s*불량)|카트(?:리지)?\s*(?:손상|훼손|구부|휘어|단자\s*손상)/.test(lower)) {
      add("game_label_or_disc_damage", -0.2);
      // Wave 760d: ConditionClass FLAWED 분류 보장 (extractConditionClass piggy-back).
      if (!notes.includes("repair_or_defect_signal")) notes.push("repair_or_defect_signal");
    }
    // 한정판 / 초회판 / 패키지 / 특전 — 시세 1.5~3x normal. premium signal.
    //   주의: 일반 매물에서 "한정판" 단어만 잡으면 false positive 위험 — 박스/특전/스틸북 동반 시만.
    if (/(?:초회\s*한정|초회판|초회\s*특전|한정판\s*박스|스틸북|steelbook|specials?\s*edition|콜렉터스?\s*에디션|collectors?\s*edition|premium\s*edition|픽처\s*디스크|아트북\s*포함|사운드트랙\s*포함|ost\s*포함|특전\s*포함|특전\s*박스)/i.test(lower)) {
      add("game_limited_edition", 0.05);
      // Wave 760d: ConditionClass CLEAN 분류 보장 (extractConditionClass good_condition piggy-back).
      if (!notes.includes("good_condition")) notes.push("good_condition");
    }
    // DLC 코드 / 시즌패스 — 사용 여부 따라 시세 영향.
    //   "DLC 사용 안 함" / "DLC 코드 그대로" / "시즌패스 미사용" = mint signal.
    //   "DLC 사용함" / "DLC 코드 사용" = 시세 보수적 감안.
    if (/(?:dlc|시즌\s*패스|season\s*pass)\s*(?:코드\s*)?(?:사용함|썼|사용\s*했)/i.test(lower)) {
      add("game_dlc_used", -0.05);
    }
    if (/(?:dlc|시즌\s*패스|season\s*pass)\s*(?:코드\s*)?(?:미사용|사용\s*안\s*함|안\s*씀|그대로|있음)/i.test(lower)) {
      add("game_dlc_unused", 0.03);
    }
    // 정품 박스 미개봉 — 게임 카트리지 mint signal 강화.
    //   "박스 미개봉" 은 conditionFromText 본체에서 unopened 잡지만, 게임 한정 강화 (false positive 적음).
    if (/(?:게임\s*)?(?:박스|패키지|소프트|타이틀|카트(?:리지)?)\s*(?:완전\s*)?미개봉|시일\s*(?:살아\s*있|그대로)|봉인\s*(?:살아\s*있|그대로)/.test(lower)) {
      add("game_factory_sealed", 0.08);
    }
  }

  // Wave 760 (2026-05-24): 골프 클럽 (sport_golf) 특화 condition signal.
  //   Wave 760 sweep: 그립 새것 / 페이스 깨끗 / 신상 박스 매물 시세 1.4~2x. 헤드 도장 벗 / 샤프트 굽음 매물 시세 절반.
  //   조정 부위 (loft/lie) 는 시세 영향 작음 — split 생략 (catalog 단계 narrow split 으로 처리됨).
  if (category === "sport_golf") {
    // 그립 — 골프 매물의 첫 번째 시각적 wear signal. 교체 가능하지만 매물 가치 영향 큼.
    //   negation: "그립 새것/교체" 는 mint, "그립 마모/닳음/미끄러움" 은 worn.
    if (/그립\s*(?:새\s*것|새것|새거|교체|신품|미사용)|그립\s*새로\s*감|그립\s*감은\s*지\s*얼마|새\s*그립/.test(lower)) {
      add("golf_grip_new", 0.05);
      // Wave 760d: ConditionClass CLEAN 분류 보장.
      if (!notes.includes("good_condition")) notes.push("good_condition");
    }
    if (/그립\s*(?:마모|닳|미끄러|딱딱|딱딱해|굳|갈라|찢어|벗겨|많이\s*사용)|그립이?\s*(?:마모|닳|미끄러)/.test(lower)) {
      add("golf_grip_worn", -0.08);
      // Wave 760d: ConditionClass WORN 분류 보장.
      if (!notes.includes("cosmetic_wear")) notes.push("cosmetic_wear");
    }
    // 페이스 / 스코어라인 — 임팩트 부분. 마모 시 비거리/스핀 영향 → 시세 큼.
    if (/페이스\s*(?:깨끗|새것|새거|마모\s*없|깨끗합니다|상태\s*좋|좋음)|스코어라인\s*(?:살아\s*있|깨끗|선명|새것)/.test(lower)) {
      add("golf_face_clean", 0.03);
      if (!notes.includes("good_condition")) notes.push("good_condition");
    }
    if (/페이스\s*(?:마모|닳|움푹|푹\s*패|많이\s*패|까짐|타구\s*자국\s*심)|스코어라인\s*(?:다\s*닳|마모\s*심|지워|사라)|페이스에\s*움푹\s*패/.test(lower)) {
      add("golf_face_worn", -0.15);
      if (!notes.includes("cosmetic_wear")) notes.push("cosmetic_wear");
    }
    // 헤드 / 크라운 — 드라이버/우드 도장 벗겨짐. 외관 손상 signal.
    if (/(?:헤드|크라운|쇼울더|페이스).{0,8}(?:도장\s*(?:벗|벗겨|박리|들뜸|날아|많이\s*벗|많이\s*까)|페인트\s*(?:벗|벗겨|박리|들뜸|날아)|크랙|많이\s*까짐|많이\s*벗|디봇\s*심|찍힘\s*심|많이\s*찍힘|기스\s*심)/.test(lower)) {
      add("golf_head_paint_damage", -0.12);
      if (!notes.includes("cosmetic_wear")) notes.push("cosmetic_wear");
    }
    // 샤프트 — 강도/탄성 핵심 부품. 손상 시 reject 직전.
    const noShaftDamage = /샤프트.{0,8}(?:손상|굽|크랙|갈라)\s*(?:없|없음|아님|깨끗|정상)/.test(lower);
    if (!noShaftDamage && /샤프트.{0,8}(?:굽|휨|휘었?|크랙|갈라|손상|꺾|부러|만곡|벤딩|뽀개)|샤프트에?\s*금|샤프트.{0,8}심한\s*기스/.test(lower)) {
      add("golf_shaft_damage", -0.25);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
    // 라운딩/필드 사용 횟수 — 명시된 사용 빈도 신호.
    //   라운딩 0~5회 = mint 직전 / 라운딩 50+ = heavily used.
    const roundingMatch = lower.match(/라운(?:딩|드)\s*(?:횟수\s*)?(\d{1,3})\s*회/);
    if (roundingMatch) {
      const r = Number(roundingMatch[1]);
      if (Number.isFinite(r)) {
        if (r <= 5) add("golf_rounding_few", 0.05);
        else if (r >= 50) add("golf_rounding_many", -0.08);
      }
    }
    // 신상 / 박스 미개봉 / 시타 X — 골프 mint signal 강화.
    //   "시타만" / "시타도 안 함" / "박스 미개봉" / "라운딩 안 함" 등.
    if (/시타\s*(?:도\s*)?(?:안\s*함|안함|미사용|없)|박스\s*(?:채로\s*)?미개봉|라운(?:딩|드)\s*(?:0회|안\s*함|미사용|미경험)|신품\s*(?:박스|상태)|배송\s*받은\s*그대로/.test(lower)) {
      add("golf_unused_new", 0.08);
    }
    // 풀세트 / 캐디백 / 가방 동반 — premium accessory bundle.
    if (/풀\s*세트|풀세트|하프\s*세트|하프세트|캐디백\s*(?:포함|같이|증정|동반|드림)|골프백\s*(?:포함|같이|증정|동반|드림)|커버\s*(?:포함|같이|증정)|가방\s*(?:포함|같이|증정)/.test(lower)) {
      add("golf_full_set_bundle", 0.03);
    }
    // 트럭/직배 / 직거래 가능 — 큰 가방 송배 부담 매물의 정상 signal.
  }

  // Wave 208 (2026-05-18): 호환 액세서리 매물 일반 차단.
  // 사용자 코멘트 #157 (pid 398121430): "DJI 오즈모 액션6 용 pov 렌즈" → Action 6 본체 SKU 매칭.
  // 기존: catalog.ts DRONE_FILTER_ACCESSORY_NOISE drone-only — 다른 카테고리 (camera/tablet/laptop) 누락.
  // 근본 fix: parser detection "X용 + 액세서리 부속어" → accessory_compatible note 일반화. 모든 카테고리 자동.
  // title-only (description 의 "본체 + 케이스 포함" 같은 정상 매물 false positive 차단).
  // 패턴: "[단어]용 + (렌즈|필터|마운트|...)" — "용" 앞 단어 결합 매칭 필수 ("용 단독" false positive 차단).
  const accessoryCompatibilityPattern = /[가-힣A-Za-z0-9]+\s*용\s*(?:pov\s*)?(?:렌즈|필터|마운트|어댑터|거치대|충전기|배터리|케이블|보호\s*필름|보호필름|폴리오|스타일러스|손목\s*밴드|와이파이\s*동글|동글|그립|마이크|sd\s*카드|메모리\s*카드|스트랩\s*어댑터|케이스|커버|파우치|크래들|스탠드|홀더|클립|독|도크)/i;
  if (accessoryCompatibilityPattern.test(titleNormalized)) {
    add("accessory_compatible_for_other_product", -0.4);
  }
  const explicitPartsOnlyTitlePattern = /(?:부속품|악세사리|액세서리)\s*(?:만|단품|팝니다|판매|팔아요|처분)|(?:type\s*[- ]?c\s*)?(?:베이스|마운트|어댑터|거치대|렌즈|필터|독|도크)\s*(?:만|단품|팝니다|판매|팔아요)?$/i;
  const explicitBodyMissingPattern = /(?:본체|바디)\s*(?:없|미포함|제외)|(?:본품|본체)\s*(?:없이|없는)/i;
  if (explicitPartsOnlyTitlePattern.test(titleNormalized) || explicitBodyMissingPattern.test(titleNormalized)) {
    add("parts_only", -0.4);
  }

  // 2026-05-15 (사용자 코멘트 pid 408124976): 애플케어/AC+/삼성케어 매물은
  // 보증 프리미엄으로 단품 시세 대비 비쌈 → 시세 집계에서 제외.
  // pool 진입은 허용 (보증 포함인데 단품 시세보다 싸면 명백한 꿀).
  if (/애플\s?케어|애케플|애캐플|apple\s?care|ac\+|ac\s?플러스|삼성\s?케어|samsung\s?care/i.test(lower)) {
    add("applecare_premium", 0.05);
  }

  // 2026-05-15 (사용자 코멘트 pid 407555096 / 407486890 / "아이패드 프로 m4 13인치 / 애플펜슬 프로 / 키보드"):
  // 단품 매물의 시세 비교군에 액세서리 번들이 끼면 평균을 끌어올림.
  // 본품 + 명시적 액세서리 패턴만 잡음 (false positive 위험 최소화).
  // 연결어에 슬래시/가운뎃점/콤마/+/및/와/과/함께/포함/세트 포함 (실제 title 변형 흡수).
  // pool 진입은 허용 (액세서리 포함된 매물이 단품 시세보다 싸면 명백한 꿀).
  const accessoryBundlePattern = /(?:[+/·,]\s*|및\s*|와\s*|과\s*|함께\s*|포함\s*|세트\s*)(?:애플\s?펜슬|애플펜슬\s?프로|매직\s?키보드|스마트\s?키보드|스마트\s?커버|스마트\s?폴리오|폴리오\s?커버|매직\s?마우스|매직\s?트랙패드|애플\s?케이블|키보드\b)|(?:애플\s?펜슬|애플펜슬\s?프로|매직\s?키보드|스마트\s?키보드|스마트\s?폴리오|매직\s?마우스)\s*(?:포함|세트|같이|번들|와\s*함께|증정|등\s*(?:팝|판매))/i;
  if (accessoryBundlePattern.test(lower)) {
    add("accessory_bundle", 0.05);
  }

  // 2026-05-15 (사용자 코멘트 pid 407879893): 다른 카테고리 본품이 함께 묶인 매물
  // (예: "아이폰17 + 애플워치 SE3 40mm"). 단품 시세 비교군에 들어가면 평균 왜곡,
  // 더 심각하게는 양쪽 카테고리 pool에 동시 진입할 위험.
  // 정확성 우선 — title/desc에 명시적 device signature 2개 이상이 강한 연결어(+/세트/번들/같이/함께/와)와 동반될 때만.
  // 액세서리(애플펜슬·매직키보드 등)는 accessory_bundle이 따로 잡음. 여기는 본품끼리만.
  const DEVICE_SIGNATURES: Record<string, RegExp> = {
    iphone: /아이폰\s?\d{1,2}|iphone\s?\d{1,2}/i,
    ipad: /아이패드(?:\s?(?:프로|에어|미니))?(?:\s?(?:\d{1,2}|m\d))/i,
    macbook: /맥북(?:\s?(?:에어|프로))/i,
    apple_watch: /애플\s?워치|apple\s?watch/i,
    airpods: /에어팟(?:\s?(?:프로|맥스|\d))?|airpods/i,
    galaxy_phone: /갤럭시\s?(?:s|z|note|폴드|플립)\s?\d{1,2}|galaxy\s?(?:s|z|note|fold|flip)\s?\d{1,2}/i,
    galaxy_tab: /갤럭시\s?탭|galaxy\s?tab/i,
    galaxy_watch: /갤럭시\s?워치\s?\d|galaxy\s?watch\s?\d/i,
    galaxy_buds: /갤럭시\s?버즈|galaxy\s?buds/i,
  };
  const matchedDevices = Object.entries(DEVICE_SIGNATURES)
    .filter(([, re]) => re.test(lower))
    .map(([k]) => k);
  const hasStrongConnector = /(?:[+/·]|및|와\s|과\s|함께|세트|번들|같이|증정|together|등\s*(?:팝|판매))/i.test(lower);
  if (matchedDevices.length >= 2 && hasStrongConnector) {
    add("multi_device_bundle", 0);
  }

  if (/s급|상태\s*좋|상태좋|깨끗|깔끔/.test(lower)) add("good_condition", 0.05);
  // Wave 209 (2026-05-18): cosmetic_wear negation 보강 — "사용감 적음/없음" 자체는 wear 아님.
  // 사용자 #159 매물 description "사용감 적음" — 셀러 명시적 부정인데 cosmetic_wear 박힘 → worn 분류 잘못.
  // 사용자 정책: "사용감 적음/없음" 은 정상 (cosmetic_wear 박지 X). "사용감 있음/많음/심함" 만 worn 신호.
  const noUseFeeling = /사용감\s*(?:(?:거의|전혀)\s*)?(?:적음|적은|없음|없|없는|매우\s*적|아주\s*적|덜|미세)/i.test(lower);
  const noCosmeticWear = /(?:기스|스크래치|찍힘|흠집).{0,16}(?:없|없음|없습니다|없어요|없이|아님|아닙니다|x)|(?:기스|스크래치|찍힘|흠집).{0,8}(?:및|과|와).{0,12}(?:파손|깨짐).{0,12}(?:없|없음|없습니다|없어요|없이|아님|아닙니다|x)/.test(lower);
  const hasUseFeeling = !noUseFeeling && /사용감/.test(lower);
  const explicitCosmeticWear = /(?:생활\s*)?(?:기스|스크래치|찍힘|흠집).{0,16}(?:있|있음|많|심|크|깊|약간|살짝|좀|나|보임|보여|보이는|보입니다|발견)|(?:있|있음|많|심|큰|깊은|약간|살짝|좀).{0,16}(?:기스|스크래치|찍힘|흠집)/.test(lower);
  const hasOtherWear = explicitCosmeticWear || (!noCosmeticWear && /기스|스크래치|찍힘|생활기스|흠집/.test(lower));
  if (hasUseFeeling || hasOtherWear) add("cosmetic_wear", -0.1);
  // 2026-05-17 (사용자 코멘트 id 146 pid 408047887): "하자는 채팅주시면 알려드리겠습니다 (없는수준)" false positive.
  // 셀러가 "하자 없음" 명시했는데 "하자" 단어만 잡고 flawed 분류 잘못. mitigator 추가 — 다른 negative 신호 (display/faceid/water 등) 와 같은 패턴.
  // 2026-05-17 (사용자 코멘트 id 148 pid 295882994): "거래 후 최초 원초적 하자(택배취급문제 등)를 제외하고는 환불 불가" 정상 거래 조건 표현이 flawed로 잘못 분류. negation 확장.
  // 2026-05-17 (사용자 코멘트 id 146/148 + Wave 159i 자율 사이클): 정상 매물이 repair_or_defect_signal로 잘못 분류되는 false positive 차단.
  // - "정품 배터리 교체" — 셀러가 공식 정품 배터리로 교체 = 정상 (수리 의미 아님)
  // - "잔상이나 화면 하자 없" — 부정형 정상 표현
  // - "전기능 이상없" / "기능 문제 없" — 정상 작동 명시
  const noRepairOrDefect = /\(\s*없는\s*수준\s*\)|하자.{0,20}(?:없|아닙|아님|x)|고장.{0,20}없|불량.{0,20}(?:없|없이)|파손.{0,20}(?:없|동의|면책)|깨짐.{0,20}없|문제.{0,20}(?:없|환불)|수리.{0,20}(?:없|이력\s*(?:당연히|전혀|아예)?\s*없|내역\s*(?:당연히|전혀|아예)?\s*없|한\s*적\s*없|x|안\s*함|안함)|교체.{0,20}(?:없|이력\s*없|한\s*적\s*없)|하자.{0,30}(?:제외|환불|책임\s*없)|원초적\s*하자|택배\s*취급(?:문제|상\s*문제)|택배취급문제|하자.{0,8}(?:있는\s*제품은\s*명시|있을\s*경우\s*환불|있는\s*경우)|하자나\s*오염\s*없|하자나\s*기스\s*없|하자\s*거의\s*없|하자\s*약간|하자\s*미세|심각한\s*하자\s*없|심각한\s*문제\s*없|정품\s*배터리\s*교체|정품배터리교체|(?:공식|애플\s*스토어|애플스토어|공식\s*센터|서비스\s*센터).{0,30}(?:배터리|키캡|키보드).{0,20}교체|배터리\s*(?:100\s*%|100%)\s*정품|잔상이나\s*(?:화면|디스플레이|액정)?\s*(?:하자|기스|손상).{0,8}없|잔상을\s*제외|잔상\s*제외|전\s*기능\s*(?:이상|문제)\s*없|전기능\s*(?:이상|문제)\s*없|기능\s*(?:상\s*)?(?:이상|문제)\s*(?:없|없는)|기능\s*문제\s*없|기능\s*정상|모든\s*기능\s*(?:정상|이상\s*없|문제\s*없)|(?:사설|부분|일부|자가)\s*수리\s*(?:내역|이력)?\s*(?:당연히|전혀|아예)?\s*(?:없|없음|없습니다|x|무|없이|절대\s*없이|안\s*함|안함)|(?:사설수리|부분수리|일부수리|자가수리)\s*(?:내역|이력)?\s*(?:당연히|전혀|아예)?\s*(?:없|없음|없습니다|x|무|없이|절대\s*없이|안\s*함|안함)|(?:시계줄|워치\s*줄|줄|스트랩|밴드).{0,28}(?:교체|길이\s*조정\s*불가|조정\s*불가)|(?:문제|기능\s*이상).{0,20}(?:교환|환불|기간|정책)|(?:고객\s*부주의|본인\s*과실|단순\s*변심|기능\s*문제가\s*아닌).{0,50}(?:파손|침수|충격|액정\s*나감|액정나감|꺼짐|멍).{0,50}(?:교환|환불|반품).{0,12}불가/.test(lower);
  if (!noRepairOrDefect && /수리|교체|하자|고장|불량|파손|깨짐/.test(defectRiskText)) add("repair_or_defect_signal", -0.2);
  if (batteryHealth != null && batteryHealth < 85) add("low_battery_health", -0.15);
  if (cycles != null && cycles > 500) add("high_battery_cycles", -0.1);

  // Wave 205 (2026-05-18): refurbished 분리 — 공식 리퍼 vs 사설/부분 수리.
  // 사용자 코멘트 #158 (pid 408779051): "DJI 오즈모 포켓3 리퍼 미개봉" → flawed 분류 (잘못).
  // 사용자 의문: "리퍼 ≠ 훼손". 공식 리퍼 = 박스 미개봉 + 1회 공식 수리 후 재판매 (정상 작동).
  // 기존: 리퍼/사설수리/부분수리 모두 refurbished_or_repaired (FLAWED) → flawed.
  // 근본 fix:
  //   - 공식 리퍼 (refurbished_factory) 신규 → FLAWED 아님 (정상 작동, 시세 sample 유지)
  //   - 사설/부분/일부/자가 수리 (refurbished_or_repaired) 유지 → FLAWED (실제 훼손 흔적)
  const notRefurbished = /리퍼\s*(?:제품\s*)?(?:아님|아닙니다|아닌|아니고|아니며)/.test(lower);
  const noUnofficialOrPartialRepair = /(?:사설|부분|일부|자가)\s*수리\s*(?:내역|이력)?\s*(?:당연히|전혀|아예)?\s*(?:없|없음|없습니다|x|무|없이|절대\s*없이|안\s*함|안함|한\s*적\s*없|한적\s*없)|(?:사설수리|부분수리|일부수리|자가수리)\s*(?:내역|이력)?\s*(?:당연히|전혀|아예)?\s*(?:없|없음|없습니다|x|무|없이|절대\s*없이|안\s*함|안함|한\s*적\s*없|한적\s*없)/.test(lower);
  const isUnofficialOrPartialRepair = !noUnofficialOrPartialRepair && /(?:사설|부분|일부|자가)\s*수리|사설수리|부분수리|일부수리|자가수리/.test(lower);
  const isFactoryRefurbished = !notRefurbished
    && !isUnofficialOrPartialRepair
    && /(?:공식|애플|삼성)\s*리퍼|리퍼\s*(?:폰|제품|미개봉|박스|교체품)|리퍼폰/.test(lower);
  if (isUnofficialOrPartialRepair) {
    add("refurbished_or_repaired", -0.15); // FLAWED — 사설/부분/자가 수리 (훼손 흔적)
  } else if (isFactoryRefurbished) {
    add("refurbished_factory", -0.03); // 공식 리퍼 — 정상 작동, FLAWED 아님
  }
  const noScreenRepair = noRepairOrDefect
    || /(?:수리|교체).{0,18}(?:없|없음|없습니다|무|x|안\s*함|안함)|(?:액정|디스플레이|화면).{0,18}(?:멀쩡|정상|깨끗)/.test(lower);
  if (!noScreenRepair && /(액정|디스플레이|화면).{0,16}(교체|수리)|(?:교체|수리).{0,16}(액정|디스플레이|화면)/.test(defectRiskText)) add("screen_replaced", -0.12);
  // Wave 159i (2026-05-17 자율 사이클): "잔상이나 화면하자 없어요" 같은 부정형 정상 표현 보강.
  const noDisplayDefect = /무잔상|잔상\s*(?:없|없음|없습니다|전혀\s*없|없이|양호|정상)|잔상을\s*제외|잔상\s*제외|백화.{0,24}(?:없|없음|없습니다|전혀\s*없|없이)|번인\s*(?:없|없음|없습니다)|(?:화면|디스플레이|액정|스크린).{0,18}(?:깨진\s*(?:곳|부분)|깨진\s*것|깨진거|하자|문제|불량|파손|기스|손상).{0,16}(?:없|없고|없음|없습니다|없이|아님|아니|필름)|(?:깨진\s*것|깨진거|깨짐|파손).{0,12}(?:필름).{0,16}(?:액정\s*x|액정\s*아님|액정\s*아니)|(?:화면|액정|디스플레이|스크린).{0,18}(?:깨짐|깨진\s*것|깨진거|파손).{0,24}(?:필름(?:이|만)?\s*(?:깨진|깨짐|금)|필름\s*붙)|(?:보호\s*)?(?:필름|강화\s*유리|유리\s*필름).{0,18}(?:깨진|깨짐|금).{0,24}(?:화면|액정|디스플레이|스크린).{0,12}(?:아니|아님|아닙)|(?:화면|액정|디스플레이|스크린).{0,12}깨진\s*거\s*처럼.{0,40}(?:없|없음|없습니다|아님|아니)|(?:화면|액정|디스플레이|스크린).{0,20}깨지거나.{0,20}(?:없|없음|없습니다)|(?:고객\s*부주의|본인\s*과실|기능\s*문제가\s*아닌).{0,50}(?:액정\s*나감|액정나감|꺼짐|멍).{0,50}(?:교환|환불|반품).{0,12}불가|(?:화면|디스플레이|액정|스크린).{0,12}(?:멀쩡|정상|깨끗).{0,30}(?:보호\s*)?(?:필름|강화\s*유리).{0,14}(?:깨짐|깨져|파손|크랙|기스|금)|잔상이나\s*(?:화면|디스플레이|액정)\s*(?:하자|기스|손상|문제).{0,8}없|잔상\s*,?\s*(?:파손|깨짐|기스|손상)\s*(?:,|및)?\s*(?:화면|디스플레이|액정)?\s*기스\s*없|잔상\s*,?\s*멍\s*없/.test(lower);
  if (!noDisplayDefect && /잔상|번인|burn\s*in|녹조|흑점|색\s*번짐|색번짐|(?:액정|화면|디스플레이|스크린).{0,18}멍|멍.{0,18}(?:액정|화면|디스플레이|스크린)|터치\s*불량|터치불량|액정\s*깨짐|화면\s*깨짐|디스플레이\s*깨짐|스크린\s*깨짐|액정\s*파손|화면\s*파손|디스플레이\s*파손|스크린\s*파손|노액|액정\s*나감|화면\s*나감|디스플레이\s*나감|화면\s*x|화면.{0,12}들어오지\s*않|화면.{0,12}안\s*들어/.test(lower)) add("display_defect", -0.25);
  // 2026-05-15 Wave 117: 부품용/수리용/셀러용 매물은 일반 사용자가 사면 손해 (정상 사용 불가). 풀 차단 + 시세 sample 제외.
  // 리셀 업자 lane 신설 시 별도 builder가 다시 살림 (POOL_BLOCK_NOTES 라인 코멘트 참조).
  if (/부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품|수리\s*용|수리용|셀러\s*용|셀러용|업자\s*용|업자용|보상\s*판매용|보상판매용/.test(lower)) add("parts_only", -0.4);
  const noFaceIdIssue = /(페이스\s*아이디|face\s*id|faceid).{0,30}(문제\s*(?:없|없음|없고|없습니다)|정상|잘\s*됨|작동)|기능에\s*아무\s*문제\s*없/.test(lower);
  if (!noFaceIdIssue && /(페이스\s*아이디|face\s*id|faceid).{0,20}(안됨|불가|고장|불량|문제|수리)|(?:안됨|불가|고장|불량|문제|수리).{0,20}(페이스\s*아이디|face\s*id|faceid)/.test(lower)) add("faceid_issue", -0.25);
  if (/(카메라|전면|후면).{0,20}(안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량)|(?:안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량).{0,20}(카메라|전면|후면)/.test(lower)) add("camera_issue", -0.2);
  const noCameraLensDamage = /(?:카메라|렌즈).{0,28}(?:기스|흠집|찍힘|깨짐|깨진|깨져|파손|크랙|금|멍|문제|이상|불량).{0,14}(?:없|없음|없습니다|없어요|없이|아님|아닙니다|x)|(?:카메라|렌즈).{0,18}(?:정상|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|작동)|무음)|카메라\s*보호\s*필름|카메라보호필름|렌즈\s*보호\s*필름|렌즈보호필름|카메라\s*섬\s*주변.{0,16}(?:생활\s*기스|기스\s*정도|미세\s*기스)/.test(lower);
  if (!noCameraLensDamage && /(?:카메라\s*(?:렌즈|유리|커버|보호\s*유리|보호유리)|카메라렌즈|렌즈\s*(?:유리|커버|부)?|렌즈부).{0,24}(?:깨졌|깨져|깨진|깨짐|깨져서|파손|크랙|금\s*갔|금\s*감|금이\s*갔|금이\s*감|큰\s*흠집|흠집\s*(?:크|심|깊)|찍힘\s*(?:크|심)|멍\s*\d*\s*개|멍\s*(?:있|있음|생|보))|(?:깨졌|깨져|깨진|깨짐|깨져서|파손|크랙|금\s*갔|금\s*감|금이\s*갔|금이\s*감|큰\s*흠집|흠집\s*(?:크|심|깊)|찍힘\s*(?:크|심)|멍\s*\d*\s*개|멍\s*(?:있|있음|생|보)).{0,24}(?:카메라\s*(?:렌즈|유리|커버|보호\s*유리|보호유리)|카메라렌즈|렌즈\s*(?:유리|커버|부)?|렌즈부)|(?:카메라|렌즈).{0,18}멍.{0,16}(?:있|있음|나|보|생|\d+\s*개)|(?:카메라|렌즈).{0,20}(?:커버|유리).{0,20}(?:크게|큰|심한|깊은).{0,12}(?:흠집|기스|찍힘)/.test(lower)) {
    add("camera_lens_damage", -0.25);
  }
  if (/(유심|sim).{0,20}(인식\s*불|인식불|안됨|불가|락)|(?:인식\s*불|인식불|안됨|불가|락).{0,20}(유심|sim)/.test(lower)) add("sim_or_carrier_issue", -0.2);
  const noWaterDamage = /침수(?:폰)?\s*(?:없|없음|없습니다|아님|일절\s*취급하지|취급하지\s*않|취급하지|취급\s*안)|침수.{0,12}(?:이력|내역).{0,12}(?:없|없음|없습니다|전혀\s*없)|(?:고객\s*부주의|본인\s*과실|단순\s*변심).{0,30}(?:파손|침수|충격).{0,30}(?:교환|환불|반품).{0,12}불가|침수\s*라벨\s*(?:정상|깨끗)/.test(lower);
  if (!noWaterDamage && /침수|물\s*들어|물먹|물\s*먹/.test(lower)) add("water_damage", -0.35);
  const noLostOrLocked = /분실\s*도난\s*침수폰?\s*일절\s*취급하지|분실.{0,8}도난.{0,20}(?:취급하지|취급\s*안)|분실\s*(?:없|없음|신고\s*없|취급하지)|도난\s*(?:없|없음|취급하지)|분실.{0,8}도난.{0,16}검수\s*완료|정상\s*해지|정상해지|(?:아이클라우드|icloud).{0,16}(?:로그아웃|해제).{0,16}(?:완료|됨)|초기화\s*완료/.test(lower);
  if (!noLostOrLocked && /분실|도난|락걸림|락\s*걸림|잠김|잠금|활성화\s*잠금|활성화.{0,18}(?:해제\s*안|해제가\s*안|해제\s*불가)|아이클라우드|icloud|초기화\s*불가|초기화불가/.test(lower)) add("locked_or_lost_signal", -0.4);
  if (/선약|선택\s*약정|확정\s*기변|확정기변|정상\s*해지|정상해지/.test(lower)) add("carrier_status_disclosed", 0.03);
  if (/(할부|미납|요금).{0,12}(남|있|미납)|(?:남은|잔여).{0,8}할부/.test(compact)) add("installment_risk", -0.25);

  // Wave 141 (2026-05-16): 정규식 보강 — 사용자 통찰로 발견된 새 패턴 5종.
  // sample 100건 학습 결과 정규식이 못 잡는 케이스 다수 발견.
  //
  // 1) display_defect 강화 — "흰점/흰 영역/데드픽셀" (옛 잔상/번인은 잡았으나 이거 미수집).
  //    예: "화면 흰 영역 생겼는데 터치는 문제 없음" → 셀러 우호 표현인데 실제는 flawed.
  const noWhitePixel = /(?:흰\s*점|흰\s*영역|흰\s*스팟|데드\s*픽셀|dead\s*pixel|황변)\s*(?:없|없음|없습니다|아님|아닙니다)/.test(lower);
  if (!noWhitePixel && /흰\s*점\s*(?:있|생|보|발견)|흰\s*영역|흰\s*스팟|데드\s*픽셀|dead\s*pixel|화면\s*황변|액정\s*황변/.test(lower)) {
    add("display_defect", -0.2);
  }

  // 2) damage signal — "강아지가 깨물/떨어뜨려/낙상/충격" (옛 침수만 잡음, 일반 손상 미수집).
  //    예: "강아지가 깨물어서 깨졌지만 정상작동" → flawed 명백한데 셀러는 정상 강조.
  // Wave 206 (2026-05-18): variant 보강.
  // 사용자 코멘트 #160 (pid 399177378 AirPods 4 ANC): "본체가 안닫히고 떨어트림 많음" → worn 분류 잘못.
  // 누락된 변형:
  //   - "떨어트림" (옛 "떨어뜨려" 만, "떨어트림 / 떨어트린" 변형 누락)
  //   - "본체 안 닫힘 / 안닫힘 / 닫히지 않음" closure 불량 (이어폰 케이스 등 명백한 flawed)
  const closureNegation = /(?:잘\s*닫|문제\s*없이\s*닫|정상\s*(?:으로\s*)?닫|닫(?:힘|함)\s*(?:정상|이상\s*없))/.test(lower);
  const closureDefect = !closureNegation && /(?:본체|뚜껑|덮개|커버|케이스).{0,8}(?:안\s*닫|안닫|닫히지\s*(?:않|안)|닫힘\s*불량|안\s*잠|안잠)/.test(lower);
  const dropImpactVariants = /떨어(?:뜨|트)림|떨어트(?:려|린)|툭\s*떨어|자주\s*떨어/.test(lower);
  if (/강아지\s*가?\s*(?:깨물|물어)|떨어뜨려\s*(?:깨|금|손상|파손)|떨어진\s*적|낙상|충격\s*받|박살|도장\s*까짐/.test(lower)
      || closureDefect || dropImpactVariants) {
    add("repair_or_defect_signal", -0.2);
  }

  // 3) mint signal 강화 — "사이클 N회 (N≤50)" 명시 추출.
  //    옛 cycles 인자가 있지만 description 안의 "사이클 21회" 같은 표현은 missed.
  //    예: "사이클 21회로 거의 새것" → mint 신호 강함.
  const cycleMatch = lower.match(/사이클\s*(?:수?\s*[:\s]*)?(\d{1,3})\s*회/);
  if (cycleMatch) {
    const cycleNum = Number(cycleMatch[1]);
    if (Number.isFinite(cycleNum)) {
      if (cycleNum <= 50) add("good_condition", 0.07); // 신선 매물 강한 신호
      else if (cycleNum > 500) add("high_battery_cycles", -0.05); // 추가 보강 (옛 cycles 인자 보완)
    }
  }

  // 4) flawed 강화 — "정상 작동" + "유리 깨짐/금/액정 깨짐" 동시 매칭.
  //    옛 패턴은 "깨짐 없음" negation은 잡지만, 셀러가 "깨졌지만 정상" 같이 양립 표현 미잡음.
  //    예: "앞유리 조금 금갔어요 근데 방수기능 됩니다" → 셀러 정상 강조, 실제 flawed.
  const visibleGlassBreakage = "(?:깨졌|깨져|깨진|깨짐|파손|크랙|금\\s*갔|금\\s*감|금이\\s*갔|금이\\s*감)";
  const visibleDamageWithFunctional = !noDisplayDefect
    && new RegExp(`(?:유리|액정|화면).{0,8}${visibleGlassBreakage}|크랙\\s*있|금\\s*갔|금\\s*있`).test(lower)
    && /(?:정상|이상\s*없|잘\s*됨|작동|기능)/.test(lower);
  if (visibleDamageWithFunctional) {
    add("display_defect", -0.15); // 셀러 우호 표현이라도 visible damage는 flawed로
  }

  // 5) worn signal — 셀러 우회 표현 "예민하지 않은 분께/케이스 끼면 안 보임".
  //    셀러가 "사용감"이라고 직접 안 적고 우회. 실제는 worn 매물.
  //    예: "찍힘, 눌림 있어요 외관에 예민하지 않은 분께 추천" → worn 우회 표현.
  if (/(?:예민하지\s*않은|민감하지\s*않은|꼼꼼하지\s*않은).{0,12}(?:분|사용자|구매자|유저)|케이스\s*끼면\s*(?:안\s*보|티\s*안)|필름\s*붙이면\s*(?:안\s*보|티\s*안)/.test(lower)) {
    add("cosmetic_wear", -0.05);
  }

  return {
    conditionScore: cap01(score),
    conditionNotes: [...new Set(notes)],
  };
}

// Wave 254.5 step 1+2+3 (2026-05-20): fashion-specific condition extraction.
//   사용자 정정 (root fix systemic 확장): 점진 rollout 폐기. fashion 3 카테고리 일괄 적용.
//   사용자 SQL 검증: shoe v7 1,575 / bag 1,705 / clothing 4,437 = 0% condition_notes 채움
//   vs earphone 80.9% / tablet 84.1% / smartphone 86.4% → fashion 전체 17,646건 0%.
//   8,191건 suspicious_high_grade (mint/clean/unopened 분류 + notes [] = 사용자 잘못 추천 가능).
//   효과 (3 카테고리 일괄):
//     - Wave 203~209 정책 자동 적용 (cosmetic_wear negation / objective signal override /
//       buying_post / single_side_only / accessory_compatible / repair_or_defect_signal negation).
//     - 신발 specific (솔 가루 / 가수분해 / 인솔 빠짐 / 굽창 마모 심함 / 밑창 분리).
//     - 가방 specific (내피 끈적/오염 / 가죽 까짐 / 손잡이 마모 / 코너 닳음 / 페인팅 벗겨짐).
//     - 의류 specific (보풀 / 색바램 / 늘어남 / 봉제 풀림 / 트임 / 인쇄 갈라짐).
//   사용자 매물 pid 408858108 가젤 볼드 케이스:
//     "새상품 + 약간 하자가있어" → 기존 parseConditionTier mint (a_grade) → 잘못.
//     fix 후: conditionFromText 의 repair_or_defect_signal 감지 → flawed.
export function conditionFromTextFashion(
  text: string,
  category: "shoe" | "bag" | "clothing",
): { conditionScore: number; conditionNotes: string[] } {
  // 1) Wave 203~209 canonical conditionFromText 호출.
  //    fashion 은 batteryHealth/cycles 없음 (null). category 인자는 earphone single_side_only 만 활성화
  //    되므로 fashion 카테고리는 null 로 passthrough.
  const base = conditionFromText(text, null, null, null);

  const lower = normalize(text).toLowerCase();
  let score = base.conditionScore;
  const notes = [...base.conditionNotes];
  const add = (note: string, delta: number) => {
    notes.push(note);
    score += delta;
  };

  // 2) shoe-specific signals — Wave 254.5 step 1.
  if (category === "shoe") {
    // 솔 가루 — 미드솔/아웃솔 부서짐 (가수분해 직전). flawed 명확.
    const noSoleCrumbling = /솔\s*가루\s*(?:없|없음|아님)/.test(lower);
    if (!noSoleCrumbling && /솔\s*가루|미드솔\s*가루|아웃솔\s*가루|솔\s*부서|미드솔\s*부서|솔\s*먼지\s*떨어/.test(lower)) {
      add("shoe_sole_crumbling", -0.25);
      // FLAWED 분류 보장 — extractConditionClass 가 shoe_sole_crumbling 모르므로 piggy-back.
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal"); // 점수 영향 없이 note 만
      }
    }
    // 가수분해 — parseConditionTier reject 이미 잡지만 conditionFromText 노트에도 박기 (UI 표시 + score).
    const noHydrolysis = /가수분해\s*(?:없|없음|아님)/.test(lower);
    if (!noHydrolysis && /가수분해|hydrolysis|밑창\s*가수|솔\s*가수/.test(lower)) {
      add("shoe_hydrolysis", -0.3);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
    // 인솔 빠짐/없음 — 시세 영향 (신발 본체는 멀쩡하지만 사용감 표시).
    if (/인솔\s*(?:빠|없\s*음|없\s*어|분실|떨어진)|깔창\s*(?:빠|없\s*음|없\s*어|분실|떨어진)/.test(lower)) {
      add("shoe_insole_missing", -0.15);
    }
    // 굽창/뒷굽 강한 마모 — c_grade (parseConditionTier) 보다 더 심함 (worn → flawed 경계).
    if (/굽창\s*마모\s*심|뒷굽\s*다\s*닳|뒷굽\s*완전\s*닳|굽\s*완전\s*마모|아웃솔\s*마모\s*심|밑창\s*완전\s*닳/.test(lower)) {
      add("shoe_heel_worn_severe", -0.15);
    }
    // 밑창 분리/벗겨짐 — parseConditionTier reject ("밑창 벗겨") 보강.
    if (/밑창\s*분리|밑창\s*벗겨|밑창\s*떨어진|솔\s*분리|솔\s*떨어진|본드로?\s*붙여/.test(lower)) {
      add("shoe_sole_separation", -0.25);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
  }

  // 3) bag-specific signals — Wave 254.5 step 2 (2026-05-20).
  //    사용자 list: 내피 끈적 / 가죽 까짐 / 손잡이 마모 / 코너 닳음 (+ 페인팅 벗겨짐).
  if (category === "bag") {
    // 내피 끈적/녹음/오염 — 가수분해 유사 (PU 내피 시간 지나면 끈적). flawed 명확.
    const noLiningSticky = /내피\s*(?:끈적|녹|오염|벗겨)\s*(?:없|없음|아님|깨끗)/.test(lower);
    if (!noLiningSticky && /내피\s*(?:끈적|끈쩍|녹았|녹음|벗겨|찢어|오염\s*심)|안감\s*(?:끈적|녹|벗겨|찢어)|라이닝\s*(?:끈적|녹|벗겨)/.test(lower)) {
      add("bag_lining_damage", -0.25);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
    // 가죽 까짐/벗겨짐/갈라짐 — 외관 손상. worn~flawed 경계.
    const noLeatherDamage = /가죽\s*(?:까짐|벗겨|갈라)\s*(?:없|없음|아님)/.test(lower);
    if (!noLeatherDamage && /가죽\s*(?:까짐|벗겨|갈라짐|찢어|크랙|박리)|레더\s*(?:까짐|벗겨|갈라|크랙)|코팅\s*(?:벗겨|박리|들뜸)/.test(lower)) {
      add("bag_leather_damage", -0.2);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
    // 손잡이 마모/끊어짐/늘어남.
    if (/손잡이\s*(?:마모|닳|끊어|늘어|찢어|벗겨|페인팅\s*벗)|핸들\s*(?:마모|닳|끊어|늘어)|스트랩\s*(?:끊어|찢어|벗겨)/.test(lower)) {
      add("bag_handle_worn", -0.15);
    }
    // 코너 닳음/벗겨짐 — 가방 모서리 일반 사용감.
    if (/모서리\s*(?:닳|벗겨|까짐|마모)|코너\s*(?:닳|벗겨|까짐|마모)|네\s*귀퉁이\s*(?:닳|벗겨)|네귀퉁이\s*(?:닳|벗겨)/.test(lower)) {
      add("bag_corner_worn", -0.1);
    }
    // 페인팅/도장 벗겨짐 — 명품 모서리 페인트 벗겨짐 흔함.
    if (/페인팅\s*(?:벗겨|박리|들뜸|날아)|도장\s*(?:벗겨|박리|들뜸)|페인트\s*(?:벗겨|박리)/.test(lower)) {
      add("bag_paint_peeling", -0.12);
    }
    // 곰팡이 — flawed 즉시 (LV/Chanel 빈티지 흔함).
    if (/곰팡이|mold|fungus/.test(lower)) {
      add("bag_mold", -0.3);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
  }

  // 4) clothing-specific signals — Wave 254.5 step 3 (2026-05-20).
  //    사용자 list: 보풀 / 색바램 / 늘어남 / 봉제 풀림 / 트임 (+ 인쇄 갈라짐).
  if (category === "clothing") {
    // 보풀 — 의류 일반 사용감 (니트/스웻 흔함).
    const noPilling = /보풀\s*(?:없|없음|아님|적|거의\s*없)/.test(lower);
    if (!noPilling && /보풀\s*(?:있|많|심)|보풀이?\s*(?:있|많|심)|필링/.test(lower)) {
      add("clothing_pilling", -0.1);
    }
    // 색바램/변색/탈색 — 자외선/세탁.
    const noFading = /색바램\s*(?:없|없음|아님)|변색\s*(?:없|없음|아님)/.test(lower);
    if (!noFading && /색\s*바램|색바램|탈색|변색|색\s*빠짐|색이?\s*빠|페이딩\s*심/.test(lower)) {
      add("clothing_fading", -0.15);
    }
    // 늘어남/처짐 — 니트/티 흔함.
    if (/늘어남|늘어진|넥\s*늘어|밑단\s*늘어|소매\s*늘어|핏\s*변형|처짐|쳐짐\s*있/.test(lower)) {
      add("clothing_stretched", -0.12);
    }
    // 봉제 풀림/터짐/뜯어짐 — 수선 필요.
    if (/봉제\s*(?:풀|터|뜯|벌어)|솔기\s*(?:풀|터|뜯|벌어)|박음질\s*(?:풀|터|뜯)|시접\s*(?:풀|터)/.test(lower)) {
      add("clothing_seam_damage", -0.15);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
    // 데미지/구멍/해짐/보강 필요 — 빈티지 의류에서 "상태 좋음"과 함께 적히는 수선 신호.
    const noStructuralDamage = /(?:데미지|구멍|찢어짐|찢김|해짐|보강)\s*(?:없|없음|아님|없습니다|없어요)/.test(lower);
    if (
      !noStructuralDamage &&
      /(?:작은\s*)?데미지\s*(?:있|있음|\d+|두\s*개|여러|조금|살짝)|구멍\s*(?:있|있음|\d+|작게|작은)|찢어(?:짐|졌|진)|찢김|해짐|헤짐|터짐|보강\s*(?:필요|해야|요망)|수선\s*(?:필요|해야|요망)/.test(lower)
    ) {
      add("clothing_structural_damage", -0.2);
      if (!notes.includes("repair_or_defect_signal")) {
        notes.push("repair_or_defect_signal");
      }
    }
    // 트임 — "찢어짐 변형" (트임을 의도된 디자인이 아닌 손상으로).
    // 단 negation: "트임 있는 디자인" / "사이드 트임" 같은 디자인 의도 패턴 차단.
    const isDesignSlit = /트임\s*(?:디자인|있는\s*디자인|사이드|밑단)|사이드\s*트임|밑단\s*트임/.test(lower);
    if (!isDesignSlit && /트임\s*(?:손상|찢|벌어|풀)|예상치\s*못한\s*트임/.test(lower)) {
      add("clothing_slit_damage", -0.12);
    }
    // 인쇄/프린팅 갈라짐 — 그래픽 티 흔함.
    if (/인쇄\s*(?:갈라|벗겨|박리)|프린팅\s*(?:갈라|벗겨|박리|찢어)|프린트\s*(?:갈라|벗겨|박리|찢어)|로고\s*(?:갈라|벗겨|박리)/.test(lower)) {
      add("clothing_print_cracked", -0.1);
    }
    // 얼룩 — clothing 만 (shoe 는 c_grade 의 얼룩 패턴 있음).
    const noStain = /얼룩\s*(?:없|없음|아님|깨끗|하나\s*없)/.test(lower);
    if (!noStain && /얼룩\s*(?:심|많|있|크)|얼룩이?\s*(?:심|많|있|크)|이염\s*심/.test(lower)) {
      add("clothing_stain", -0.12);
    }
  }

  return {
    conditionScore: cap01(score),
    conditionNotes: [...new Set(notes)],
  };
}

function comparableParts(input: {
  category: Sku["category"] | null;
  family: string | null;
  model: string | null;
  releaseYear: number | null;
  laptopModelNumber: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  connectivity: string | null;
  carrier: string | null;
  watchSizeMm: number | null;
  airpodsConnector: string | null;
  airpodsNoiseControl: string | null;
  monitorModelCode: string | null;
  monitorResolution: string | null;
  monitorRefreshRate: number | null;
  monitorPanelType: string | null;
  monitorShape: string | null;
  tabletGeneration?: number | null;
}) {
  const { category, family, model } = input;
  if (!category || !family || !model) return null;
  if (category === "smartphone") {
    return [family, model, input.storageGb ? `${input.storageGb}gb` : "unknown_storage"];
  }
  if (category === "tablet") {
    // Wave 90: comparable_key에 generation 추가. 기존엔 chip만으로 식별했는데
    // chip 추출 fail (1~4세대) 또는 chip 매핑 미존재 시 모든 세대가 한 그룹으로
    // 묶이는 시세 왜곡 발생 (사용자 코멘트로 발견 — iPad Pro 12.9 2세대가 신세대 시세 적용됨).
    // generation 추출되면 key에 박고, 안 되면 omit (기존 동작 유지로 풀 진입 영향 최소화).
    const chipAxis = tabletChipAxis(model, input.chip);
    const generation = input.tabletGeneration;
    return [
      family,
      model,
      ...(generation ? [`${generation}_gen`] : []),
      ...(chipAxis ? [chipAxis] : []),
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.storageGb ? `${input.storageGb}gb` : "unknown_storage",
      input.connectivity ?? "unknown_connectivity",
    ];
  }
  if (category === "laptop") {
    return [
      family,
      model,
      laptopGenerationKey(input.releaseYear, input.laptopModelNumber, input.chip) ?? "unknown_generation",
      input.chip ?? "unknown_chip",
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.ramGb ? `${input.ramGb}gb_ram` : "unknown_ram",
      input.ssdGb ? `${input.ssdGb}gb_ssd` : "unknown_ssd",
    ];
  }
  if (category === "smartwatch") {
    return [
      family,
      model,
      input.watchSizeMm ? `${input.watchSizeMm}mm` : "unknown_size",
      input.connectivity ?? "unknown_connectivity",
    ];
  }
  if (category === "earphone") {
    if (!model.includes("airpods")) {
      return [family, model];
    }
    // 2026-05-16: airpods_pro_2 통합 — connector token 안 박음 (Lightning/USB-C 시세 합쳐 정확도 ↑).
    const isAirpodsPro2 = model === "airpods_pro_2" || model.startsWith("airpods_pro_2_");
    if (isAirpodsPro2) {
      return [family, model];
    }
    const parts = [family, model, input.airpodsConnector ?? "unknown_connector"];
    if (model === "airpods_4") {
      parts.push(input.airpodsNoiseControl ?? "unknown_anc");
    }
    return parts;
  }
  if (category === "monitor") {
    return [
      family,
      model,
      input.screenSizeIn ? `${input.screenSizeIn}in` : "unknown_screen",
      input.monitorResolution ?? "unknown_resolution",
      input.monitorRefreshRate ? `${input.monitorRefreshRate}hz` : "unknown_refresh",
      input.monitorPanelType ?? "unknown_panel",
      input.monitorShape ?? "unknown_shape",
    ];
  }
  if (category === "speaker") {
    return [family, model, "portable_bluetooth_speaker"];
  }
  if (category === "camera") {
    return ["camera", family, model, "body_only", "no_lens"];
  }
  // Wave 90 v37: desktop comparable_key에 RAM/SSD 추가.
  // 사용자 코멘트로 발견 (pid 396321711 iMac M3 24"): 8GB/256GB 매물이 16GB/1TB 매물과
  // 한 그룹으로 묶여 시세 왜곡. comparable_key가 desktop|apple_imac_m3_24만 있어 옵션 무시됨.
  if (category === "desktop") {
    return [
      family,
      model,
      input.ramGb ? `${input.ramGb}gb_ram` : "unknown_ram",
      input.ssdGb ? `${input.ssdGb}gb_ssd` : "unknown_ssd",
    ];
  }
  // Wave 67/68: 시계 + 골프 narrow lane.
  // 모델 코드가 catalog mustContain[0]에서 strict 매칭 (DW-5600/GA-2100/SRPD/TSR3 등).
  // 색상/무브먼트/플렉스/로프트는 동일 모델 내 시세 영향 작음 → 추가 axis 불필요.
  // 차후 사업 결정 시 로프트/플렉스 sub-lane 분리 가능 (sport_golf).
  if (category === "watch") {
    return [family, model];
  }
  if (category === "sport_golf") {
    return [family, model];
  }
  return [family, model];
}

function confidence(input: {
  category: Sku["category"] | null;
  model: string | null;
  releaseYear: number | null;
  laptopModelNumber: string | null;
  storageGb: number | null;
  ramGb: number | null;
  ssdGb: number | null;
  screenSizeIn: number | null;
  chip: string | null;
  connectivity: string | null;
  carrier: string | null;
  watchSizeMm: number | null;
  airpodsConnector: string | null;
  airpodsNoiseControl: string | null;
  airpodsMaxGeneration: string | null;
  monitorModelCode: string | null;
  monitorResolution: string | null;
  monitorRefreshRate: number | null;
  monitorPanelType: string | null;
  monitorShape: string | null;
  batteryHealth: number | null;
  batteryCycles: number | null;
}) {
  if (!input.category || !input.model) return 0.2;
  let score = 0.45;
  if (input.category === "smartphone") {
    if (input.storageGb) score += 0.3;
    if (input.batteryHealth || input.batteryCycles) score += 0.1;
    if (input.connectivity || input.carrier) score += 0.05;
  } else if (input.category === "tablet") {
    if (input.screenSizeIn) score += 0.12;
    if (input.storageGb) score += 0.23;
    if (input.connectivity) score += 0.12;
    if (input.batteryHealth || input.batteryCycles) score += 0.05;
  } else if (input.category === "laptop") {
    if (input.releaseYear || input.laptopModelNumber) score += 0.12;
    if (input.chip) score += 0.18;
    if (input.screenSizeIn) score += 0.14;
    if (input.ramGb) score += 0.14;
    if (input.ssdGb) score += 0.14;
    if (input.batteryCycles) score += 0.05;
  } else if (input.category === "smartwatch") {
    if (input.watchSizeMm) score += 0.25;
    if (input.connectivity) score += 0.12;
    else score += 0.05;
    if (input.batteryHealth) score += 0.05;
  } else if (input.category === "earphone") {
    if (input.model?.includes("airpods")) {
      score += input.airpodsConnector ? 0.25 : 0.12;
      if (input.model === "airpods_4") score += input.airpodsNoiseControl && input.airpodsNoiseControl !== "unknown_anc" ? 0.18 : -0.08;
      if (input.model.includes("airpods_max")) score += input.airpodsMaxGeneration && input.airpodsMaxGeneration !== "unknown_generation" ? 0.05 : -0.1;
    } else {
      score += 0.35;
    }
  } else if (input.category === "monitor") {
    if (input.monitorModelCode) score += 0.18;
    if (input.screenSizeIn) score += 0.12;
    if (input.monitorResolution) score += 0.12;
    if (input.monitorRefreshRate) score += 0.12;
    if (input.monitorPanelType) score += 0.06;
    if (input.monitorShape) score += 0.03;
  } else if (input.category === "speaker") {
    score += 0.35;
  } else if (input.category === "camera") {
    score += 0.35;
  } else if (input.category === "game_console") {
    score += 0.35;
  } else if (input.category === "desktop") {
    // Wave 17: desktop narrow lane (Mac mini M2 등). catalog ruleMatch + mustNotContain로
    // 변형/세대 분리하므로 catalog hit만으로 신뢰. speaker/camera/game_console과 동일 +0.35.
    score += 0.35;
  } else if (input.category === "home_appliance") {
    // Wave 19: home_appliance narrow lane (Dyson V12 등). catalog ruleMatch + mustNotContain로
    // V10/V11/V15 등 다른 모델 분리. desktop과 동일 +0.35.
    score += 0.35;
  } else if (input.category === "watch" || input.category === "sport_golf") {
    // Wave 67/68: 시계/골프 narrow lane. catalog mustContain strict (모델 코드 + WATCH_NOISE/GOLF_DRIVER_NOISE)
    // 로 변형 격리. 모델 매칭 = 신뢰. camera/speaker/desktop/home_appliance와 동일 +0.35.
    score += 0.35;
  } else if (input.category === "drone") {
    // Wave 184 (2026-05-17): 새 카테고리 drone (DJI/GoPro). catalog narrow lane 으로
    // 변형 격리 (Fly More Combo 등). 모델 매칭 = 신뢰. 단일 옵션 모델 다수.
    score += 0.35;
  } else if (input.category === "perfume") {
    // Wave 185 (2026-05-17): 새 카테고리 perfume. catalog narrow lane (브랜드 + 향 + 용량) 으로 정확.
    score += 0.35;
  } else if (input.category === "kickboard") {
    // Wave 186 (2026-05-18): 새 카테고리 kickboard (전동킥보드/스쿠터). 한국 인기 — 샤오미 Mi Scooter / 세그웨이 닌봇.
    score += 0.35;
  } else if (input.category === "lego") {
    // Wave 188 (2026-05-18): 새 카테고리 lego (한정판 / UCS / 모듈러). 세트 번호로 고유 식별.
    score += 0.35;
  }
  return cap01(score);
}

function criticalUnknowns(category: Sku["category"] | null, comparableKey: string | null) {
  const parts = comparableKey?.split("|").filter((part) => part.startsWith("unknown_")) ?? [];
  if (parts.length === 0) return [];
  if (category === "smartphone") {
    return parts.filter((part) => part === "unknown_storage");
  }
  if (category === "tablet") {
    return parts.filter((part) => ["unknown_chip", "unknown_screen", "unknown_storage", "unknown_connectivity"].includes(part));
  }
  if (category === "laptop") {
    return parts.filter((part) => ["unknown_generation", "unknown_chip", "unknown_ram", "unknown_ssd"].includes(part));
  }
  if (category === "smartwatch") {
    return parts.filter((part) => part === "unknown_size");
  }
  if (category === "earphone") {
    return parts.filter((part) => part === "unknown_connector" || part === "unknown_anc");
  }
  if (category === "monitor") {
    return parts.filter((part) => ["unknown_screen", "unknown_resolution", "unknown_refresh"].includes(part));
  }
  return parts;
}

export function parseListingOptions(input: ParseInput): ParsedListingOptions {
  const category0 = input.category ?? null;
  // Wave 92: shoe/bag/bike는 별도 모듈로 dispatch.
  // Wave 216 (2026-05-19): clothing 도 dispatch — 의류 사이즈 무관, condition tier 만 추출.
  if (category0 === "shoe" || category0 === "bag" || category0 === "bike" || category0 === "clothing") {
    return parseFashionMobility(input);
  }
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = `${title}\n${description.slice(0, 1200)}`;
  const category = input.category ?? null;
  const monitorBrand = category === "monitor" ? (parseMonitorBrand(title) ?? parseMonitorBrand(text)) : null;
  const monitorModelCode = category === "monitor" ? (parseMonitorModelCode(title) ?? parseMonitorModelCode(text)) : null;
  const monitorModelHint = monitorModelCode ? (MONITOR_MODEL_HINTS[monitorModelCode] ?? null) : null;
  let model = category === "monitor" ? (monitorModelCode ?? "generic_monitor") : modelFromSku(input.skuId, input.skuName);
  const family = familyFrom(category, model);
  const storageGb = parseStorageGb(title, category) ?? parseLooseDeviceStorageGb(title, category) ?? parseStorageGb(text, category);
  const titleMemory = parseRamAndSsd(title, category);
  const combinedMemory = parseRamAndSsd(text, category);
  const parsedRamGb = titleMemory.ramGb ?? combinedMemory.ramGb;
  const parsedSsdGb = titleMemory.ssdGb ?? combinedMemory.ssdGb;
  const laptopModelNumber = category === "laptop"
    ? (parseAppleLaptopModelNumber(title) ?? parseAppleLaptopModelNumber(text) ?? parseLgGramModelNumber(title) ?? parseLgGramModelNumber(text))
    : null;
  const laptopModelHint = laptopModelNumber ? (APPLE_LAPTOP_MODEL_HINTS[laptopModelNumber] ?? LG_GRAM_MODEL_HINTS[laptopModelNumber] ?? null) : null;
  const parsedReleaseYear = category === "laptop"
    ? (parseLaptopReleaseYear(title) ?? parseLaptopReleaseYear(text))
    : null;
  // releaseYear는 chip + screen 결정 후 재할당 (appleChipToReleaseYear fallback 포함)
  let releaseYear = category === "laptop"
    ? (parsedReleaseYear ?? laptopModelHint?.releaseYear ?? null)
    : null;
  const parsedScreenSizeIn = category === "laptop"
    ? (parseLaptopScreenSizeIn(title) ?? parseLaptopScreenSizeIn(text))
    : category === "tablet"
      ? (parseTabletScreenSizeIn(title, model) ?? parseTabletScreenSizeIn(text, model))
    : category === "monitor"
      ? (parseMonitorScreenSizeIn(title) ?? parseMonitorScreenSizeIn(text))
    : (parseScreenSizeIn(title) ?? parseScreenSizeIn(text));
  const screenSizeIn = parsedScreenSizeIn
    ?? (category === "laptop" ? (laptopModelHint?.screenSizeIn ?? null) : null)
    ?? (category === "monitor" ? (monitorModelHint?.screenSizeIn ?? null) : null)
    ?? (category === "monitor" ? parseMonitorScreenSizeFromModelCode(monitorModelCode) : null)
    ?? (category === "laptop" && model === "macbook_air" ? 13 : null)
    ?? (category === "tablet" ? defaultTabletScreenSizeIn(model) : null);
  const watchSizeMm = parseWatchSizeMm(text) ?? defaultWatchSizeMm(model);
  const explicitChip = parseChip(title) ?? parseChip(text);
  const chip = explicitChip
    ?? (category === "tablet" ? parseTabletGenerationChip(text, model, screenSizeIn) : null)
    ?? (category === "laptop" ? (parseLgGramChipFromModelNumber(text) ?? laptopModelHint?.chip ?? null) : null);
  const laptopMemoryDefault = defaultLaptopMemory(category, model, chip, screenSizeIn, text);
  const ramGb = parsedRamGb ?? laptopMemoryDefault.ramGb;
  const ssdGb = parsedSsdGb ?? laptopMemoryDefault.ssdGb;
  // v33+: releaseYear chip-based fallback (deterministic (model, chip, screen) tuples).
  if (releaseYear == null && category === "laptop") {
    releaseYear = appleChipToReleaseYear(family, model, chip, screenSizeIn);
  }
  const batteryHealth = parseBatteryHealth(text);
  const batteryCycles = parseBatteryCycles(text);
  const connectivity = parseConnectivity(title) ?? parseConnectivity(description) ?? defaultConnectivity(model) ?? (category === "tablet" ? "wifi" : null);
  const carrier = parseCarrier(text);
  const airpodsConnector = category === "earphone"
    ? (parseAirpodsConnector(title) ?? parseAirpodsConnector(description) ?? defaultAirpodsConnector(model, text))
    : null;
  const airpodsNoiseControl = category === "earphone" ? parseAirpodsNoiseControl(model, text) : null;
  // Wave 91: parser evidence overrides catalog classification.
  // 사용자 코멘트로 발견 (pid 408077307 "에어팟4세대(노캔X)"): catalog가 "노캔" 토큰만 보고
  // airpods-4-anc로 분류했지만, parser는 정확히 "노캔X" = no_anc로 인식. catalog 분류 정정.
  if (model === "airpods_4_anc" && airpodsNoiseControl === "no_anc") {
    model = "airpods_4";
  }
  const airpodsMaxGeneration = category === "earphone" ? parseAirpodsMaxGeneration(model, text) : null;
  const airpodsMaxFullProductContext =
    category === "earphone" && model?.includes("airpods_max")
      ? hasAirpodsMaxFullProductContext(text)
      : false;
  const monitorResolution = category === "monitor"
    ? (parseMonitorResolution(title) ?? parseMonitorResolution(text) ?? monitorModelHint?.monitorResolution ?? null)
    : null;
  const monitorRefreshRate = category === "monitor"
    ? (parseMonitorRefreshRate(title) ?? parseMonitorRefreshRate(text) ?? monitorModelHint?.monitorRefreshRate ?? null)
    : null;
  const monitorPanelType = category === "monitor"
    ? (parseMonitorPanelType(title) ?? parseMonitorPanelType(text) ?? monitorModelHint?.monitorPanelType ?? null)
    : null;
  const monitorShape = category === "monitor"
    ? (parseMonitorShape(title) ?? parseMonitorShape(text) ?? monitorModelHint?.monitorShape ?? null)
    : null;
  const conditionResult = conditionFromText(text, batteryHealth, batteryCycles, category);
  let conditionScore = conditionResult.conditionScore;
  const conditionNotes = [...conditionResult.conditionNotes];
  const earphoneConditionEvidence = category === "earphone"
    ? parseEarphoneConditionEvidence({ title, description })
    : null;
  if (earphoneConditionEvidence) {
    const addEarphoneGateNotes = (notes: string[], delta = -0.35) => {
      let added = false;
      for (const note of notes) {
        if (!conditionNotes.includes(note)) {
          conditionNotes.push(note);
          added = true;
        }
      }
      if (added) conditionScore += delta;
    };
    const hardSignalNoteMap: Partial<Record<string, string[]>> = {
      single_side_unit: ["single_side_only", "earphone_single_side_unit"],
      charging_case_only: ["parts_only", "earphone_case_only"],
      protective_case_only: ["accessory_compatible_for_other_product", "earphone_case_only"],
      audio_output_issue: ["repair_or_defect_signal", "earphone_audio_issue"],
      anc_or_transparency_issue: ["repair_or_defect_signal", "earphone_anc_issue"],
      mic_issue: ["repair_or_defect_signal", "earphone_mic_issue"],
      pairing_or_connection_issue: ["repair_or_defect_signal", "earphone_pairing_issue"],
      battery_degraded: ["repair_or_defect_signal", "earphone_battery_issue"],
      physical_damage: ["repair_or_defect_signal", "earphone_physical_damage"],
    };
    for (const signal of earphoneConditionEvidence.hardBlockCandidates) {
      const notes = hardSignalNoteMap[signal];
      if (notes) addEarphoneGateNotes(notes);
    }
    const warningSignalNoteMap: Partial<Record<string, string[]>> = {
      missing_parts: ["earphone_missing_parts"],
      hygiene_or_stain: ["earphone_hygiene_warning"],
    };
    for (const signal of earphoneConditionEvidence.warningSignals) {
      const notes = warningSignalNoteMap[signal];
      if (notes) addEarphoneGateNotes(notes, -0.06);
    }
  }
  const techDeviceConditionEvidence = category === "smartphone" || category === "tablet" || category === "smartwatch" || category === "laptop"
    ? parseTechDeviceConditionEvidence({ title, description })
    : null;
  if (techDeviceConditionEvidence) {
    const hardSignals = new Set(techDeviceConditionEvidence.hardBlockCandidates);
    const addTechGateNote = (note: string, delta = -0.35) => {
      if (!conditionNotes.includes(note)) conditionNotes.push(note);
      conditionScore += delta;
    };
    const hardSignalNoteMap: Record<string, string> = {
      display_panel_issue: "display_defect",
      body_or_back_glass_damage: "device_body_damage",
      foldable_hinge_or_inner_damage: "foldable_hinge_damage",
      touch_issue: "display_defect",
      screen_replaced_or_repaired: "screen_replaced",
      faceid_or_biometric_issue: "faceid_issue",
      camera_issue: "camera_issue",
      camera_lens_or_glass_damage: "camera_lens_damage",
      speaker_or_mic_issue: "repair_or_defect_signal",
      charging_or_sensor_issue: "device_charging_or_sensor_issue",
      account_or_activation_lock: "locked_or_lost_signal",
      carrier_or_finance_risk: "sim_or_carrier_issue",
      water_damage: "water_damage",
      parts_or_repair_only: "parts_only",
      unofficial_or_partial_repair: "refurbished_or_repaired",
    };
    for (const signal of hardSignals) {
      const note = hardSignalNoteMap[signal];
      if (note) addTechGateNote(note);
    }
    const warningSignalNoteMap: Record<string, string> = {
      battery_service_needed: "low_battery_health",
      low_battery_health: "low_battery_health",
      high_battery_cycles: "high_battery_cycles",
    };
    for (const signal of techDeviceConditionEvidence.warningSignals) {
      const note = warningSignalNoteMap[signal];
      if (note && !conditionNotes.includes(note)) {
        conditionNotes.push(note);
        conditionScore += -0.08;
      }
    }
  }
  const tabletBundlePriceReview = category === "tablet" && hasTabletBundlePriceReview(text);
  // Wave 90: tablet generation을 comparableParts에 전달 (세대별 시세 분리)
  const tabletGeneration = category === "tablet" ? parseTabletGeneration(text, model) : null;

  // Wave 182 Phase 3 (2026-05-17): base option fallback.
  // SKU 가 sku-base-options.ts 에 등록되어 있고 매물 텍스트에 옵션 명시 X 면 가장 낮은 옵션 가정.
  // 안전성 (§12b): base 옵션 = 가장 낮은 옵션 → 시세 underestimate → priceGap 보수적 → false positive 0.
  // recall loss 만 발생 (진짜 고옵션 매물이 base 시세로 비교돼 안 추천) — OK.
  const baseOpts = baseOptionsFor(input.skuId);
  const optionBaseAssumed: string[] = [];
  const finalStorageGb = (() => {
    if (storageGb != null) return storageGb;
    if (baseOpts?.storageGb != null) { optionBaseAssumed.push("storage"); return baseOpts.storageGb; }
    return null;
  })();
  const finalRamGb = (() => {
    if (ramGb != null) return ramGb;
    if (baseOpts?.ramGb != null) { optionBaseAssumed.push("ram"); return baseOpts.ramGb; }
    return null;
  })();
  const finalSsdGb = (() => {
    if (ssdGb != null) return ssdGb;
    if (baseOpts?.ssdGb != null) { optionBaseAssumed.push("ssd"); return baseOpts.ssdGb; }
    return null;
  })();
  const finalWatchSizeMm = (() => {
    if (watchSizeMm != null) return watchSizeMm;
    if (baseOpts?.watchSizeMm != null) { optionBaseAssumed.push("watch_size"); return baseOpts.watchSizeMm; }
    return null;
  })();
  const finalConnectivity = (() => {
    if (connectivity != null) return connectivity;
    if (baseOpts?.connectivity != null) { optionBaseAssumed.push("connectivity"); return baseOpts.connectivity; }
    return null;
  })();
  const finalCarrier = (() => {
    if (carrier != null) return carrier;
    if (baseOpts?.carrier != null) { optionBaseAssumed.push("carrier"); return baseOpts.carrier; }
    return null;
  })();

  // Wave 774 (2026-05-24): sport_golf loft 추출 — 사용자 #10 발견 "TSR2 9도 vs 11도 같은 SKU 묶임".
  // Wave 775 (2026-05-24): Wave 760 sweep 결과 활용 — shaft 추출 추가 (Honma Beres 10도 81K vs 10.5도 690K = 8.5x).
  //   sweep audit: TourAD / Speeder / Ventus / Diamana premium shaft median 1.5-2x.
  //   적용: driver/wood/hybrid loft + driver/iron/wedge/wood shaft.
  //   parsedJson.golf_loft / golf_shaft 에 박음 + comparable_key 추가.
  let golfLoftKey: string | null = null;
  let golfLoftValue: string | null = null;
  let golfShaftKey: string | null = null;
  let golfShaftValue: string | null = null;
  let golfSexKey: string | null = null;
  let golfSexValue: string | null = null;
  let golfIronSetKey: string | null = null;
  let golfIronSetValue: string | null = null;
  if (category === "sport_golf") {
    const golfText = `${input.title ?? ""}\n${input.description ?? ""}`.toLowerCase();
    // loft (driver/wood/hybrid) — text 또는 SKU id 에 driver context 있으면 추출.
    const driverLoftMatch = golfText.match(/(?:^|[^0-9])(\d{1,2}(?:\.\d)?)\s*(?:도(?![가-힣])|°|deg)/i);
    const driverContextText = /(드라이버|driver|우드|wood|하이브리드|hybrid|유틸리티|utility)/i.test(golfText);
    const driverContextSku = /(_driver|_wood|_hybrid|-driver|-wood|-hybrid)/i.test(input.skuId ?? "");
    const driverContext = driverContextText || driverContextSku;
    if (driverLoftMatch && driverContext) {
      const loftNum = Number(driverLoftMatch[1]);
      if (Number.isFinite(loftNum) && loftNum >= 7 && loftNum <= 32) {
        golfLoftValue = String(loftNum);
        golfLoftKey = `loft_${loftNum.toString().replace(".", "_")}`;
      }
    }
    // shaft (Wave 760 sweep 결과 기반)
    // Premium shaft: TourAD (가장 비쌈), Ventus, Speeder, Diamana, Fujikura, Atlas
    // 일반: Graphite (그라파이트, 카본) / Steel (스틸) / LightSteel (라이트 스틸, NS Pro 등)
    if (/tour\s*ad|투어\s*ad|tour\s*-?ad/i.test(golfText)) {
      golfShaftValue = "TourAD"; golfShaftKey = "shaft_tourad";
    } else if (/ventus/i.test(golfText)) {
      golfShaftValue = "Ventus"; golfShaftKey = "shaft_ventus";
    } else if (/speeder/i.test(golfText)) {
      golfShaftValue = "Speeder"; golfShaftKey = "shaft_speeder";
    } else if (/diamana|디아마나/i.test(golfText)) {
      golfShaftValue = "Diamana"; golfShaftKey = "shaft_diamana";
    } else if (/fujikura|후지쿠라/i.test(golfText)) {
      golfShaftValue = "Fujikura"; golfShaftKey = "shaft_fujikura";
    } else if (/atlas|아틀라스/i.test(golfText)) {
      golfShaftValue = "Atlas"; golfShaftKey = "shaft_atlas";
    } else if (/tsp\d+/i.test(golfText)) {
      const tspMatch = golfText.match(/tsp(\d+)/i);
      golfShaftValue = `TSP${tspMatch?.[1] ?? ""}`;
      golfShaftKey = `shaft_tsp${tspMatch?.[1] ?? ""}`;
    } else if (/그라파이트|graphite|카본\s*샤프트|carbon\s*shaft/i.test(golfText)) {
      golfShaftValue = "Graphite"; golfShaftKey = "shaft_graphite";
    } else if (/ns\s*pro|n\.s\.pro|라이트\s*스틸|light\s*steel/i.test(golfText)) {
      golfShaftValue = "LightSteel"; golfShaftKey = "shaft_lightsteel";
    } else if (/스틸\s*샤프트|steel\s*shaft|dg\s*[a-z0-9]+|dynamic\s*gold/i.test(golfText)) {
      golfShaftValue = "Steel"; golfShaftKey = "shaft_steel";
    }
    // Wave 776 (2026-05-24): Sex 추출 — Wave 760 sweep "Majesty wood Men 840K vs Women 150K (5.6배)".
    // 명시 없으면 default (men) — 매물 대부분 남성용.
    if (/여성용|여성\s*골프|여성\s*드라이버|여성\s*아이언|여자\s*골프|레이디|lady|women|woman|wmn/i.test(golfText)) {
      golfSexValue = "women"; golfSexKey = "sex_women";
    } else if (/남성용|남자\s*골프|men's|men\b|시니어\s*남성/i.test(golfText)) {
      golfSexValue = "men"; golfSexKey = "sex_men";
    }
    // Wave 776: Iron set 구성 추출 — 풀세트 (5번~PW) vs 하프세트 (7번~PW) vs 스타터.
    //   풀세트 ~9 클럽 / 하프 ~6 클럽 / 스타터 ~4-5 클럽. 시세 영향 큼.
    if (/iron|아이언/i.test(golfText)) {
      if (/5번?\s*[-~]\s*pw|5\s*-\s*p|5\s*~\s*p|5번?\s*[-~]\s*aw|풀\s*세트|풀세트/i.test(golfText)) {
        golfIronSetValue = "full"; golfIronSetKey = "set_full";
      } else if (/7번?\s*[-~]\s*pw|7\s*-\s*p|7\s*~\s*p|하프\s*세트|하프세트|half\s*set/i.test(golfText)) {
        golfIronSetValue = "half"; golfIronSetKey = "set_half";
      } else if (/스타터|starter|입문/i.test(golfText)) {
        golfIronSetValue = "starter"; golfIronSetKey = "set_starter";
      }
    }
  }

  // Wave 777 (2026-05-24): sport_golf generation 추출 — sub-model 안 generation 분리.
  //   Honma Beres NX / Beres BB / Beres B-PLUS / Beres S — broad SKU 안에서 generation 별 시세 다름.
  //   Ping G410 / G425 / G430 — 신/구세대 시세 차이.
  //   PXG 0311 GEN1-6 — 세대별 가격대 다름.
  //   사용자 #13 정당한 지적 — broad SKU 안 generation 별 시세 분리해야 정밀 측정 가능.
  let golfGenerationKey: string | null = null;
  let golfGenerationValue: string | null = null;
  if (category === "sport_golf") {
    const golfText = `${input.title ?? ""}\n${input.description ?? ""}`.toLowerCase();
    // Honma Beres 세대: NX (구), BB (신), B-PLUS, S (시니어)
    if (/베레스|beres/i.test(golfText)) {
      if (/beres\s*nx|베레스\s*nx/i.test(golfText)) { golfGenerationValue = "Beres_NX"; golfGenerationKey = "gen_beres_nx"; }
      else if (/beres\s*bb|베레스\s*bb/i.test(golfText)) { golfGenerationValue = "Beres_BB"; golfGenerationKey = "gen_beres_bb"; }
      else if (/beres\s*b[- ]?plus|베레스\s*b[- ]?plus/i.test(golfText)) { golfGenerationValue = "Beres_BPLUS"; golfGenerationKey = "gen_beres_bplus"; }
      else if (/beres\s*s\b|베레스\s*s\b/i.test(golfText)) { golfGenerationValue = "Beres_S"; golfGenerationKey = "gen_beres_s"; }
    }
    // Ping G 시리즈: G410 (2019), G425 (2021), G430 (2023)
    if (!golfGenerationKey && /\bping\b|핑\s/i.test(golfText)) {
      const pingGen = golfText.match(/g\s*(400|410|425|430)/i);
      if (pingGen) { golfGenerationValue = `Ping_G${pingGen[1]}`; golfGenerationKey = `gen_ping_g${pingGen[1]}`; }
    }
    // PXG 0311 GEN
    if (!golfGenerationKey && /pxg|0311/i.test(golfText)) {
      const pxgGen = golfText.match(/gen\s*(1|2|3|4|5|6)|0311\s*(?:t|p|sgi|xf)?\s*gen\s*(1|2|3|4|5|6)/i);
      if (pxgGen) {
        const g = pxgGen[1] || pxgGen[2];
        golfGenerationValue = `PXG_GEN${g}`; golfGenerationKey = `gen_pxg_gen${g}`;
      }
    }
    // TaylorMade: SIM / SIM2 / Stealth / Stealth2 / Qi10 (catalog narrow 있지만 broad 안에서도)
    if (!golfGenerationKey && /테일러메이드|taylormade/i.test(golfText)) {
      if (/qi10/i.test(golfText)) { golfGenerationValue = "TM_Qi10"; golfGenerationKey = "gen_tm_qi10"; }
      else if (/stealth\s*2|스텔스\s*2/i.test(golfText)) { golfGenerationValue = "TM_Stealth2"; golfGenerationKey = "gen_tm_stealth2"; }
      else if (/stealth|스텔스/i.test(golfText)) { golfGenerationValue = "TM_Stealth"; golfGenerationKey = "gen_tm_stealth"; }
      else if (/sim\s*2|sim2/i.test(golfText)) { golfGenerationValue = "TM_SIM2"; golfGenerationKey = "gen_tm_sim2"; }
      else if (/sim\b/i.test(golfText)) { golfGenerationValue = "TM_SIM"; golfGenerationKey = "gen_tm_sim"; }
    }
    // Titleist: TS / TSi / TSR / GT (각각 신구 세대)
    if (!golfGenerationKey && /타이틀리스트|titleist/i.test(golfText)) {
      if (/gt[23]?\b/i.test(golfText)) { golfGenerationValue = "Titleist_GT"; golfGenerationKey = "gen_titleist_gt"; }
      else if (/tsr[23]?\b/i.test(golfText)) { golfGenerationValue = "Titleist_TSR"; golfGenerationKey = "gen_titleist_tsr"; }
      else if (/tsi[23]?\b/i.test(golfText)) { golfGenerationValue = "Titleist_TSi"; golfGenerationKey = "gen_titleist_tsi"; }
      else if (/ts[1-4]?\b/i.test(golfText)) { golfGenerationValue = "Titleist_TS"; golfGenerationKey = "gen_titleist_ts"; }
    }
    // XXIO: 9/10/11 (구세대) vs 12/13 (신세대) — Wave 760 narrow 분리 있음
    if (!golfGenerationKey && /xxio|젝시오/i.test(golfText)) {
      const xxioGen = golfText.match(/xxio\s*(9|10|11|12|13)|젝시오\s*(9|10|11|12|13)/i);
      if (xxioGen) {
        const g = xxioGen[1] || xxioGen[2];
        golfGenerationValue = `XXIO_${g}`; golfGenerationKey = `gen_xxio_${g}`;
      }
    }
  }

  const parts = comparableParts({
    category,
    family,
    model,
    releaseYear,
    laptopModelNumber,
    storageGb: finalStorageGb,
    ramGb: finalRamGb,
    ssdGb: finalSsdGb,
    screenSizeIn,
    chip,
    connectivity: finalConnectivity,
    carrier: finalCarrier,
    watchSizeMm: finalWatchSizeMm,
    airpodsConnector,
    airpodsNoiseControl,
    monitorModelCode,
    monitorResolution,
    monitorRefreshRate,
    monitorPanelType,
    monitorShape,
    tabletGeneration,
  });
  // Wave 774/775/776/777: sport_golf loft + shaft + sex + iron_set + generation comparable_key.
  let partsWithGolf = parts;
  if (partsWithGolf) {
    if (golfGenerationKey) partsWithGolf = [...partsWithGolf, golfGenerationKey];
    if (golfLoftKey) partsWithGolf = [...partsWithGolf, golfLoftKey];
    if (golfShaftKey) partsWithGolf = [...partsWithGolf, golfShaftKey];
    if (golfSexKey) partsWithGolf = [...partsWithGolf, golfSexKey];
    if (golfIronSetKey) partsWithGolf = [...partsWithGolf, golfIronSetKey];
  }
  const gameConsoleParsed = category === "game_console"
    ? parseGameConsoleListing(title, description)
    : null;
  const gameConsoleComparableKey = gameConsoleParsed?.listingType === "normal"
    ? gameConsoleParsed.comparableKey
    : null;
  const comparableKey = gameConsoleComparableKey ?? partsWithGolf?.map(slug).join("|") ?? null;
  const baseParseConfidence = confidence({
    category,
    model,
    releaseYear,
    laptopModelNumber,
    storageGb: finalStorageGb,
    ramGb: finalRamGb,
    ssdGb: finalSsdGb,
    screenSizeIn,
    chip,
    connectivity: finalConnectivity,
    carrier: finalCarrier,
    watchSizeMm: finalWatchSizeMm,
    airpodsConnector,
    airpodsNoiseControl,
    airpodsMaxGeneration,
    monitorModelCode,
    monitorResolution,
    monitorRefreshRate,
    monitorPanelType,
    monitorShape,
    batteryHealth,
    batteryCycles,
  });
  const parseConfidence = gameConsoleComparableKey
    ? Math.max(baseParseConfidence, gameConsoleParsed?.parseConfidence ?? 0)
    : baseParseConfidence;
  const variantKey = gameConsoleComparableKey
    ? gameConsoleComparableKey.split("|").slice(2).join(" / ")
    : parts ? parts.slice(2).join(" / ") : null;
  const criticalUnknown = criticalUnknowns(category, comparableKey);
  const poolBlockConditionNote = conditionNotes.some((note) => [
    "multi_device_bundle",
    "display_defect",
    "device_body_damage",
    "foldable_hinge_damage",
    "camera_lens_damage",
    "screen_replaced",
    "faceid_issue",
    "parts_only",
    "buying_post",
    "exchange_only",
    "single_side_only",
    "accessory_compatible_for_other_product",
  ].includes(note));
  // Wave 90 v38: 번들 매물 정책 변경 (사용자 결정).
  // 이전: tablet 번들 (+애플펜슬/매직키보드/케이스) → needs_review → 풀 진입 차단
  // 변경: 번들 매물도 풀 진입 OK. 시세 비교는 순정 매물 기준 그대로.
  // 이유: 번들 = 액세서리 +α 보너스이고 시세보다 싸면 무조건 좋은 거. 차단할 이유 없음.
  // parsedJson.tablet_bundle_price_review는 그대로 박혀서 후속 UI 뱃지 표시 가능.
  const needsReview = parseConfidence < 0.65
    || criticalUnknown.length > 0
    || poolBlockConditionNote
    || airpodsMaxGeneration === "unknown_generation"
    || (airpodsMaxGeneration === "max_lightning" && !airpodsMaxFullProductContext)
    || (category === "monitor" && !monitorModelCode)
    || Boolean(gameConsoleComparableKey && gameConsoleParsed?.needsReview)
    || !comparableKey;

  // Wave 140 (사용자 코멘트 #122) + 2026-05-16 v46 (사용자 정책 변경):
  // 메타데이터 (셀러 명시) vs description (자연어) 충돌 시 — "보수적 (낮은 등급) 우선".
  //
  // 정책 매트릭스:
  //   - metadata 없음 → description 만 (extractConditionClass)
  //   - description == normal (무신호) → metadata 신뢰 (#122 효과 유지 — 짧은 본문 매물)
  //   - 둘 다 신호 있음 → worseOf (낮은 등급)
  //   - low_batt 한쪽 있으면 → low_batt (special, 가격 modifier)
  //
  // 예시:
  //   - 메타 "사용감 없음" + 본문 "액정 깨짐" → flawed (description 우선)
  //   - 메타 "사용감 많음" + 본문 "새상품" 셀러 인플레 → worn (metadata 우선)
  //   - 메타 "사용감 없음" + 본문 무신호 → clean (metadata)
  //   - 메타 "미개봉" + 본문 무신호 → unopened (metadata)
  //   - 메타 NULL + 본문 "박스 미개봉" → unopened (description)
  const bunjangOverride = bunjangLabelToConditionClass(input.bunjangConditionLabel);
  const notesClass = extractConditionClass(conditionNotes);
  // Wave 209 (2026-05-18): objective clean signal 우선 — metadata worse-of 무시.
  // battery_high_health (95~99%) 또는 battery_perfect (100%) = 객관적 measurement (셀러 자연어/metadata 보다 강함).
  const hasObjectiveCleanSignal = conditionNotes.includes("battery_high_health")
    || conditionNotes.includes("battery_perfect");
  const finalConditionClass = resolveConditionClass(bunjangOverride, notesClass, hasObjectiveCleanSignal);

  return {
    parserVersion: PARSER_VERSION,
    contentHash: hashText(`${title}\n${description.slice(0, 1200)}`),
    category,
    family,
    model,
    variantKey,
    comparableKey,
    storageGb: finalStorageGb,
    ramGb: finalRamGb,
    ssdGb: finalSsdGb,
    screenSizeIn,
    chip,
    releaseYear,
    batteryHealth,
    batteryCycles,
    carrier: finalCarrier,
    connectivity: finalConnectivity,
    conditionScore: cap01(conditionScore),
    conditionNotes,
    conditionClass: finalConditionClass,
    parseConfidence,
    needsReview,
    parsedJson: {
      watch_size_mm: finalWatchSizeMm,
      // Wave 774 (2026-05-24): sport_golf loft 추출 — 시세 fragmentation + UI display.
      golf_loft: golfLoftValue,
      // Wave 775: sport_golf shaft 추출 (Wave 760 sweep 결과 기반 — TourAD/Ventus/Speeder/Diamana 등).
      golf_shaft: golfShaftValue,
      // Wave 776: sport_golf sex + iron_set 추출 (Majesty wood Men 840K vs Women 150K = 5.6배).
      golf_sex: golfSexValue,
      golf_iron_set: golfIronSetValue,
      // Wave 777: sport_golf generation 추출 (Honma Beres NX/BB/B-PLUS/S, Ping G410/425/430, PXG GEN, TM SIM/Stealth/Qi10, Titleist TS/TSi/TSR/GT, XXIO 9-13).
      golf_generation: golfGenerationValue,
      // Wave 182 Phase 3 (2026-05-17): base option fallback metadata.
      // 옵션 명시 X → SKU baseOptions 의 가장 낮은 옵션 가정. UI 에서 "기본 옵션 가정" 표시.
      option_base_assumed: optionBaseAssumed.length > 0 ? optionBaseAssumed : null,
      airpods_connector: airpodsConnector,
      airpods_noise_control: airpodsNoiseControl,
      airpods_max_generation: airpodsMaxGeneration,
      airpods_max_full_product_context: airpodsMaxFullProductContext,
      monitor_brand: monitorBrand,
      monitor_model_code: monitorModelCode,
      monitor_resolution: monitorResolution,
      monitor_refresh_rate_hz: monitorRefreshRate,
      monitor_panel_type: monitorPanelType,
      monitor_shape: monitorShape,
      monitor_model_hint: monitorModelHint,
      game_console_parser: gameConsoleParsed ? {
        listing_type: gameConsoleParsed.listingType,
        platform: gameConsoleParsed.platform,
        edition: gameConsoleParsed.edition,
        body_config: gameConsoleParsed.bodyConfig,
        comparable_key: gameConsoleParsed.comparableKey,
        needs_review: gameConsoleParsed.needsReview,
      } : null,
      laptop_model_number: laptopModelNumber,
      laptop_model_hint: laptopModelHint,
      inferred_release_year: parsedReleaseYear == null && releaseYear != null,
      inferred_screen_size: parsedScreenSizeIn == null && screenSizeIn != null,
      raw_sku_id: input.skuId ?? null,
      raw_sku_name: input.skuName ?? null,
      unknown_parts: comparableKey?.split("|").filter((part) => part.startsWith("unknown_")) ?? [],
      critical_unknown: criticalUnknown,
      tablet_bundle_price_review: tabletBundlePriceReview,
      condition_notes: conditionNotes,
      earphone_condition_evidence: earphoneConditionEvidence?.facts ?? null,
      earphone_condition_signals: earphoneConditionEvidence?.signals ?? null,
      earphone_condition_policy: earphoneConditionEvidence ? {
        version: earphoneConditionEvidence.version,
        mode: "pool_gate_v1",
        hard_block_candidates: earphoneConditionEvidence.hardBlockCandidates,
        warning_signals: earphoneConditionEvidence.warningSignals,
        positive_signals: earphoneConditionEvidence.positiveSignals,
      } : null,
      tech_device_condition_evidence: techDeviceConditionEvidence?.facts ?? null,
      tech_device_condition_signals: techDeviceConditionEvidence?.signals ?? null,
      tech_device_condition_policy: techDeviceConditionEvidence ? {
        version: techDeviceConditionEvidence.version,
        mode: "condition_gate_v1",
        hard_block_candidates: techDeviceConditionEvidence.hardBlockCandidates,
        warning_signals: techDeviceConditionEvidence.warningSignals,
        positive_signals: techDeviceConditionEvidence.positiveSignals,
      } : null,
      // 2026-05-16 v46 cleanup: condition_class 는 mvp_listing_parsed.condition_class column 에만 박음.
      // parsed_json 안 중복 저장 제거 (denormalization 클루지 차단 — 향후 drift 위험 0).
    },
  };
}

// ─── Narrow lane reject rules ────────────────────────────────────────────────
// Scoped to specific narrow lanes only. Do not extend to broad categories —
// broad smartphone/headphone/laptop pipelines go through AI L2 (Agent A).
// Mined and verified by Agent D against 200+ samples per lane.

export type NarrowLaneKey =
  | "ipad_pro_11_m4_256_wifi"
  | "sony_wh1000xm4"
  | "iphone_15_pro_128gb_self";

export type NarrowLaneEvaluation = {
  laneKey: NarrowLaneKey;
  parseReady: boolean;
  rejectReasons: string[];
};

type NarrowLaneRule = {
  laneKey: NarrowLaneKey;
  acceptAll: RegExp[];
  reject: { label: string; pattern: RegExp }[];
};

const NARROW_LANE_RULES: Record<NarrowLaneKey, NarrowLaneRule> = {
  ipad_pro_11_m4_256_wifi: {
    laneKey: "ipad_pro_11_m4_256_wifi",
    acceptAll: [/m4/i, /256/, /아이패드|ipad/i],
    reject: [
      { label: "wrong_chip_m1_m2_m3", pattern: /\bm[123]\b|m1\s*칩|m2\s*칩|m3\s*칩/i },
      { label: "wrong_storage_512_1tb_2tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|2\s*tb|1\s*테라|2\s*테라/i },
      { label: "wrong_storage_128", pattern: /(?:^|[^0-9])128\s*(?:gb|기가)?\b/i },
      { label: "wrong_size_13_inch", pattern: /13\s*인치|12\.9\s*인치|13"|13″/ },
      { label: "cellular_variant", pattern: /셀룰러|cellular|\blte\b|\b5g\b|유심|sim\s*트레이|esim/i },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품|개별)|필름\s*(?:만|단품)|키보드\s*만|펜슬\s*만|어댑터\s*만|충전기\s*만/i },
      { label: "case_or_smart_folio_listing", pattern: /(?:스마트\s*폴리오|스마트\s*커버|폴리오\s*케이스).{0,8}판매|매직\s*키보드\s*판매/i },
      { label: "broken_or_parts_only", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품/i },
      { label: "buying_post", pattern: /매입|삽니다|구매\s*합니다|구매합니다|사요|구해요/ },
      { label: "ipad_air_or_mini", pattern: /아이패드\s*에어|ipad\s*air|아이패드\s*미니|ipad\s*mini/i },
    ],
  },
  sony_wh1000xm4: {
    laneKey: "sony_wh1000xm4",
    acceptAll: [/1000\s*xm4|wh\s*-?\s*1000\s*xm4|\bxm4\b/i],
    reject: [
      { label: "wrong_gen_xm3", pattern: /1000\s*xm3|wh\s*-?\s*1000\s*xm3|\bxm3\b/i },
      { label: "wrong_gen_xm5", pattern: /1000\s*xm5|wh\s*-?\s*1000\s*xm5|\bxm5\b/i },
      { label: "wrong_gen_xm6", pattern: /1000\s*xm6|\bxm6\b/i },
      { label: "case_only", pattern: /케이스\s*(?:만|단품|개별)|하드\s*케이스\s*만|파우치\s*만|보관\s*케이스\s*만/ },
      { label: "earpad_only", pattern: /이어\s*패드(?:\s*만|\s*교체|\s*단품)?|패드\s*교체용|쿠션\s*교체|패드만\s*판매/ },
      { label: "charger_or_cable_only", pattern: /충전기\s*만|케이블\s*만|usb\s*케이블\s*만|어댑터\s*만/i },
      { label: "parts_only", pattern: /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "wrong_product_earbuds", pattern: /무선\s*이어폰|이어버드|wf\s*-?\s*1000|linkbuds/i },
      { label: "wrong_product_neckband", pattern: /넥밴드|wi\s*-?\s*c\d{3}|sp\s*510/i },
      { label: "non_sony_clone", pattern: /짝퉁|가품|복제품|레플리카/ },
      { label: "broken", pattern: /고장|불량\s*품|파손\s*품|작동\s*안\s*됨|소리\s*안\s*나/ },
    ],
  },
  iphone_15_pro_128gb_self: {
    laneKey: "iphone_15_pro_128gb_self",
    acceptAll: [/아이폰\s*15\s*프로|iphone\s*15\s*pro/i],
    reject: [
      { label: "wrong_model_pro_max", pattern: /프로\s*맥스|promax|pro\s*max|프맥/i },
      { label: "wrong_model_15_base_or_plus", pattern: /아이폰\s*15\s*플러스|iphone\s*15\s*plus|아이폰\s*15\s*기본/i },
      { label: "wrong_model_14", pattern: /아이폰\s*14|iphone\s*14/i },
      { label: "wrong_model_16", pattern: /아이폰\s*16|iphone\s*16/i },
      { label: "wrong_storage_64", pattern: /(?:^|[^0-9])64\s*(?:gb|기가)\b/i },
      { label: "wrong_storage_256", pattern: /(?:^|[^0-9])256\s*(?:gb|기가)?\b/i },
      { label: "wrong_storage_512_1tb", pattern: /512\s*(?:gb|기가)?|1\s*tb|1\s*테라/i },
      { label: "carrier_skt", pattern: /\bskt\b|sk\s*텔레콤|에스케이\s*텔레콤/ },
      { label: "carrier_kt", pattern: /(?:^|\s)kt\s*(?:완납|개통|약정|이동|번호|요금|승계|유심)|케이티\s*개통|kt\s*전용/i },
      { label: "carrier_lg", pattern: /\blgu\+?|\blg\s*u\+?|유플\s*러스|엘지\s*유플|엘지유플|lg\s*전용/i },
      { label: "carrier_locked_generic", pattern: /통신사\s*(?:개통|이동|전용|확정)|번호\s*이동|약정\s*(?:승계|진행|걸|남)|선택\s*약정|공시\s*지원|완납\s*폰|완납폰|제휴\s*카드|할부\s*승계|할부\s*원금|할부\s*잔여|개통\s*후|확정\s*기변|확정기변/ },
      { label: "broken_or_parts", pattern: /액정\s*파손|부품\s*용|부품용|파손\s*품|침수|배터리\s*교체\s*요망/ },
      { label: "buying_post", pattern: /매입|삽니다|구해요|구매\s*합니다|구매합니다/ },
      { label: "refurbished_only", pattern: /리퍼\s*폰|리퍼폰|리퍼\s*제품|리퍼\s*수령/ },
      { label: "accessory_only", pattern: /케이스\s*(?:만|단품)|필름\s*(?:만|단품)|충전기\s*만|보호\s*필름\s*만/ },
    ],
  },
};

function normalizeForNarrowLane(text: string): string {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^0-9a-z가-힣./\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateNarrowLane(
  laneKey: NarrowLaneKey,
  input: { title: string; description?: string },
): NarrowLaneEvaluation {
  const rule = NARROW_LANE_RULES[laneKey];
  if (!rule) {
    return { laneKey, parseReady: false, rejectReasons: ["unknown_lane"] };
  }
  const text = normalizeForNarrowLane(`${input.title}\n${input.description ?? ""}`);
  const rejectReasons: string[] = [];

  for (const pattern of rule.acceptAll) {
    if (!pattern.test(text)) rejectReasons.push(`missing_${pattern.source.slice(0, 24).replace(/[^a-z0-9가-힣]+/gi, "_")}`);
  }
  for (const rejectRule of rule.reject) {
    if (rejectRule.pattern.test(text)) rejectReasons.push(`reject_${rejectRule.label}`);
  }
  return {
    laneKey,
    parseReady: rejectReasons.length === 0,
    rejectReasons,
  };
}

export function toParsedListingRow(pid: number | string, parsed: ParsedListingOptions) {
  const nowIso = new Date().toISOString();
  // Wave 714 (2026-05-23): condition_grade — 신발/의류 5-tier S/A/B/C/D grading.
  //   parser (wave92-fashion-mobility) 가 parsedJson.condition_grade 에 박음.
  //   여기서 별도 column 4개로 분리 write — query 효율 (jsonb path 보다 column index 가 빠름).
  const grade = (parsed.parsedJson as Record<string, unknown>).condition_grade as
    | {
        tier?: string;
        cluster?: string;
        confidence?: number;
        flags?: Record<string, unknown>;
        chips?: string[];
      }
    | null
    | undefined;
  return {
    pid: Number(pid),
    parser_version: parsed.parserVersion,
    content_hash: parsed.contentHash,
    category: parsed.category,
    family: parsed.family,
    model: parsed.model,
    variant_key: parsed.variantKey,
    comparable_key: parsed.comparableKey,
    storage_gb: parsed.storageGb,
    ram_gb: parsed.ramGb,
    ssd_gb: parsed.ssdGb,
    screen_size_in: parsed.screenSizeIn,
    chip: parsed.chip,
    release_year: parsed.releaseYear,
    battery_health: parsed.batteryHealth,
    battery_cycles: parsed.batteryCycles,
    carrier: parsed.carrier,
    connectivity: parsed.connectivity,
    condition_score: parsed.conditionScore,
    condition_notes: parsed.conditionNotes,
    // Wave 130 (2026-05-16): condition_class 컬럼 — DB schema migration 후 사용.
    // 시세 산정 시 (comparable_key, condition_class) 복합 키로 grouping.
    condition_class: parsed.conditionClass,
    parse_confidence: parsed.parseConfidence,
    needs_review: parsed.needsReview,
    parsed_json: parsed.parsedJson,
    parsed_at: nowIso,
    updated_at: nowIso,
    // Wave 714 (2026-05-23): 5-tier grading column. 전자기기는 grade=null → 모두 null.
    // Wave 760d (2026-05-24): game_console / sport_golf 만 conditionClass → 5-tier 매핑 추가 (fashion 외 카테고리는 null 유지).
    condition_tier:
      grade?.tier
        ?? (parsed.category && GAME_GOLF_TIER_CATEGORIES.has(parsed.category)
              ? conditionClassToFiveTier(parsed.conditionClass)
              : null),
    condition_cluster: grade?.cluster ?? null,
    condition_confidence: grade?.confidence ?? null,
    condition_flags: grade?.flags ?? null,
    // Wave 714 (2026-05-23): 정규화 chip array — UI / 필터 / /me 페이지 상세보기.
    //   예: ["wear:unworn", "box:full", "auth:kream", "extra:extra_laces"]
    condition_chips: grade?.chips ?? null,
  };
}
