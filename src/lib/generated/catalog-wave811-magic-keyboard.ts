import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 811 (2026-05-30): 매직 키보드 narrow + 호환품 차단.
//
// Background — Wave 808 deepsweep sample:
//   - "애플 매직 키보드 아이패드 프로 11인치 정품" ₩180K
//   - "Apple iPad 매직 키보드 11인치 블랙" ₩150K
//   - "아이패드 매직 키보드 화이트" ₩70K
//   - "Nimin 아이패드 매직 키보드 프로 13인치 블랙" ₩45K  ← 호환품!
//   - "AITEWO 아이패드 프로 12.9 매직 키보드 케이스" ₩80K ← 호환품!
//   - "HOU 아이패드 호환 매직 키보드 12.9인치" ₩100K ← 호환품!
//   - "니케 아이패드 에어 11인치 매직 키보드 화이트" ₩80K ← 호환품!
//   - "로지텍 플립폴리오 아이패드 ... 키보드" ₩120K ← Logitech (다른 brand)
//
// 정품 vs 호환품 가격 ~2x 차이 (정품 11" ₩150K vs Nimin ₩45K).
// 호환품 brand 광범위: Nimin / AITEWO / HOU / 니케 / Logitech / 호환 / 케이스만 / etc.
//
// 사이즈별 narrow:
//   - 11" (iPad Air 11 / Pro 11) — 정품 ₩70~200K
//   - 13" (12.9" Pro / Air 13) — 정품 ₩140~200K
// ============================================================================

const COMPAT_BRAND_NOISE = [
  // sample 박힌 호환품 브랜드
  "aitewo", "nimin", "hou ",
  "니케", "nyke",
  "로지텍", "logitech", "logi",
  // 더 흔한 호환 brand
  "ainope", "esr ", "wiwu", "위유",
  "fintie", "핀티",
  "tukzer",
  "샤오미", "xiaomi",
  "베이스어스", "baseus",
  // 일반 호환 키워드
  "호환", "compatible", "compat",
  "타사", "타사 호환",
  // 케이스 only (키보드 아님)
  "키보드 케이스", "키보드케이스",
  // 짝퉁/가품 noise
  "이미테이션", "fake", "짝퉁", "짭", "가품",
  // 매입글
  "삽니다", "구합니다", "구매", "구매합니다", "매입",
] as const;

export const WAVE811_MAGIC_KEYBOARD_SKUS: Sku[] = [
  // ──────────────────────────────────────────────────────────────────────
  // 매직 키보드 11" (iPad Pro 11 / iPad Air 11)
  //   sample: ₩70K~200K (₩150K median)
  //   함정: 호환품 50% (Nimin/AITEWO/니케/로지텍 등)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "tablet-magic-keyboard-ipad-11",
    brand: "Apple",
    category: "tablet",
    modelName: "Apple Magic Keyboard (iPad 11\")",
    aliases: ["Magic Keyboard 11", "매직 키보드 11", "매직키보드 11"],
    mustContain: [
      ["매직 키보드", "매직키보드", "magic keyboard"],
      ["11", "11인치", "11 인치", "11형", "11\"", "11.0", "에어 11", "프로 11"],
    ],
    mustNotContain: [
      ...COMPAT_BRAND_NOISE,
      // 다른 사이즈
      "12.9", "12.9인치", "12.9형",
      "13", "13인치", "13형", "13\"", "에어 13", "프로 13",
      "10", "10.2", "10.5", "10.9", "10인치",
      // iPad 본체 (키보드 아님)
      "아이패드 본체", "ipad 본체",
      // 부속/주변
      "보호필름", "필름만", "스킨만", "스티커만",
    ],
    msrpKrw: 449000,
    released: 2024,
    confusionNote: "정품 Apple Magic Keyboard 11\" 만. 호환품 (Nimin/AITEWO/Logitech 등) 별도 / 분리.",
  },

  // ──────────────────────────────────────────────────────────────────────
  // 매직 키보드 13" (iPad Pro 12.9 / 13 / iPad Air 13)
  //   sample: ₩140K~200K
  //   M2/M4 Pro = 12.9", M5 / Air = 13" (apple 명칭 통합 진행 중)
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "tablet-magic-keyboard-ipad-13",
    brand: "Apple",
    category: "tablet",
    modelName: "Apple Magic Keyboard (iPad 12.9/13\")",
    aliases: ["Magic Keyboard 13", "Magic Keyboard 12.9", "매직 키보드 13", "매직 키보드 12.9"],
    mustContain: [
      ["매직 키보드", "매직키보드", "magic keyboard"],
      ["12.9", "13", "13인치", "13형", "13\"", "에어 13", "프로 13"],
    ],
    mustNotContain: [
      ...COMPAT_BRAND_NOISE,
      // 다른 사이즈
      "11", "11인치", "11형", "11\"", "에어 11", "프로 11",
      "10", "10.2", "10.5", "10.9", "10인치",
      // iPad 본체
      "아이패드 본체", "ipad 본체",
      // 부속/주변
      "보호필름", "필름만", "스킨만", "스티커만",
    ],
    msrpKrw: 519000,
    released: 2024,
    confusionNote: "정품 Apple Magic Keyboard 12.9\"/13\" 만. 호환품 별도.",
  },
];
