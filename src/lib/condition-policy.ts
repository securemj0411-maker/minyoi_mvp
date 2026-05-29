// 2026-05-17 v46 cleanup: condition_notes 정책 한 곳에 박음 (drift 차단).
//
// 이전: FLAWED_NOTES (option-parser:56), POOL_BLOCK_NOTES (candidate-pool-builder:306),
// COMPARABLE_EXCLUDE_NOTES (market-source/route.ts:144) 3 곳에 hardcode.
// 한쪽 update 하면 다른쪽 잊음 — 사용자 #92 코멘트가 정확히 이 drift 지적.
//
// 정책:
// - FLAWED_NOTES: parser 가 flawed 분류하는 신호 (option-parser.ts:56 export — 13종)
// - POOL_BLOCK_NOTES ⊂ FLAWED_NOTES — pool 진입 차단 (사용자 손해 명확 신호)
// - COMPARABLE_EXCLUDE_NOTES ⊃ POOL_BLOCK_NOTES — 비교군 UI 제외 (pool block + premium/noise tier 별도 grouping)

import { FLAWED_NOTES } from "@/lib/option-parser";

// Pool 진입 차단 — FLAWED 중 "사용자가 사면 명확한 손해" 신호.
// Wave 946: condition_class=flawed 만으로 자연 차단될 거라는 가정이 당근 ready 풀에서 깨짐
// (가개통/유심기변/확정기변 불가 매물이 ready 잔존). 객관적 hard blocker는 note 단에서 직접 차단.
export const POOL_BLOCK_NOTES = [
  "multi_device_bundle",
  "display_defect",
  // Wave 934 (2026-05-29): smartphone/tablet structural damage. Back glass, rear panel,
  // foldable hinge/inner-panel defects are not cosmetic discounts; pool must not surface them.
  "device_body_damage",
  "foldable_hinge_damage",
  // Wave 938 (2026-05-29): smartphone camera lens/glass crack is not a mere cosmetic wear.
  "camera_lens_damage",
  "camera_issue",
  "sim_or_carrier_issue",
  "water_damage",
  "locked_or_lost_signal",
  "device_charging_or_sensor_issue",
  "refurbished_or_repaired",
  "installment_risk",
  "screen_replaced",
  "faceid_issue",
  "parts_only",
  // Wave 204 (2026-05-18): buy-intent 매물 — 정상 거래 X. 사용자 손해 명확.
  // 사용자 코멘트 #155 (pid 397387660 "갤탭 s9 fe 플러스 구함") broad catalog 누락 fix.
  "buying_post",
  // Wave 531 (2026-05-22): exchange-only posts — 살 수 있는 매물이 아니라 비교군/풀 모두 제외.
  "exchange_only",
  // Wave 207 (2026-05-18): earphone single-side — 페어 매물 아님 (시세 부풀림).
  // 사용자 코멘트 #153 (pid 343583659 "에어팟프로2세대 C타입 왼쪽") AirPods 본체 SKU 매칭 fix.
  "single_side_only",
  // Wave 208 (2026-05-18): "X용 + 액세서리" 호환 매물 — 본품 sku 매칭 잘못 (시세 부풀림).
  // 사용자 코멘트 #157 (pid 398121430 "DJI 오즈모 액션6 용 pov 렌즈") Action 6 본체 SKU 매칭 fix.
  // 기존: catalog.ts DRONE_FILTER_ACCESSORY_NOISE drone-only → parser 일반 detection.
  "accessory_compatible_for_other_product",
] as const;

// 비교군 UI 제외 = POOL_BLOCK + premium/noise tier.
// new_or_open_box / low_battery_health 는 condition_class 별도 grouping
// (unopened / low_batt) 이므로 여기서 제외하면 같은 상태 비교군이 전부 비어버린다.
// applecare_premium / full_set = 프리미엄 (시세 비싸짐). accessory_bundle = noise.
export const COMPARABLE_EXCLUDE_NOTES = [
  ...POOL_BLOCK_NOTES,
  "applecare_premium",
  "accessory_bundle",
  "full_set",
] as const;

// Runtime guard: POOL_BLOCK_NOTES ⊂ FLAWED_NOTES.
// 만약 누가 POOL_BLOCK 에 FLAWED 아닌 신호 박으면 dev mode 에서 console warning.
if (process.env.NODE_ENV !== "production") {
  for (const note of POOL_BLOCK_NOTES) {
    if (!(FLAWED_NOTES as readonly string[]).includes(note)) {
      console.warn(
        `[condition-policy] POOL_BLOCK_NOTES "${note}" 가 FLAWED_NOTES 에 없음. ` +
          `정책 의도: POOL_BLOCK ⊂ FLAWED. option-parser FLAWED_NOTES 에 추가하거나 POOL_BLOCK 에서 제거.`,
      );
    }
  }
}
