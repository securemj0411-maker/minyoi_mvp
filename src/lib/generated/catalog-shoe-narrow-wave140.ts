// Wave 140 (2026-05-16): 신발 narrow SKU 추가 (iter 3 미매칭 분석 발굴).
//
// 발견 (60건 미매칭 raw 분석):
// - 컨버스 척70 "하이" 매물 많음 (Wave 139에 "하이" 차단 → 별도 SKU 필요)
// - 호카 본디 7 (옛 세대, msrp 89k, 230 본디 8 가격대와 다름)
// - AF1 '07 트리플 레드 인기 컬러 (white/black 외)
// - NB 530 broad는 있는데 990 외 세대 (NB 991/997/998) 매물 있음
// - 컨버스 잭퍼셀 (별도 모델)

import type { Sku } from "@/lib/catalog";

const COMMON_BLOCK = [
  "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급", "ss급정품",
  "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant", "신생아",
  "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍",
  "삽니다", "구합니다", "구해요", "매입",
];

const COLLAB_BLOCK = [
  "off-white", "off white", "오프화이트",
  "travis", "트래비스", "supreme", "슈프림",
  "stussy", "스투시", "louis vuitton", "루이비통",
  "billie eilish", "빌리 아일리시", "nocta", "녹타",
  "comme des", "꼼데", "cdg",
  "sacai", "사카이",
  "kith", "키스 ", "kith only",
  "aimé leon dore", "aime leon dore", "ald", "에임레온도르",
  "jjjjound", "자운드",
  "carhartt", "칼하트",
  "rick owens", "릭오웬스",
  "한정", "한정판", "콜라보", "collaboration", "collab",
];

export const SHOE_WAVE140_CATALOG: Sku[] = [
  // ─── 컨버스 척70 하이 (별도 모델, msrp 110k) ──────────
  {
    id: "shoe-converse-chuck70-high-black",
    brand: "Converse",
    category: "shoe",
    modelName: "Converse Chuck 70 High Black",
    aliases: ["컨버스 척70 하이 블랙", "Chuck 70 High Black"],
    mustContain: [
      ["컨버스", "converse", "척", "chuck"],
      ["70", "척70", "chuck70"],
      ["하이", "high", "hi top", "하이탑", "hi"],
      ["블랙", "black"],
    ],
    mustNotContain: [
      "화이트", "white", "빈티지", "vintage",
      "low", "로우",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 115000,
    released: 2013,
  },
  {
    id: "shoe-converse-chuck70-high-white",
    brand: "Converse",
    category: "shoe",
    modelName: "Converse Chuck 70 High White",
    aliases: ["컨버스 척70 하이 화이트", "Chuck 70 High White"],
    mustContain: [
      ["컨버스", "converse", "척", "chuck"],
      ["70", "척70", "chuck70"],
      ["하이", "high", "hi top", "하이탑", "hi"],
      ["화이트", "white"],
    ],
    mustNotContain: [
      "블랙", "black", "빈티지", "vintage",
      "low", "로우",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 115000,
    released: 2013,
  },

  // ─── 호카 본디 7 (옛 세대, msrp 89k 가격대 별도) ─────
  {
    id: "shoe-hoka-bondi-7",
    brand: "Hoka",
    category: "shoe",
    modelName: "Hoka Bondi 7",
    aliases: ["호카 본디 7", "Hoka Bondi 7", "Hoka One One Bondi 7"],
    mustContain: [
      ["호카", "hoka", "호카 오네오네", "hoka one one"],
      ["본디 7", "본디7", "bondi 7", "bondi7"],
    ],
    mustNotContain: [
      "본디 8", "본디8", "bondi 8", "bondi8",
      "본디 9", "본디9", "bondi 9",
      "본디 x", "본디x", "bondi x",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 199000,
    released: 2020,
  },

  // ─── AF1 트리플 레드 (인기 컬러, msrp 139k) ──────────
  {
    id: "shoe-nike-airforce-1-low-red",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Air Force 1 Low Triple Red",
    aliases: ["에어포스 1 트리플 레드", "AF1 트리플 레드", "Air Force 1 Triple Red"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "af1", "에어 포스 1"],
      ["트리플 레드", "트리플레드", "triple red", "올레드", "all red", "레드", "red"],
    ],
    mustNotContain: [
      "화이트", "white", "블랙", "black",
      "high", "하이", "mid", "미드",
      "오프화이트", "off-white",
      "travis", "트래비스", "supreme",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 139000,
    released: 1982,
  },

  // ─── 컨버스 잭퍼셀 (별도 모델) ─────────────────────
  {
    id: "shoe-converse-jack-purcell-broad",
    brand: "Converse",
    category: "shoe",
    modelName: "Converse Jack Purcell (Broad)",
    aliases: ["컨버스 잭퍼셀", "Jack Purcell"],
    mustContain: [
      ["컨버스 잭퍼셀", "converse jack purcell", "잭퍼셀", "jack purcell"],
    ],
    mustNotContain: [
      "어딕트", "addict",
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 99000,
    released: 1935,
  },

  // ─── 나이키 페가수스 터보 (별도 모델, 36/터보) ─────
  {
    id: "shoe-nike-pegasus-turbo",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Pegasus Turbo (Broad)",
    aliases: ["나이키 페가수스 터보", "Pegasus Turbo"],
    mustContain: [
      ["페가수스 터보", "pegasus turbo", "페가수스터보"],
    ],
    mustNotContain: [
      "39", "40", "41",  // 정수 세대 차단
      ...COMMON_BLOCK,
      ...COLLAB_BLOCK,
    ],
    msrpKrw: 219000,
    released: 2020,
  },
];
