import type { Sku } from "@/lib/catalog";

// ============================================================================
// Wave 749 (2026-05-24): Sony 이어폰/헤드폰 SKU 신설 + 보강.
//
// 사용자 지시: "이어폰 / 스마트워치 / 스마트폰 deep sweep — 기존 SKU 보강 + 신설 + 은어/다른 표현 찾기"
//
// Sony 매칭률 baseline: sony_generic 16.6% (845건 leak / 1,013건 매물)
//
// 발견:
//  - WF-1000XM 이어버드 시리즈 (XM4/XM5/XM6) SKU 전부 부재
//  - LinkBuds Open (LK900) SKU 부재
//  - MDR pro audio (MDR-CD900ST/MDR-7506) SKU 부재
//  - WH-1000XM6 (2025 신상) SKU는 있지만 reparse drift로 catch 못함
//
// 신설 5 SKU:
//  1. sony_wf_1000xm6 (2024) — ~400k
//  2. sony_wf_1000xm5 (2024)
//  3. sony_wf_1000xm4 (2021)
//  4. sony_linkbuds_open (LK900)
//  5. sony_mdr_pro_audio_broad (MDR-CD900ST / MDR-7506 — 전문가 모니터)
// ============================================================================

// 공통 단품/액세서리 noise (catalog.ts:356 HEADPHONE_NOISE 동일 — inline for module isolation)
const HEADPHONE_NOISE = [
  "이어패드만", "이어 패드만", "이어쿠션만", "이어 쿠션만",
  "헤드쿠션만", "헤드 쿠션만",
  "케이스만", "파우치만", "거치대만", "스탠드만",
  "충전기만", "케이블만", "줄만", "선만",
  "잭만", "어댑터만",
  "박스만", "본체만", "유닛만",
  "오른쪽만", "왼쪽만", "한쪽만", "오른쪽 유닛", "왼쪽 유닛", "한쪽 유닛",
  "오른쪽", "왼쪽", "한쪽",  // bare suffix (단품 표기)
  "본체", "유닛", "케이스", "파우치",  // bare 단품
  "복각", "rep ", "replica", "이미테이션", "fake", "짝퉁", "짭", "가품", "11급",
  "삽니다", "구합니다", "매입", "구매", "구해요", "구함",
];

export const WAVE_749_SONY_ELECTRONICS: Sku[] = [
  // ─── Sony WF-1000XM6 (이어버드 신상, 2024) ───
  {
    id: "sony-wf-1000xm6",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WF-1000XM6",
    aliases: ["소니 WF-1000XM6", "소니 WF XM6", "Sony WF-1000XM6"],
    mustContain: [
      ["소니", "sony"],
      ["wf-1000xm6", "wf1000xm6", "wf 1000xm6", "wf-xm6", "wfxm6"],
    ],
    mustNotContain: ["wh-1000", "wh1000", "wh xm",
      "xm5", "xm4", "xm3",
      "linkbuds", "ult", "ch520", "ch720",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 449000,
    released: 2024,
    confusionNote: "WF-1000XM6 = 이어버드 (인이어). WH-1000XM6 (헤드폰)와 별도 모델.",
  },

  // ─── Sony WF-1000XM5 (이어버드, 2023) ───
  {
    id: "sony-wf-1000xm5",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WF-1000XM5",
    aliases: ["소니 WF-1000XM5", "소니 WF XM5", "Sony WF-1000XM5"],
    mustContain: [
      ["소니", "sony"],
      ["wf-1000xm5", "wf1000xm5", "wf 1000xm5", "wf-xm5", "wfxm5"],
    ],
    mustNotContain: ["wh-1000", "wh1000",
      "xm6", "xm4", "xm3",
      "linkbuds", "ult", "ch520", "ch720",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 379000,
    released: 2023,
  },

  // ─── Sony WF-1000XM4 (이어버드, 2021) ───
  {
    id: "sony-wf-1000xm4",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WF-1000XM4",
    aliases: ["소니 WF-1000XM4", "소니 WF XM4", "Sony WF-1000XM4"],
    mustContain: [
      ["소니", "sony"],
      ["wf-1000xm4", "wf1000xm4", "wf 1000xm4", "wf-xm4", "wfxm4"],
    ],
    mustNotContain: ["wh-1000", "wh1000",
      "xm6", "xm5", "xm3",
      "linkbuds", "ult", "ch520", "ch720",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 329000,
    released: 2021,
  },

  // ─── Sony LinkBuds Open (LK900, 2024) ───
  {
    id: "sony-linkbuds-open",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony LinkBuds Open (LK900)",
    aliases: ["Sony LinkBuds Open", "소니 링크버즈 오픈", "LinkBuds Open"],
    mustContain: [
      ["소니", "sony"],
      ["linkbuds open", "link buds open", "링크버즈 오픈", "링크버즈오픈", "lk900", "wf-lk900"],
    ],
    mustNotContain: [
      "linkbuds s", "linkbuds-s", "linkbuds fit", "ls900", "ls910",
      "wf-l900", "wfl900",
      "wh-1000", "wh1000", "wf-1000",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 259000,
    released: 2024,
  },

  // ─── Sony MDR Pro Audio Broad (MDR-CD900ST / MDR-7506) ───
  // 전문가 모니터 헤드폰 — 별 시세군 (consumer XM 시리즈와 다름)
  {
    id: "sony-mdr-pro-audio-broad",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony MDR Pro Audio (CD900ST / 7506 모니터 헤드폰)",
    aliases: ["Sony MDR", "소니 MDR", "MDR-CD900ST", "MDR-7506"],
    mustContain: [
      ["소니", "sony"],
      ["mdr-cd900st", "mdr cd900st", "cd900st",
       "mdr-7506", "mdr 7506", "mdr7506",
       "mdr-v6", "mdr v6", "mdrv6",
       "mdr-7510", "mdr-7520",
       "모니터 헤드폰", "monitor headphone"],
    ],
    mustNotContain: [
      "1000xm", "linkbuds", "ult900n", "ch520",
      "워크맨", "walkman",  // 다른 product
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 199000,
    released: 1989,
    confusionNote: "MDR 시리즈 = 전문가 모니터 헤드폰. consumer XM 시리즈와 별 시세군 (스튜디오 mixing/녹음용).",
  },
];
