// Wave 138 (2026-05-16): 신발 broad SKU 추가.
// Iter 1 needs_review 분석에서 미매칭 인기 모델 발굴:
// - 뉴발란스 327: 매물 50+/h, 가격 30~100k stable, 카사블랑카 콜라보 외 variant 작음
// - 아디다스 토바코: 매물 10+/h, 60~80k stable
// - 아디다스 가젤 OG (인도어 외): 매물 5+/h, 50~80k
//
// 정책:
// - broad SKU — variant 가격 차이 작은 모델만
// - 콜라보/한정 컬러는 mustNotContain
// - internal_only 진입

import type { Sku } from "@/lib/catalog";

export const SHOE_BROAD_WAVE138_CATALOG: Sku[] = [
  // ─── 뉴발란스 327 (broad, variant 가격 안정) ────────
  {
    id: "shoe-newbalance-327-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 327 (Broad)",
    aliases: ["뉴발란스 327", "NB 327", "뉴발 327"],
    mustContain: [
      ["뉴발란스 327", "뉴발 327", "nb 327", "nb327", "new balance 327", "ms327", "ws327", "327lab", "327 lab", "327fe", "327 fe"],
    ],
    mustNotContain: [
      // 콜라보 (가격 다름)
      "카사블랑카", "casablanca",
      "졸리랜처", "jolly rancher",
      "aimé leon dore", "aime leon dore", "ald", "에임레온도르",
      "kith", "키스 ",
      "stussy", "스투시",
      "ganni", "가니",
      "concepts", "콘셉트",
      "miu miu", "미우미우",
      "언다이드", "undyed",  // 한정 컬러
      "프라이머리", "primary pack",  // 한정
      "x ",  // 일반 매물에 "x" 가운데는 콜라보 표시
      // 가품
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant",
      // 단품/매입
      "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐",
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 139000,
    released: 2020,
  },

  // ─── 아디다스 토바코 (broad) ────────────────────────
  {
    id: "shoe-adidas-tobacco-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Tobacco (Broad)",
    aliases: ["아디다스 토바코", "Adidas Tobacco"],
    mustContain: [
      ["아디다스 토바코", "adidas tobacco", "토바코 그루엔", "tobacco gruen", "tobacco"],
    ],
    mustNotContain: [
      // 콜라보
      "wales bonner", "웨일스 보너",
      "kith", "키스 ",
      // 가품
      "짭", "가품", "레플리카", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈/단품/매입
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids",
      "한짝", "한쪽만", "사이즈 미상", "파손",
      "삽니다", "구합니다", "매입",
      // Wave 185 (2026-05-17): 향수 (Tom Ford Tobacco Vanille 등) 격리.
      "tom ford", "톰포드", "톰 포드",
      "향수", "perfume", "오 드 퍼퓸", "edp", "edt",
      "ml", " ml",  // 향수는 ml 단위. 신발에는 없음.
      // 옛 mustNotContain "replica" 있었지만 Wave 185 향수 "Replica" (Maison Margiela) 와 격리하려면 제거하고 명시 격리.
    ],
    msrpKrw: 159000,
    released: 1972,
  },

  // ─── 아디다스 가젤 OG (broad, 인도어 별도) ─────────
  {
    id: "shoe-adidas-gazelle-og-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Gazelle OG (Broad)",
    aliases: ["아디다스 가젤 OG", "Adidas Gazelle"],
    mustContain: [
      ["아디다스 가젤", "adidas gazelle", "가젤", "gazelle"],
    ],
    mustNotContain: [
      // 인도어 별도 SKU
      "인도어", "indoor",
      "spzl", "spezial", "스페지알",
      // Gazelle Bold is a distinct demand lane; keep OG broad clean until it has its own vetted sample.
      "bold", "볼드",
      "boost", "부스트", "gazelle boost", "가젤부스트",
      "platform", "플랫폼",
      "샌들", "샌달", "sandal", "슬라이드", "slide", "비치",
      "gazelle 85", "가젤 85", "가젤85",
      // 콜라보
      "wales bonner", "웨일스 보너",
      "clot", "클랏", "edison", "에디슨",
      "kith", "키스 ",
      "pharrell", "퍼렐",
      "humanrace", "휴먼레이스",
      // 가품
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈/단품/매입
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids",
      "한짝", "한쪽만", "사이즈 미상", "파손",
      "삽니다", "구합니다", "매입",
    ],
    msrpKrw: 139000,
    released: 1968,
  },
];
