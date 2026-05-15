// Wave 133 (2026-05-16): 신발 broad SKU 5개 신설.
// 사용자 요청: "조던/에어포스 리셀러 환장 카테고리. 인기 매물 cadence sweep".
//
// 발견: catalog-shoe-wave91.ts 39 SKU 모두 한정판/specific 컬러웨이 (Jordan Lost-and-Found,
// Royal 2017, Shadow 2.0 등). 일반 인기 모델 (에어포스 1 / 덩크 로우 / NB 530 / 삼바 / NB 992)
// broad SKU 부재 → raw 신발 매물 3,993건 중 SKU 매칭 ~50건 (1.3%).
//
// 정책:
// - 모든 컬러웨이 흡수 (broad) — 단 한정판 컬러는 mustNotContain (catalog-shoe-wave91.ts 충돌 방지).
// - 가품 risk 큼 (에어포스 1/덩크 로우 가품 빈도 ↑) → AI L2 강제 + 시세 floor.
// - internal_only 진입 (Wave 91 readiness 정책). 측정 후 ready 결정.
// - laneKey 없음 (narrow lane 아님, broad 시세 학습용).
//
// 가품 detection (parser는 별도 wave에서 학습):
// - 시세 대비 30% 이하 = 가품 의심 flag
// - 셀러 리뷰 0건 + 신상품 = 위험
// - 사이즈 명시 안 함 = needs_review (wave92 parser가 이미 박음)

import type { Sku } from "@/lib/catalog";

export const SHOE_BROAD_CATALOG: Sku[] = [
  {
    id: "shoe-nike-airforce-1-low-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Air Force 1 Low (Broad)",
    aliases: ["나이키 에어포스 1", "Air Force 1", "에어포스 1 로우", "AF1 Low"],
    mustContain: [
      ["에어포스 1", "에어포스1", "air force 1", "airforce 1", "airforce1", "af1", "에어포스로우", "에포1"],
      ["로우", "low", "기본", "스탠다드", "standard", "white", "화이트", "black", "블랙", "트리플", "triple", "정품"],
    ],
    mustNotContain: [
      // 한정판/콜라보 차단 (다른 SKU와 충돌 방지)
      "오프화이트", "off-white", "off white", "travis scott", "트래비스 스캇", "트래비스스캇",
      "sacai", "사카이", "supreme", "슈프림", "메리언호프", "tiffany", "티파니", "louis vuitton", "루이비통",
      "shadow", "쉐도우", "섀도우", "hi", "high", "미드", "mid",
      // 가품 명시
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급", "ss급 정품",
      // 키즈/유아 차단 (wave92 parser도 차단하지만 catalog 차원에서 추가)
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant", "신생아",
      // 단품/한짝
      "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍",
      // 매입글
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 139000,
    released: 1982,
  },
  {
    id: "shoe-nike-dunk-low-broad",
    brand: "Nike",
    category: "shoe",
    modelName: "Nike Dunk Low (Broad)",
    aliases: ["나이키 덩크 로우", "Dunk Low", "덩크"],
    mustContain: [
      ["덩크 로우", "덩크로우", "dunk low", "dunklow"],
      ["나이키", "nike", "정품", "리테일", "retail"],
    ],
    mustNotContain: [
      // 한정판 차단 (이미 catalog에 있거나 별도 SKU)
      "오프화이트", "off-white", "off white", "travis scott", "트래비스 스캇",
      "ben & jerry", "벤앤제리", "ambush", "앰부쉬", "sb", "supreme", "슈프림",
      "co.jp", "civilist", "유타", "utah", "츤추라이", "syracuse",
      "high", "하이", "미드", "mid", "sky", "스카이",
      // 가품
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant",
      // 단품
      "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍",
      // 매입글
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 119000,
    released: 1985,
  },
  {
    id: "shoe-newbalance-530-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 530 (Broad)",
    aliases: ["뉴발란스 530", "NB 530", "뉴발 530"],
    mustContain: [
      ["뉴발란스 530", "뉴발 530", "nb 530", "nb530", "new balance 530"],
    ],
    mustNotContain: [
      // 콜라보
      "aimé leon dore", "ald", "에이메 레옹 도르", "miu miu", "미우미우",
      // 가품
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant", "ks",
      // 단품
      "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍",
      // 매입글
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 139000,
    released: 1992,
  },
  {
    id: "shoe-newbalance-992-broad",
    brand: "New Balance",
    category: "shoe",
    modelName: "New Balance 992 (Broad)",
    aliases: ["뉴발란스 992", "NB 992", "뉴발 992"],
    mustContain: [
      ["뉴발란스 992", "뉴발 992", "nb 992", "nb992", "new balance 992"],
    ],
    mustNotContain: [
      // 콜라보/한정판
      "joe freshgoods", "조 프레시굿즈", "aime leon dore", "ald",
      // 다른 9xx 시리즈 (993/991/990 등) 차단
      "990", "991", "993", "997", "998", "999",
      // 가품
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant",
      // 단품
      "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍",
      // 매입글
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 249000,
    released: 2006,
  },
  {
    id: "shoe-adidas-samba-og-broad",
    brand: "Adidas",
    category: "shoe",
    modelName: "Adidas Samba OG (Broad)",
    aliases: ["아디다스 삼바", "Samba OG", "삼바", "Samba"],
    mustContain: [
      ["아디다스 삼바", "adidas samba", "삼바 og", "samba og", "samba"],
    ],
    mustNotContain: [
      // 콜라보/한정판 (Wales Bonner / Pharrell 등)
      "wales bonner", "웨일즈 보너", "pharrell", "퍼렐", "humanrace", "휴먼레이스",
      "kith", "키스", "sporty rich",
      // 다른 시리즈 (Samba Rose, Samba Vegan 등)
      "rose", "vegan", "비건", "decon", "데콘",
      // 가품
      "짭", "가품", "레플리카", "replica", "fake", "미러", "샘플", "sample", "1:1", "11급",
      // 키즈
      "td", "ps", "키즈", "유아", "아동", "toddler", "kids", "infant",
      // 단품
      "한짝", "한쪽만", "사이즈 미상", "파손", "찢어짐", "구멍",
      // 매입글
      "삽니다", "구합니다", "구해요", "매입",
    ],
    msrpKrw: 129000,
    released: 1950,
  },
];
