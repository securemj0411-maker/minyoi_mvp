// Wave 133 (2026-05-16): 신발 broad SKU 신설.
// Wave 134 (2026-05-16): AF1 / 덩크 로우 / NB 992 narrow 분리됨 → broad 제거.
// 남은 broad: NB 530 + 삼바 OG (variant 가격 차이 작아 broad 유지).
//
// 정책:
// - 모든 컬러웨이 흡수 (broad) — 단 한정판 컬러는 mustNotContain (catalog-shoe-wave91.ts 충돌 방지).
// - 가품 risk 큼 → AI L2 강제 + 시세 floor.
// - internal_only 진입 (Wave 91 readiness 정책).

import type { Sku } from "@/lib/catalog";

export const SHOE_BROAD_CATALOG: Sku[] = [
  // ─── NB 530 (variant 가격 차이 작음 → broad 유지) ───
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
  // ─── 아디다스 삼바 OG (variant 가격 차이 작음 → broad 유지) ───
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
      // 콜라보/한정판
      "wales bonner", "웨일즈 보너", "웨일스 보너", "pharrell", "퍼렐", "humanrace", "휴먼레이스",
      "kith", "키스", "sporty rich",
      // Wave 138: 한정 컬러 차단 (broad지만 가격 큰 한정 컬러는 분리)
      "원더 화이트 코어 블랙", "원더 화이트", "코어 블랙 한정",
      "스칼렛", "scarlet",
      "그린 스웨이드", "green suede 한정",
      "흰초", "흰초 새상품",  // 한정 컬러
      "messi", "메시", "messi inspired",
      "humanrace 한정",
      "anatomy", "아나토미",
      "프링글스", "pringles",
      "wensleydale",
      // 다른 시리즈
      "rose", "vegan", "비건", "decon", "데콘", "spezial", "스페지알",
      "rm", "rose mary", "edition",
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
