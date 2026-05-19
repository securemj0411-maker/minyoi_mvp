// Wave A (2026-05-20) — 카테고리별 브랜드 깊이 정보:
//   counterfeit-checklist.ts 의 "공통 + 카테고리 기본" 체크리스트와 별개.
//   카드의 skuId/skuName/name 에서 브랜드를 추출해 "Bird-aid 라벨", "박스 사이드 라벨 폰트"
//   같은 brand-specific 변별 포인트 + 시장 특징 + 인증 방법을 제공한다.
//
//   외부 review 직접 인용:
//   > "라벨/봉제/안감 3축 확인하세요'가 너무 일반적. 아크테릭스라면 Bird-aid 라벨 폰트,
//   >  GORE-TEX 4면 박음질, 안감 시리얼 vs 외부 태그 일치 — 이런 모델별 가품 체크포인트가
//   >  있어야 진짜 가치 있음. 일반론은 구글링이 더 빠름"
//
//   사용처:
//   - CounterfeitChecklistPanel — 헤드라인 아래 brand-specific 변별 포인트 박스
//   - WhyTrustCollapse 가품 Q — 브랜드 감지 시 brand-specific 답으로 교체
//
//   Wave A 범위: shoe. Wave B: clothing. Wave D: smartphone/tablet/laptop (전자 — 가품 거의 X,
//   진짜 위험 = 잠금/부품/IMEI). 후속 wave (C bag, E 나머지) 에서 동일 구조로 확장.

export type BrandDepth = {
  /** 미뇨이 카드/SKU 명에서 브랜드 감지용 키워드 (lowercased 매칭). */
  detectKeywords: string[];
  /** skuId prefix 매칭 (예: "shoe-nike-jordan"). 있으면 keyword 매칭보다 우선. */
  skuIdPrefixes?: string[];
  /** 사용자에게 노출되는 브랜드 라벨. */
  label: string;
  /**
   * 가품 위험 수준 — 브랜드별 다름.
   *   high     : 가품 흔함. 인증 없이는 거래 위험.
   *   moderate : 가품 가능. 변별 포인트 확인 권장.
   *   low      : 가품 거의 없음. 부품/상태가 더 큰 위험.
   */
  counterfeitRisk: "high" | "moderate" | "low";
  /** 브랜드별 변별 포인트 — 진짜 vs 가품 구분 가능한 구체 항목. */
  counterfeitChecks: string[];
  /** 가품과 별개의 시장 위험 (가수분해/굽창/사이즈 등). */
  marketRisks: string[];
  /** 인증/검수 가능 채널. */
  authentication: string[];
};

export type CategoryBrandDepth = {
  category: string;
  /** 브랜드 감지 실패 시 fallback 정보. */
  default: Omit<BrandDepth, "detectKeywords" | "label">;
  brands: Record<string, BrandDepth>;
};

// ─────────────────────────────────────────────────────────────────────────
// shoe — Wave A
// ─────────────────────────────────────────────────────────────────────────
// 근거:
//   - Nike Jordan/Dunk/Air Force/Air Max — KREAM/Stockx 검수 패턴 + 한국 커뮤니티 변별
//   - Adidas Yeezy/Samba/Gazelle — KREAM 검수 + 야후 옥션 변별 가이드
//   - New Balance 990/2002R — 미국제 vs 해외 OEM 변별 (Made in USA 라벨)
//   - Converse Chuck 70 — 인쇄 톤 + 봉제 변별
//   - UGG / Dr. Martens — 가품 흔함 (밑창 패턴 + 인쇄)
//   - Vans Old Skool — 사이드 스트라이프 + 워플 솔 변별
//   - Hoka / Asics / Puma 러닝/일반화 — 가품 거의 X (실용 카테고리)

const SHOE: CategoryBrandDepth = {
  category: "shoe",
  default: {
    counterfeitRisk: "moderate",
    counterfeitChecks: [
      "박스 사이드 라벨 — 스타일 번호 + 컬러 코드 + 사이즈가 신발 안창 라벨과 일치하는지",
      "안창 폰트 균일성 — 정품은 모든 라벨이 같은 굵기/깊이",
      "솔(밑창) 패턴 — 모서리 선명도, 글자 깊이",
    ],
    marketRisks: [
      "착화/굽창 마모 — 사진으로 솔 측면 + 안창 확인",
      "사이즈 표기 (US/EU/CM) vs 실제 사이즈 불일치 — 셀러가 잘못 표기한 매물 흔함",
    ],
    authentication: ["KREAM 검수 카드", "Stockx (해외)"],
  },
  brands: {
    "nike-jordan": {
      detectKeywords: ["조던", "jordan", "aj1", "aj4", "aj11", " aj ", "에어조던"],
      skuIdPrefixes: ["shoe-nike-jordan", "shoe-jordan"],
      label: "나이키 조던 (Air Jordan)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "박스 사이드 라벨 — 모델 번호(예: 555088-063) + 컬러 + 사이즈 3종이 신발 안창과 일치",
        "안창 'Nike Air' / 'Jumpman' 폰트 — 가품은 'N'의 굵기, 'i' 점 위치 미세 차이",
        "Jumpman 로고 — 농구공 라인 5개, 다리 각도 (가품은 다리가 더 벌어짐)",
        "정품 박스 — 두께감 있고 사이드 라벨 인쇄 선명, 가품 박스는 종이 얇음",
        "혀(tongue) 안쪽 사이즈 라벨 — 'MADE IN' 국가 표기 (조던 1 OG는 China/Vietnam)",
      ],
      marketRisks: [
        "한정판/콜라보 (Travis Scott, Dior, Off-White) = 가품 위험 최상위 — KREAM 검수 없으면 거래 금지",
        "OG 2017년 이전 발매분 = 가수분해 위험 (밑창 노란 변색 + 부스러짐)",
        "사이즈별 시세 차이 큼 (US 9-10 ↑, US 7 이하 ↓ 보통 5~10만원)",
      ],
      authentication: [
        "KREAM 검수 카드 (정품 인증서 포함 매물 신뢰도 ↑↑)",
        "Stockx Verified (해외 직구 시)",
        "Goat 인증 (해외)",
      ],
    },
    "nike-dunk": {
      detectKeywords: ["덩크", "dunk", "sb dunk"],
      skuIdPrefixes: ["shoe-nike-dunk"],
      label: "나이키 덩크 (Dunk Low/High)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "박스 사이드 라벨 — 스타일 번호 (예: DD1391-100) + 컬러명 + 사이즈가 안창과 일치",
        "스우시 곡선 — 정품은 끝부분이 부드럽게 휘어짐, 가품은 직선에 가까움",
        "혀 패치 'NIKE' 폰트 — 가품은 'I'의 점이 너무 크거나 위치 어긋남",
        "솔(아웃솔) 원형 패턴 — 가품은 원이 찌그러져 있거나 간격 불균일",
        "신발끈 구멍(eyelet) 금속 마감 — 정품은 매끈, 가품은 거칠고 색 균일하지 않음",
      ],
      marketRisks: [
        "Panda Dunk (DD1391-100) = 가품 비율 70%+ 추정 — KREAM 검수 없으면 사실상 가품 의심",
        "SB Dunk Travis/Concepts/Stussy 콜라보 = 시세 변동 큼 + 가품 위험 최상위",
        "박스 변색/찌그러짐 = 보관 상태 — 박스 상태 사진 필수",
      ],
      authentication: [
        "KREAM 검수 카드 (Panda Dunk은 KREAM 인증 없으면 거의 가품)",
        "Stockx Verified",
      ],
    },
    "nike-airforce": {
      detectKeywords: ["에어포스", "airforce", "air force", "af1"],
      skuIdPrefixes: ["shoe-nike-airforce"],
      label: "나이키 에어포스 1 (Air Force 1)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "박스 사이드 라벨 — 스타일 번호 (예: CW2288-111) + 사이즈가 안창과 일치",
        "혀 'AIR' 라벨 — 정품은 빨강/하양/검정 3색 배치 정확, 가품은 색 미묘하게 다름",
        "발등 'AF-1 '82' 각인 — 깊이 균일, 가품은 얕거나 글자 흐림",
        "스우시 끝부분 — 정품은 둥글게 마무리, 가품은 뾰족함",
        "정품 가죽 표면 — 작은 모공 패턴 보임, 가품은 매끈한 비닐 느낌",
      ],
      marketRisks: [
        "흰색 (Triple White) = 누렁/때 위험 — 사용감 사진 필수",
        "최근 발매분은 진품 위험 낮음 (한정판 아닌 일반 컬러는 가품 잘 안 만듦)",
      ],
      authentication: ["KREAM 검수", "나이키 매장 영수증"],
    },
    "nike-airmax": {
      detectKeywords: ["에어맥스", "airmax", "air max"],
      skuIdPrefixes: ["shoe-nike-airmax"],
      label: "나이키 에어맥스 (Air Max)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "에어 유닛(쿠셔닝 윈도우) — 정품은 투명도 일정, 가품은 노란기 또는 기포",
        "박스 + 안창 사이즈/스타일 번호 일치",
        "혀/사이드 'Nike Air' 자수 — 글자 간격 균일",
        "솔 패턴 — 모서리 선명도",
      ],
      marketRisks: [
        "에어 유닛 펑크 (오래된 모델) = 쿠셔닝 손상 — 옆에서 누름 시연 영상 권장",
        "Air Max 90/95/97 OG 라인은 가수분해 위험 (2010 이전 발매)",
      ],
      authentication: ["KREAM 검수", "나이키 매장 영수증"],
    },
    "nike-pegasus": {
      detectKeywords: ["페가수스", "pegasus"],
      skuIdPrefixes: ["shoe-nike-pegasus"],
      label: "나이키 페가수스 (러닝화)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "박스 + 안창 사이즈/스타일 번호 일치 (페가수스는 가품 거의 없음 — 시세 낮음)",
      ],
      marketRisks: [
        "러닝화 — 마일리지 (km) 확인 권장. 500km+ 사용은 쿠셔닝 죽음",
        "솔 마모 패턴 (안쪽/바깥쪽 편마모) = 발 모양 정보 — 본인 발에 안 맞을 수 있음",
        "세대(39/40/41) 별 쿠셔닝 다름 — 사이즈만 보지 말고 세대 확인",
      ],
      authentication: ["나이키 매장/무신사 영수증"],
    },
    "adidas-yeezy": {
      detectKeywords: ["이지", "yeezy", "yzy", "boost 350", "boost 700"],
      skuIdPrefixes: ["shoe-adidas-yeezy", "shoe-yeezy"],
      label: "아디다스 이지 (Yeezy)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "박스 사이드 라벨 — 스타일 번호 (예: BB1826) + 사이즈가 안창과 일치",
        "Boost 솔 — 정품은 입자 균일하고 단단, 가품은 푸석하거나 입자 큼",
        "사이드 'SPLY-350' 글자 — 정품은 굵기 일정, 가품은 미묘하게 가늘거나 두꺼움",
        "안창 'YEEZY' 각인 — 깊이 균일, 가품은 얕거나 부분만 진함",
        "혀 라벨 — 'Adidas + Kanye West' (구 모델) 또는 'YEEZY' (신 모델) 폰트",
      ],
      marketRisks: [
        "2022년 Adidas-Kanye 결별 이후 발매분 = 가품 위험 최상위 (정품 공급 끊김)",
        "350 V2 인기 컬러 (Zebra, Cream, Beluga) = 가품 비율 60%+",
        "사이즈 작게 나옴 — 평소보다 0.5 사이즈 ↑ 권장 (셀러 매물 사이즈 표기 확인)",
      ],
      authentication: [
        "KREAM 검수 카드 (필수 권장)",
        "Stockx Verified",
        "Goat 인증",
      ],
    },
    "adidas-samba": {
      detectKeywords: ["삼바", "samba"],
      skuIdPrefixes: ["shoe-adidas-samba"],
      label: "아디다스 삼바 (Samba)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "사이드 3-stripe — 정품은 간격 정확히 균일, 가품은 첫번째와 세번째 라인 간격 다름",
        "혀 'SAMBA' 자수 — 글자 간격 + 굵기 균일",
        "T자 토 패치(앞코 보호) — 정품은 가죽 두꺼움 + 봉제 균일, 가품은 얇고 봉제 들뜸",
        "박스 사이드 라벨 + 안창 스타일 번호 일치 (예: B75807)",
        "안창 'adidas' 폰트 + 'Made in Indonesia/Vietnam' 국가 표기",
      ],
      marketRisks: [
        "2024년 인기 폭발 이후 가품 매물 급증 (특히 OG 컬러)",
        "사이즈 작게 나옴 — 0.5~1 사이즈 ↑ 권장",
        "스웨이드(suede) 변색 — 흰색 처음 신었을 때 누렇게 변하는 경향",
      ],
      authentication: ["KREAM 검수", "아디다스 매장 영수증"],
    },
    "adidas-gazelle": {
      detectKeywords: ["가젤", "gazelle"],
      skuIdPrefixes: ["shoe-adidas-gazelle"],
      label: "아디다스 가젤 (Gazelle)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "사이드 3-stripe — 간격 균일 + 끝부분 마감 매끈",
        "혀 'GAZELLE' 자수 + 'adidas' 트레포일 로고",
        "안창 폰트 + 'Made in' 국가 표기",
        "스웨이드 표면 결 — 정품은 짧고 균일, 가품은 길거나 들뜸",
        "박스 라벨 스타일 번호 + 컬러 코드 일치",
      ],
      marketRisks: [
        "Indoor / Bold / Classic 버전 구분 필요 — 사이즈감 다름",
        "스웨이드는 비/눈 약함 — 사용감 + 보관 상태 확인",
      ],
      authentication: ["KREAM 검수", "아디다스 매장 영수증"],
    },
    "newbalance": {
      detectKeywords: ["뉴발", "newbalance", "new balance", " nb ", "nb530", "nb990", "nb992", "nb993", "nb2002", "nb9060"],
      skuIdPrefixes: ["shoe-newbalance", "shoe-nb"],
      label: "뉴발란스 (530/990/2002R/9060)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "안창 'Made in USA' / 'Made in UK' 라벨 — 990/992/993/1906/2002R 라인은 미국제, 530은 베트남/인도네시아",
        "사이드 N 로고 — 정품은 두께 균일, 가품은 곡선 끝 뭉툭하거나 두께 차이",
        "박스 사이드 라벨 — 스타일 번호 (예: M990GL5) + 사이즈가 안창과 일치",
        "혀 'New Balance' 폰트 + 모델 번호 자수 — 균일성",
        "정품 990 라인은 'ENCAP' 또는 'ABZORB' 쿠셔닝 각인이 솔 측면에 있음",
      ],
      marketRisks: [
        "990 시리즈 = 미국제(MADE IN USA) vs 해외 OEM 가격 2배 차이 — 라벨 사진 필수",
        "2002R / 9060 인기 컬러 (회색/실버) = 가품 비율 40%+",
        "스웨이드/메쉬 사용감 — 색바램, 메쉬 찢어짐 확인",
      ],
      authentication: ["KREAM 검수", "뉴발란스 공식 매장 영수증", "ABC마트 영수증"],
    },
    "converse-chuck": {
      detectKeywords: ["컨버스", "converse", "척테일러", "chuck taylor", "chuck 70", "chuck70"],
      skuIdPrefixes: ["shoe-converse-chuck"],
      label: "컨버스 척테일러 (Chuck 70 / All Star)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "토 캡(앞코 고무) — 정품 Chuck 70 은 크림색이며 두툼, 가품은 흰색이거나 얇음",
        "사이드 라인(미드솔) — 정품은 검정선이 정확히 2줄, 가품은 1줄이거나 두께 다름",
        "혀 안쪽 라벨 — 정품 'All Star' 별 로고 + 스타일 번호 + 사이즈 (US/UK/EU 3종)",
        "발등 'All Star' 패치 — 별 모양 5각형 정확, 가품은 별이 찌그러져 있음",
        "솔(바닥) 다이아몬드 패턴 — 정품은 격자 균일, 가품은 찌그러짐",
      ],
      marketRisks: [
        "Chuck 70 vs 일반 척테일러 시세 차이 큼 — Chuck 70 이 ₩3~5만 비쌈",
        "캔버스(천) 사용감 — 누렁/흰색 변색 흔함",
        "굽창(고무) 갈라짐 — 1년+ 사용 매물 흔함",
      ],
      authentication: ["KREAM 검수", "컨버스 매장/ABC마트 영수증"],
    },
    "vans-oldskool": {
      detectKeywords: ["반스", "vans", "올드스쿨", "old skool", "오쏘리티", "authentic", "sk8-hi", "sk8hi"],
      skuIdPrefixes: ["shoe-vans"],
      label: "반스 (Old Skool / Authentic / Sk8-Hi)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "사이드 흰색 스트라이프(자즈 스트라이프) — 정품은 굵기 균일, 가품은 가늘거나 끝부분 비대칭",
        "혀 'VANS OFF THE WALL' 라벨 — 폰트 균일",
        "안창 — 'VANS' 브랜드 각인 + 사이즈 표기 정확",
        "솔(워플 솔) — 정품은 다이아몬드 격자 균일, 가품은 격자 어긋남",
        "박스 사이드 라벨 — 스타일 번호 + 컬러 코드",
      ],
      marketRisks: [
        "캔버스 색바램/때 — 흰색 라인 누렁 흔함",
        "사이즈 크게 나옴 — 평소보다 0.5 사이즈 ↓ 권장",
      ],
      authentication: ["반스 매장/ABC마트 영수증", "KREAM 검수"],
    },
    "ugg-classic": {
      detectKeywords: ["어그", "ugg", " ugg "],
      skuIdPrefixes: ["shoe-ugg"],
      label: "어그 (UGG Classic Short/Mini/Tall)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "발목 안쪽 'UGG' 라벨 — 정품은 흰 바탕에 검정 자수, 폰트 균일",
        "박스 사이드 + 안창 시리얼 번호 일치 (예: 1016223-CHE)",
        "안감 양털(쉽스킨) — 정품은 한 장 통가죽, 가품은 조각 이어붙임",
        "솔(밑창) — 정품은 'UGG' 각인 깊고 균일, 가품은 얕음",
        "박스 — 정품은 갈색 박스 + 'UGG Australia' 로고 + 시리얼 라벨",
      ],
      marketRisks: [
        "Classic Short/Mini/Tall 시세 다름 (Short ₩15~20만 / Tall ₩25~30만 정도)",
        "물에 약함 — 비/눈 자국, 안감 더러움 확인",
        "양털 눌림 (사용감) — 사진으로 안감 사진 요청 권장",
      ],
      authentication: ["UGG 공식몰/백화점 영수증", "현대/신세계 백화점 정품 인증"],
    },
    "drmartens-1460": {
      detectKeywords: ["닥터마틴", "dr.martens", "dr martens", "마틴", "1460", "2976"],
      skuIdPrefixes: ["shoe-drmartens"],
      label: "닥터마틴 (1460 / 2976 Chelsea)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "노란색 봉제선 — 정품은 솔과 갑피 사이 9~10땀, 가품은 6~7땀 또는 불균일",
        "뒷꿈치 'AirWair WITH Bouncing SOLES' 라벨 — 흰 바탕에 노랑+검정 글씨, 폰트 균일",
        "안창 'Dr. Martens' 각인 + 사이즈 (UK 사이즈)",
        "솔(밑창) 다이아몬드 패턴 + 'AirWair' 로고 깊이 균일",
        "갑피 가죽 — 정품은 두꺼운 'Smooth Leather', 가품은 얇거나 비닐 느낌",
      ],
      marketRisks: [
        "사이즈 표기 = UK 사이즈 (US/한국 사이즈와 다름) — 사이즈 환산 주의",
        "신어서 길들이는 기간 필요 — '하루 신고 안 맞아서 팔아요' 매물 = 거의 사용감 적음",
        "굽창(고무) 마모 — 솔 측면 사진 필수",
      ],
      authentication: ["닥터마틴 공식몰/백화점 영수증", "KREAM 검수"],
    },
    "puma": {
      detectKeywords: ["푸마", "puma", "팔레르모", "palermo", "스피드캣", "speedcat"],
      skuIdPrefixes: ["shoe-puma"],
      label: "푸마 (Palermo / Speedcat / Suede)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "사이드 'PUMA' 폼스트라이프 — 곡선 균일, 끝부분 매끈",
        "혀 PUMA 라벨 — 폰트 균일",
        "안창 사이즈 + 'PUMA' 브랜드 각인",
        "박스 + 안창 스타일 번호 일치",
      ],
      marketRisks: [
        "스웨이드 변색 — 흰색은 누렁 흔함",
        "Palermo 인기 컬러는 KREAM 시세 변동 큼",
      ],
      authentication: ["푸마 매장 영수증", "KREAM 검수"],
    },
    "hoka": {
      detectKeywords: ["호카", "hoka", "본디", "bondi", "클리프턴", "clifton", "speedgoat"],
      skuIdPrefixes: ["shoe-hoka"],
      label: "호카 (Bondi / Clifton / Speedgoat)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "박스 + 안창 사이즈/스타일 번호 일치 (호카는 가품 거의 없음 — 시세 낮음)",
      ],
      marketRisks: [
        "러닝화 — 마일리지 (km) 확인. 500km+ 사용은 쿠셔닝 죽음",
        "Bondi 8/9 vs Clifton 9/10 세대 다름 — 모델 확인 필수",
        "사이즈 정사이즈로 나옴 (페가수스보다 약간 큼)",
      ],
      authentication: ["호카 공식몰/무신사 영수증"],
    },
    "asics": {
      detectKeywords: ["아식스", "asics", "젤 ", "gel-", "gel "],
      skuIdPrefixes: ["shoe-asics"],
      label: "아식스 (Gel 시리즈)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "박스 + 안창 사이즈/스타일 번호 일치 (아식스는 가품 거의 없음)",
      ],
      marketRisks: [
        "러닝화/패션화 구분 (GEL-1130/Kayano 등) — 모델 확인",
        "마일리지 확인",
        "최근 GEL-1130 패션 라인 인기 — 시세 ↑",
      ],
      authentication: ["아식스 공식몰/매장 영수증"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// clothing — Wave B
// ─────────────────────────────────────────────────────────────────────────
// 근거:
//   - Arcteryx: Bird-aid 라벨 폰트 + GORE-TEX 4면 박음질 (외부 review 직접 인용)
//   - Stone Island: compass 패치 안주머니 인증 카드 — 진품/짭 가장 자주 변별되는 포인트
//   - Supreme/Stussy/BAPE: 한국 중고시장 가품 비율 매우 큰 스트릿 브랜드
//   - Polo Ralph Lauren / Lacoste / MLB cap: 가품 흔함 (catalog에 大量 등록)
//   - Patagonia / TNF: 아웃도어 — 짭 라벨 + supreme 콜라보 가품 위험
//   - FOG Essentials: 한국 인기 폭발 후 가품 매물 급증
//   - Acne / Maison Margiela / Loewe / AMI: 명품 가품 — 안주머니 시리얼/태그 변별

const CLOTHING: CategoryBrandDepth = {
  category: "clothing",
  default: {
    counterfeitRisk: "moderate",
    counterfeitChecks: [
      "내부 라벨 (브랜드/사이즈/소재 표기) — 폰트 균일성 + 봉제선",
      "워시 라벨 (세탁 기호) — 한글/영문 표기 정확성",
      "안감 시리얼/홀로그램/RFID 코드 (브랜드별 위치 다름)",
    ],
    marketRisks: [
      "사이즈 (브랜드별 사이즈감 다름) — 평소 사이즈로 X. 실측 cm 또는 라벨 사진 필수",
      "보풀/색바램/오염 — 사진 클로즈업 요청",
      "FW vs SS 시즌 — 같은 모델이라도 시즌 시세 차이 큼",
    ],
    authentication: ["KREAM 검수 (의류 일부 모델 가능)", "백화점/공식몰 영수증"],
  },
  brands: {
    "arcteryx": {
      detectKeywords: ["아크테릭스", "아크", "arcteryx", "arc'teryx", "arc teryx", "벌릴리테", "베타", "알파", "감마", "아톰"],
      skuIdPrefixes: ["clothing-arcteryx"],
      label: "아크테릭스 (Arcteryx)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Bird-aid 라벨 (안주머니) — 정품은 새 로고 + 'BIRD AID' 텍스트 폰트 굵기 균일, 가품은 글자 굵기 미세 차이",
        "GORE-TEX 라벨 봉제 — 정품은 4면 박음질 (사각 둘레 모두 봉제), 가품은 2~3면만 봉제",
        "안감 시리얼 코드 vs 외부 행택(行tag) 시리얼 일치 — 두 위치 동일해야 함",
        "지퍼 'WS' (Watertight Seal) 각인 — 정품 RIRI/YKK 지퍼 손잡이 안쪽에 각인 있음",
        "Hanger Loop (옷걸이 고리) — 정품은 두꺼운 black 직사각, 가품은 얇거나 색 차이",
        "행택 QR/시리얼 — 아크테릭스 공식 사이트에서 시리얼 조회 가능 (`arcteryx.com/serial`)",
      ],
      marketRisks: [
        "Beta AR / Alpha SV / Atom LT — 모델별 사이즈감 다름 (Beta = relaxed, Alpha = athletic)",
        "Vertex Squamish 같은 한정/콜라보 = 가품 위험 최상위 + 시세 변동 큼",
        "GORE-TEX 라이너 손상 — 빨래 너무 자주 하면 발수성 사라짐. 신품 발수성 시연 권장",
        "오래된 모델(2015 이전)은 라이너 누수 가능 — 안감 사진 필수",
      ],
      authentication: [
        "아크테릭스 공식 매장 (영수증)",
        "공식 사이트 시리얼 조회 (`arcteryx.com/serial`)",
        "수입원 영수증 (한국: 영원아웃도어)",
      ],
    },
    "stoneisland": {
      detectKeywords: ["스톤아일랜드", "스톤", "stone island", "stoneisland", "stone-island"],
      skuIdPrefixes: ["clothing-stoneisland"],
      label: "스톤아일랜드 (Stone Island)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Compass 패치 (왼팔/가슴) — 정품은 노란 바탕에 검정 나침반 + 봉제 4면 균일, 가품은 봉제 일부 들뜸",
        "안주머니 인증 카드 (Authentication Card) — DPP 코드/QR 또는 'Certilogo' 코드 부착",
        "Certilogo 앱/사이트 (`certilogo.com`)에서 코드 조회 → 'AUTHENTIC' 결과 캡처 요청",
        "안주머니 라벨 시리얼 + 워시 라벨 사이즈/소재 표기 정확성",
        "RFID 태그 (최근 모델) — 안주머니 작은 태그 형태",
        "Compass 패치 단추 — 정품은 4구멍 + 봉제 흔적, 가품은 단순 봉제 또는 글루",
      ],
      marketRisks: [
        "Shadow Project / Stellina (염색) 라인 = 시세 매우 높음 + 가품 위험 최상위",
        "패치 떨어진 매물 = 거의 가품 (정품 봉제는 잘 안 떨어짐)",
        "워시 후 색바램 — 검정/네이비는 회색 변색 흔함",
      ],
      authentication: ["Certilogo 코드 조회 (필수 권장)", "공식 매장/한국 수입원 영수증"],
    },
    "moncler": {
      detectKeywords: ["몽클레르", "몽클", "moncler"],
      skuIdPrefixes: ["clothing-moncler"],
      label: "몽클레르 (Moncler)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Tricolor (이탈리아 국기) 패치 — 왼팔 또는 가슴. 정품은 봉제 4면 균일",
        "안주머니 인증 카드 + DPP (Digital Product Passport) 코드 — `moncler.com/dpp` 에서 조회",
        "안주머니 시리얼 라벨 + 'MADE IN' 국가 표기",
        "로고 자수 — 정품 'MONCLER' 폰트 균일, 가품은 'C' 곡선 미세 차이",
        "라이너 — 정품 다운(거위털) 90/10 비율 (다운 90%/페더 10%) 표기 정확",
        "지퍼 — 정품 Lampo 지퍼 (이탈리아) 'LAMPO' 각인",
      ],
      marketRisks: [
        "Maya / Hermine / Liane 인기 모델 = 가품 비율 50%+",
        "다운 손상/뭉침 — 사용 1~2년 후 다운 뭉치는 매물 흔함",
        "겨울철 시세 ↑↑ (3~4월 시세 -20%)",
      ],
      authentication: [
        "Moncler DPP 코드 조회 (필수 권장)",
        "백화점 (현대/신세계/롯데) 영수증 + 정품 보증서",
      ],
    },
    "supreme": {
      detectKeywords: ["슈프림", "supreme", "박스로고", "box logo", "bogo"],
      skuIdPrefixes: ["clothing-supreme"],
      label: "슈프림 (Supreme)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "BOX 로고 (Box Logo) — 'Supreme' 폰트는 'Futura Heavy Oblique', 글자 기울기 + 두께 균일. 가품은 'S' 곡선 또는 'p' 디센더 미세 다름",
        "내부 라벨 — 시즌 태그 (예: 'F/W 18', 'S/S 22') + 사이즈. 정품은 라벨 4면 봉제 균일",
        "워시 라벨 - 'MADE IN CANADA/USA' 표기. 한국 발매는 거의 없음 (해외 구매 매물 위주)",
        "박스 로고 봉제 — 정품은 9~10땀, 가품은 6~7땀 또는 봉제선 들뜸",
        "행택 — 정품은 빨간 종이 + 흰색 'Supreme' 로고. 가품은 종이 두께 얇음",
      ],
      marketRisks: [
        "Box Logo Tee = 가품 비율 80%+ (가장 많이 카피되는 모델)",
        "한국 정식 발매 X — 발매주 (drop) 직접 사거나 reseller 통해야 함. 발매주 인증 영상/스샷 권장",
        "사이즈 작게 나옴 (US 사이즈 기반) — 한국 표기와 다름",
        "콜라보 (Supreme × LV / Nike / TNF) = 시세 변동 큼 + 가품 위험 최상위",
      ],
      authentication: [
        "Legit Check by CG / Real Authentication 같은 인증 서비스",
        "KREAM 검수 (일부 모델만 가능)",
        "발매주 영수증 (Supreme NYC/LA/London 매장) 또는 Online drop 결제 스샷",
      ],
    },
    "stussy": {
      detectKeywords: ["스투시", "스튜시", "stussy", "stüssy"],
      skuIdPrefixes: ["clothing-stussy"],
      label: "스투시 (Stüssy)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Stussy 로고 폰트 — 정품은 'S'의 두꺼운 부분이 균일 곡선, 가품은 'S' 곡선 끝 뾰족함",
        "프린트 톤/색감 — 정품 silkscreen 프린트는 균일하고 살짝 두꺼움. 가품은 잉크 얇거나 번짐",
        "내부 라벨 — 'Stussy' + 사이즈 + 'MADE IN' (China/Mexico/India). 정품은 라벨 4면 봉제",
        "워시 라벨 폰트 + 소재 표기 (cotton 100% / cotton 60% poly 40% 등) 정확",
        "Stussy 8-Ball 모델 — 8 숫자 폰트 굵기 균일",
      ],
      marketRisks: [
        "Basic Tee = 디자인 단순 + 가품 카피 쉬움. 시즌 태그 + 영수증 권장",
        "Nike/Dior 콜라보 = 가품 비율 60%+",
        "보풀/색바램 흔함 (코튼 100% 모델)",
      ],
      authentication: ["KREAM 검수 (일부 모델)", "Stüssy Chapter 매장 영수증 (해외)"],
    },
    "bape": {
      detectKeywords: ["베이프", "bape", "베이핑에이프", "a bathing ape", "샤크후디", "샤크 후디"],
      skuIdPrefixes: ["clothing-bape"],
      label: "베이프 (BAPE / A Bathing Ape)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Shark Hoodie 카모 패턴 — 정품은 가지각색 모양이 자연스럽게 배치, 가품은 패턴 반복/위치 어긋남",
        "Shark Hoodie 지퍼 각인 'BAPE' — 지퍼 손잡이 안쪽에 각인 있음. 가품은 각인 없거나 위치 다름",
        "Shark face (눈 자수) — 정품은 눈 자수가 깔끔, 가품은 실밥 들뜸 또는 눈 위치 비대칭",
        "내부 라벨 — 'A BATHING APE' 폰트 + 'MADE IN' (Japan/China). 정품은 라벨 흰색 + 봉제 균일",
        "Ape Head 자수 (가슴/뒤) — 정품 자수 밀도 높음, 가품은 자수 듬성듬성",
        "워시 라벨 — 일본어 + 영어 병기. 한국어만 있으면 가품 의심",
      ],
      marketRisks: [
        "Shark Full Zip Hoodie = 가품 비율 70%+",
        "STA (Bape Star) 운동화 카테고리 X — 의류만 처리",
        "콜라보 (BAPE × Undefeated / Coca-Cola) = 시세 변동 큼",
      ],
      authentication: ["BAPE 공식 매장 (도쿄/한국 청담) 영수증", "KREAM 검수 (한정)"],
    },
    "palace": {
      detectKeywords: ["팔라스", "palace", "tri-ferg", "triferg"],
      skuIdPrefixes: ["clothing-palace"],
      label: "팔라스 (Palace)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Tri-Ferg 트라이앵글 로고 — 정품은 3D 음영 효과 + 'PALACE' 글자 균일, 가품은 평면적이거나 글자 두께 다름",
        "내부 라벨 — 'PALACE' 폰트 + 시즌 태그 (예: 'WINTER 21'). 정품은 라벨 봉제 균일",
        "워시 라벨 — 'MADE IN PORTUGAL/CANADA' 표기 (한국 정식 발매 X)",
        "프린트 — 정품 silkscreen 두께 + 광택. 가품은 광택 없거나 잉크 얇음",
      ],
      marketRisks: [
        "한국 정식 발매 X — 영국/미국 drop 또는 reseller 통해 들어온 매물 위주",
        "콜라보 (Palace × Adidas / Polo / Calvin Klein) = 가품 위험 최상위",
      ],
      authentication: ["Palace 공식몰 영수증 (영국)", "Dover Street Market 영수증"],
    },
    "carhartt": {
      detectKeywords: ["칼하트", "carhartt", "wip"],
      skuIdPrefixes: ["clothing-carhartt"],
      label: "칼하트 WIP (Carhartt Work In Progress)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "C 로고 패치 (왼팔/가슴) — 정품은 정사각 패치 + 봉제 4면 균일, 가품은 패치 모서리 둥글거나 봉제 들뜸",
        "내부 라벨 — 'Carhartt WIP' (US 라인은 'Carhartt'만) + 사이즈. WIP은 유럽 라이센스 (한국 정식)",
        "워시 라벨 — 다국어 (영/프/독/이) 병기. 한국어만 있으면 가품 의심",
        "지퍼 — 정품 YKK 지퍼 (대형 사이즈), 가품은 무명 지퍼",
        "라벨 폰트 'Carhartt' — 'a' 의 곡선이 둥글고 균일",
      ],
      marketRisks: [
        "Carhartt WIP (유럽/한국 라인) vs Carhartt (US 워크웨어) 구분 — 같은 브랜드라도 가격/디자인 다름",
        "Detroit Jacket / Active Jacket = 시즌 인기. 가짜 더크(Duck) 원단 흔함 — 두께/감촉 확인",
      ],
      authentication: ["Carhartt WIP 공식 매장 (한국 청담/홍대) 영수증", "무신사 영수증"],
    },
    "fog-essentials": {
      detectKeywords: ["fog", "essentials", "fear of god", "에센셜", "피오지"],
      skuIdPrefixes: ["clothing-fog-essentials", "clothing-fog"],
      label: "Fear of God Essentials (FOG)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "고무 'ESSENTIALS' 패치 — 정품은 두께 균일 + 글자 굵기 일정, 가품은 글자 굵기 미세 차이 또는 'S' 곡선 다름",
        "반사(reflective) 인쇄 — 정품은 어두운 곳에서 빛 반사 정확, 가품은 반사 없거나 약함",
        "내부 라벨 — 'Fear of God Essentials' 풀네임 + 사이즈. 가품은 'FOG' 만 표기 또는 폰트 다름",
        "안주머니 워시 라벨 — 'MADE IN CHINA' + 소재 표기 (cotton 80% poly 20% 등) 정확",
        "행택 — 정품은 양면 종이 + 'Essentials' 로고 + 시즌 코드. 가품은 한면만 인쇄",
      ],
      marketRisks: [
        "한국 인기 폭발 (2022~) 이후 가품 매물 급증 — KREAM 인증 없으면 거래 위험",
        "FOG Essentials (저가 라인) vs Fear of God Main (고가 라인) 구분 — 가격대 10배 차",
        "보풀 흔함 — 코튼 + 폴리 혼방이라 짧은 사용감에도 보풀",
      ],
      authentication: [
        "KREAM 검수 (필수 권장 — 모델별 인증 가능)",
        "PacSun / Ssense 영수증 (해외)",
        "Fear of God 공식몰 영수증",
      ],
    },
    "patagonia": {
      detectKeywords: ["파타고니아", "patagonia", "레트로엑스", "retro-x", "신칠라", "synchilla", "딥파일"],
      skuIdPrefixes: ["clothing-patagonia"],
      label: "파타고니아 (Patagonia)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "P-6 로고 (왼가슴/뒤) — 정품 산 모양 5개 봉우리 + 'patagonia' 폰트 균일",
        "내부 라벨 — 'PATAGONIA' + 'FAIR TRADE CERTIFIED' (최근 모델) + 사이즈",
        "워시 라벨 — 다국어 (영/프/스/일) 병기. 한국어만 있으면 의심",
        "행택 — 갈색 재생지 + 검정 잉크. 모델 코드 (예: '23055') 표기",
        "지퍼 — 정품 YKK 또는 자체 'Patagonia' 각인",
      ],
      marketRisks: [
        "Retro-X / Deep Pile / Shell — 모델별 사이즈감 다름 (Retro-X = 헐렁, Shell = 슬림)",
        "후리스(fleece) 보풀 — 1~2년 사용 후 보풀 흔함",
        "헐떡 빛바램 (네이비/검정) — 햇빛 노출 매물 색감 확인",
      ],
      authentication: ["Patagonia 공식 매장 (한국 청담) 영수증", "백패커스 영수증"],
    },
    "tnf": {
      detectKeywords: ["노스페이스", "노스", "north face", "tnf", "the north face", "눕시", "nuptse", "마운틴자켓", "발토로"],
      skuIdPrefixes: ["clothing-tnf"],
      label: "노스페이스 (The North Face / TNF)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "TNF 로고 (왼가슴) — 정품은 'The North Face' + 반원 곡선 균일. 가품은 곡선 폭 미세 다름",
        "내부 라벨 — 'THE NORTH FACE' + 사이즈 + 'MADE IN' (Vietnam/China/Korea). 한국 라인은 'NF' 로고",
        "지퍼 — 정품 YKK Vislon 또는 자체 'TNF' 각인",
        "Supreme 콜라보 — Bird-aid 라벨 + 'Supreme' BOX 로고 일관성. 가품 가장 많음",
        "워시 라벨 폰트 + 'GORE-TEX' 인증 라벨 (Mountain Jacket / Mountain Light)",
        "Nuptse 다운 — 정품 750/800 fill power 표기 + 다운 비율 (90/10)",
      ],
      marketRisks: [
        "한국 NF (영원아웃도어) vs USA TNF vs JP TNF — 같은 모델이라도 라벨/가격 다름. 라벨 사진 필수",
        "Supreme × TNF 콜라보 = 가품 비율 80%+",
        "Nuptse 700/800 다운 — 사용 1~2년 후 다운 뭉침. 클로즈업 사진 확인",
        "Purple Label (일본 라인) = 한국 정식 발매 X. 일본 직구 위주",
      ],
      authentication: ["TNF 공식 매장 (한국 영원아웃도어) 영수증", "KREAM 검수 (한정 모델)"],
    },
    "polo-ralph-lauren": {
      detectKeywords: ["폴로", "polo", "랄프로렌", "ralph lauren", "rrl", "pony", "포니"],
      skuIdPrefixes: ["clothing-polo-", "clothing-rrl"],
      label: "폴로 랄프로렌 (Polo Ralph Lauren / RRL)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Pony 자수 (왼가슴) — 정품은 자수 밀도 높음 + 말 다리 + 폴로 스틱 형태 정확. 가품은 자수 듬성하거나 말 형태 변형",
        "내부 라벨 — 'POLO by RALPH LAUREN' (구) 또는 'POLO RALPH LAUREN' (신) + 사이즈",
        "워시 라벨 — 'MADE IN' (Vietnam/China/Peru/Hong Kong) + 소재 표기",
        "RRL (Double RL) 라인 — 별도 라벨 + 빈티지 가공. RRL 가품 위험 더 큼",
        "Big Pony (대형 포니 + 숫자) 모델 — 숫자 폰트 굵기 균일",
        "Bear (폴로 베어) 콜라보 — 곰 얼굴 자수 디테일 정확",
      ],
      marketRisks: [
        "Pony 자수 색상 (수십 가지) — 한정 색은 시세 ↑",
        "Pique Polo 사이즈 (US 사이즈 기반) — XS = 한국 95, S = 100, M = 105 정도",
        "RRL 데님 — 가품 적지만 빈티지 가공 정도 (워싱) 차이 큼",
        "MLB 콜라보 / Bear 콜라보 = 한정 시세 변동 큼",
      ],
      authentication: ["Polo 백화점 (현대/신세계/롯데) 영수증", "Polo 아울렛 영수증"],
    },
    "lacoste": {
      detectKeywords: ["라코스테", "lacoste", "악어"],
      skuIdPrefixes: ["clothing-lacoste"],
      label: "라코스테 (Lacoste)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "악어 로고 자수 (왼가슴) — 정품은 입이 벌어진 옆모습 + 자수 색감 균일 (녹색 그라데이션). 가품은 자수 평면적이거나 다리/꼬리 비율 어긋남",
        "내부 라벨 — 'LACOSTE' + 'L.12.12' (피케 모델) 또는 라인 코드 + 사이즈",
        "워시 라벨 — 'MADE IN' (Peru/France/China) + 소재 (코튼 100% Lacoste 피케)",
        "버튼(단추) — 정품은 자개 또는 무광 플라스틱 + 'LACOSTE' 각인. 가품은 광택 단추",
        "행택 — 흰색 종이 + 녹색 악어 로고. 모델 코드 + 사이즈 표기",
      ],
      marketRisks: [
        "Classic Pique Polo (L.12.12) = 가장 흔한 모델. 가품 비율 60%+",
        "사이즈 (FR 사이즈) — 2 = 한국 95, 3 = 100, 4 = 105 정도",
        "코튼 피케 보풀 — 1~2년 사용 후 흔함",
      ],
      authentication: ["라코스테 백화점/공식 매장 영수증", "병행수입 영수증 (수입원 확인 권장)"],
    },
    "mlb-cap": {
      detectKeywords: ["mlb", "엠엘비", "양키스", "yankees", "다저스", "dodgers", "ny캡", "la캡", "보스턴"],
      skuIdPrefixes: ["clothing-mlb"],
      label: "MLB Cap (한국 정식 라인)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "정면 팀 로고 자수 — 정품은 자수 밀도 高 + 팀 컬러 정확 (NY = 진한 네이비, LA = 로얄 블루)",
        "내부 라벨 — 'MLB' 로고 + 사이즈 (FREE / 55-59) + 'MADE IN CHINA/VIETNAM'",
        "뒷면 'MLB' 자수 또는 자수 패치 — 한국 정식은 영원무역 라인",
        "땀 흡수 밴드 (안쪽) — 정품 polyester 100% 표기 + 봉제 균일",
        "조절 strap (스냅백/벨크로) — 정품은 'MLB' 각인 또는 silver tone 매끈. 가품은 광택 차이",
        "행택 — 한국 정식은 영원아울렛/F&F 영수증 + 정품 보증 카드",
      ],
      marketRisks: [
        "한국 MLB (F&F 영원아울렛 라인) vs 미국 정품 MLB (New Era / Fanatics) 가격대 다름",
        "Gucci / Murakami / Nike 콜라보 = 가품 위험 최상위 + 시세 변동 큼",
        "오염/땀자국 — 흰색 모델은 안쪽 땀띠 변색 흔함",
      ],
      authentication: ["MLB 백화점/F&F 공식 매장 영수증", "KREAM 검수 (콜라보)"],
    },
    "acne": {
      detectKeywords: ["아크네", "acne", "acne studios"],
      skuIdPrefixes: ["clothing-acne"],
      label: "아크네 스튜디오 (Acne Studios)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Face 로고 패치 (대표 모델 — 머플러/맨투맨) — 정품은 패치 봉제 4면 균일 + 얼굴 표정 정확",
        "내부 라벨 — 'Acne Studios' 풀네임 + 사이즈 + 'MADE IN' (Portugal/Italy/Bulgaria)",
        "워시 라벨 — 다국어 병기 + RFID 태그 (최근 모델)",
        "행택 — 분홍색 종이 + 검정 로고. 모델 코드 + 시즌 표기",
        "지퍼 — 정품 YKK 또는 Lampo 지퍼",
      ],
      marketRisks: [
        "Face 머플러 (Canada Scarf) = 가품 多. 패치 봉제 + 양털 마감 확인",
        "데님 사이즈 (EU 사이즈) — 28 = 한국 28~29, 30 = 한국 30~31",
        "데님 워싱 정도 차이 큼 (같은 모델이라도 워싱 별로 시세 다름)",
      ],
      authentication: ["Acne Studios 공식 매장 (한국 청담) 영수증", "백화점 영수증"],
    },
    "maison-margiela": {
      detectKeywords: ["마르지엘라", "마르탱", "margiela", "mm6", "메종"],
      skuIdPrefixes: ["clothing-margiela", "clothing-mm6"],
      label: "메종 마르지엘라 (Maison Margiela / MM6)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Four-Stitch (4 스티치) — 외부 라벨에 흰색 실 4땀 자수 (Margiela 시그니처). 정품은 4땀 정확",
        "Numbers 라벨 (0~23) — 안주머니에 0~23 숫자 + 해당 라인 숫자에 동그라미 (예: '14' 동그라미 = 14라인 / 남성복)",
        "내부 라벨 — 'Maison Margiela' (구 'Martin Margiela') + 시즌 + 'MADE IN' (Italy/Romania)",
        "워시 라벨 — 다국어 + RFID 태그",
        "지퍼 — 정품 RIRI 또는 Lampo 지퍼 (이탈리아) 각인",
        "행택 — 흰색 종이 + 검정 'MAISON MARGIELA' 로고. 시즌 + 모델 코드 표기",
      ],
      marketRisks: [
        "Replica Sneakers 카테고리 X — 의류만 처리",
        "Tabi (타비) 신발 카테고리 X",
        "MM6 (디퓨전 라인) vs Maison Margiela (메인 라인) 가격대 5~10배 차",
        "한정 협업 (Margiela × Reebok / Salomon) = 시세 변동 큼",
      ],
      authentication: ["Maison Margiela 공식 매장 (한국 청담) 영수증", "백화점 영수증"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// smartphone — Wave D
// ─────────────────────────────────────────────────────────────────────────
// 특성: 전자제품 — **가품 거의 없음**. 진짜 위험 = 잠금/부품/IMEI.
//   - counterfeitChecks 항목은 "부품 교체/잠금 변별 포인트" 용도.
//   - marketRisks 는 잔여 보증/배터리 사이클/시세 차 등.
// 근거:
//   - Apple iPhone: 설정 > 일반 > 정보 > '부품 및 서비스 이력' (iOS 16.4+), checkcoverage.apple.com, *#06# IMEI
//   - Samsung Galaxy: 설정 > 휴대전화 정보 > 부품 정보 (One UI 7+), samsung.com/sec/support
//   - 통신사 KT/SKT/LGU+ IMEI 등록 차단 = 분실/도난폰

const SMARTPHONE: CategoryBrandDepth = {
  category: "smartphone",
  default: {
    counterfeitRisk: "low",
    counterfeitChecks: [
      "*#06# (단말 입력) — IMEI 조회. 통신사 매장에서 IMEI 정상/분실 여부 확인 가능",
      "박스 + 단말 시리얼/IMEI 일치 — 박스 라벨과 설정 화면 IMEI가 같아야 함",
      "공식 사이트 시리얼 조회 — Apple checkcoverage.apple.com / Samsung 멤버스 앱에서 등록 확인",
    ],
    marketRisks: [
      "iCloud / Google FRP 잠금 — 셀러 계정 해제 안 하면 사용 불가",
      "통신사 분실/도난 등록 — IMEI 차단 시 새 회선 등록 불가",
      "부품 교체 (액정/배터리/카메라) — 사제 부품 = 정품 보증 불가",
      "자급제 vs 통신사 약정폰 — 약정폰은 위약금/락 잔여 확인 필수",
    ],
    authentication: [
      "Apple checkcoverage.apple.com (시리얼 조회)",
      "삼성 멤버스 앱 / samsung.com/sec/support (IMEI 조회)",
      "통신사 매장 직접 방문 IMEI 조회",
    ],
  },
  brands: {
    "apple-iphone": {
      detectKeywords: ["아이폰", "iphone", "아이폰15", "아이폰16", "아이폰17", "iphone15", "iphone16", "iphone17"],
      skuIdPrefixes: ["iphone-"],
      label: "Apple 아이폰 (iPhone)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "설정 > 일반 > 정보 > '부품 및 서비스 이력' (iOS 16.4+) — 사제 부품 사용 시 '정품 부품 아님' 메시지 표시 (액정/배터리/카메라/Face ID 모듈 별도 표시)",
        "*#06# (단말 입력) — IMEI 조회. 받은 IMEI를 통신사 매장에서 등록/분실 여부 확인. 분실신고된 IMEI는 새 회선 등록 차단",
        "Apple checkcoverage.apple.com — 시리얼/IMEI 입력 후 'Apple ID 등록됨' (= iCloud 활성 = Activation Lock 가능성) + 잔여 보증/AppleCare+ 확인",
        "박스 라벨 IMEI/시리얼 vs 설정 > 정보 > IMEI/시리얼 일치 — 두 IMEI(IMEI1, IMEI2) 모두 비교",
        "설정 > 배터리 > 배터리 성능 — '최대 용량 %' 표시. 80% 미만이면 배터리 교체 필요 + '정점 성능 가능' 회색 = 배터리 노후",
      ],
      marketRisks: [
        "iCloud Activation Lock — 분실 신고된 매물은 영구 락. 직거래 시 셀러 Apple ID 로그아웃 시연 + '나의 찾기 해제' 확인 필수",
        "용량별 시세 차 큼 — 256GB vs 512GB 평균 ₩10~15만, 512GB vs 1TB ₩15~20만 차",
        "AppleCare+ 가입 매물 = 시세 ₩5~10만 ↑ (잔여 1년+ 매물 특히 가치 큼)",
        "Pro / Pro Max / Plus / mini — 모델별 시세 다름. 모델 정확히 확인 (15 Pro Max vs 15 Pro 시세 ₩20만+ 차)",
      ],
      authentication: [
        "Apple checkcoverage.apple.com — 시리얼 입력 + 잔여 보증 확인",
        "통신사 매장 IMEI 조회 (KT/SKT/LGU+ 어느 곳이든 가능)",
        "iOS 16.4+ '부품 및 서비스 이력' 화면 캡처 요청",
      ],
    },
    "samsung-galaxy": {
      detectKeywords: [
        "갤럭시",
        "galaxy",
        "갤s",
        "갤z",
        "갤플립",
        "갤폴드",
        "z플립",
        "z폴드",
        "노트10",
        "노트20",
        "galaxy note",
        "galaxy s",
        "galaxy z",
      ],
      skuIdPrefixes: ["galaxy-s", "galaxy-z-", "galaxy-note"],
      label: "Samsung 갤럭시 (Galaxy)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "설정 > 휴대전화 정보 > 부품 정보 (One UI 7+, Galaxy S24+) — 사제 액정/배터리 교체 시 '정품 부품 아님' 표시",
        "*#06# (단말 입력) — IMEI 조회. 통신사 매장에서 정상/분실 여부 확인",
        "Samsung 멤버스 앱 또는 samsung.com/sec/support — IMEI/시리얼 입력 후 보증 잔여 확인",
        "박스 라벨 IMEI/시리얼 vs 설정 > 휴대전화 정보 > IMEI/시리얼 일치 (Fold/Flip은 IMEI1, IMEI2 둘 다 비교)",
        "설정 > 배터리 및 디바이스 케어 > 배터리 — 배터리 상태 'Good' 외 'Bad/Replace' = 교체 필요",
      ],
      marketRisks: [
        "Google FRP (Factory Reset Protection) 잠금 — factory reset 후 이전 Google 계정 요구. 셀러 계정 해제 안 하면 사용 불가",
        "자급제 vs 통신사 약정폰 구분 — 통신사 폰은 위약금/약정 잔여/단말기 락 확인 필수 (확정기변 표기 매물 X)",
        "S펜 (Ultra/Note 모델) — 분실/배터리 교체 매물 흔함. S펜 충전/페어링 시연 권장",
        "Z Flip/Fold 폴딩 — 힌지 손상/메인 디스플레이 깨짐 흔함. 360° 펼침 시연 권장",
        "Samsung Care+ 가입 매물 = 시세 ₩5~10만 ↑",
      ],
      authentication: [
        "Samsung 멤버스 앱 IMEI 조회",
        "samsung.com/sec/support — IMEI/시리얼 조회",
        "통신사 매장 IMEI 등록 확인",
      ],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// tablet — Wave D
// ─────────────────────────────────────────────────────────────────────────
// 특성: smartphone 와 유사 (가품 거의 X). 진짜 위험 = iCloud/FRP 잠금 + 액정 + Pencil/S펜 호환.

const TABLET: CategoryBrandDepth = {
  category: "tablet",
  default: {
    counterfeitRisk: "low",
    counterfeitChecks: [
      "박스 + 단말 시리얼 일치 — Apple checkcoverage.apple.com / Samsung 멤버스 앱 조회",
      "설정 > Apple ID / Samsung 계정 — 셀러가 로그아웃 / Activation Lock / FRP 해제 시연",
      "액정 — 흰 화면/검정 화면으로 멍/LCD 줄/번인 확인. 사진 클로즈업 권장",
    ],
    marketRisks: [
      "iCloud / FRP 잠금 — 셀러 계정 해제 안 하면 paperweight",
      "액정 멍/LCD 줄/번인 — OLED 모델은 번인 흔함",
      "Apple Pencil / S펜 호환 — 모델별 페어링 다름 (Pencil 1/2/Pro 호환 모델 다름)",
      "Wi-Fi 모델 vs 셀룰러 모델 가격 차 (셀룰러 ₩10~15만 ↑)",
    ],
    authentication: [
      "Apple checkcoverage.apple.com (시리얼 조회)",
      "Samsung 멤버스 앱 / samsung.com/sec/support",
    ],
  },
  brands: {
    "apple-ipad": {
      detectKeywords: ["아이패드", "ipad", "ipad pro", "ipad air", "ipad mini", "아이패드 프로", "아이패드 에어", "아이패드 미니"],
      skuIdPrefixes: ["ipad-"],
      label: "Apple 아이패드 (iPad)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "설정 > Apple ID — 셀러 계정 로그아웃 + '나의 찾기 해제' 시연 (Activation Lock 해제). 직거래 시 즉시 확인",
        "설정 > 일반 > 정보 > 시리얼 + Apple checkcoverage.apple.com 조회 — 'Apple ID 등록됨' 표시 시 Activation Lock 가능성",
        "흰/검정 화면 풀스크린 — 액정 멍/LCD 누수/번인 확인 (Pro OLED는 번인 위험)",
        "셀룰러 모델은 *#06# 또는 설정 > 일반 > 정보 > IMEI 조회 가능 — 통신사 등록 확인",
        "박스 라벨 시리얼 vs 단말 시리얼 일치",
      ],
      marketRisks: [
        "Wi-Fi 모델 vs Wi-Fi + Cellular 모델 가격 차 ₩10~15만 (Cellular = 셀룰러 데이터 사용 가능)",
        "Apple Pencil 호환 — Pencil 1 (구 iPad), Pencil 2 (Pro 11~12.9 M2 까지), Pencil Pro (iPad Pro M4+ 전용). 모델별 호환 확인",
        "키보드/펜슬 풀세트 vs 본체만 — 풀세트는 ₩10~20만 ↑",
        "iPad Pro 11 vs 13 / Air 11 vs 13 — 사이즈/세대(M2/M3/M4) 별 시세 차 큼",
        "AppleCare+ 가입 매물 = ₩5~10만 ↑",
      ],
      authentication: [
        "Apple checkcoverage.apple.com — 시리얼 조회 + 잔여 보증 확인",
        "직거래 시 Activation Lock 해제 시연",
      ],
    },
    "samsung-tab": {
      detectKeywords: ["갤럭시탭", "galaxy tab", "galaxytab", "갤탭", "탭s", "tab s", "갤럭시 탭"],
      skuIdPrefixes: ["galaxy-tab-"],
      label: "Samsung 갤럭시 탭 (Galaxy Tab)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "설정 > Samsung 계정 — 셀러 로그아웃 + Google 계정 로그아웃 시연 (FRP 해제)",
        "Samsung 멤버스 앱 / samsung.com/sec/support — 시리얼 조회 + 보증 잔여 확인",
        "흰/검정 화면 풀스크린 — 액정 멍/LCD 누수/번인 확인 (Ultra OLED 번인 위험)",
        "S펜 페어링 — 설정 > 유용한 기능 > S펜 (블루투스 S펜은 페어링 확인). 배터리/충전 시연",
        "박스 라벨 시리얼 vs 단말 시리얼 일치",
      ],
      marketRisks: [
        "Google FRP 잠금 — 이전 Google 계정 로그아웃 안 하면 factory reset 후 사용 불가",
        "S펜 — 일반 S펜(Tab S6 Lite 등) vs 블루투스 S펜(Tab S9 Ultra 등) 모델별 다름. S펜 분실 매물 흔함",
        "Wi-Fi vs LTE/5G 모델 가격 차 ₩10~15만",
        "키보드 커버 풀세트 매물 = ₩5~15만 ↑",
        "Samsung Care+ 가입 매물 = ₩5~10만 ↑",
      ],
      authentication: [
        "Samsung 멤버스 앱 시리얼 조회",
        "samsung.com/sec/support 보증 조회",
      ],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// laptop — Wave D
// ─────────────────────────────────────────────────────────────────────────
// 특성: 가품 거의 X. 진짜 위험 = iCloud/MS 계정 락 + 부품 교체 + 키보드/배터리 노후 + GPU/쿨링.
//   - MacBook 통합 메모리 (M1+): 램/SSD 자체 교체 불가, 부품 정보 macOS에서 확인
//   - Windows: 자체 교체 가능 — 정품 vs 사제 구분 어려움, msinfo32 + GPU-Z + CrystalDiskInfo

const LAPTOP: CategoryBrandDepth = {
  category: "laptop",
  default: {
    counterfeitRisk: "low",
    counterfeitChecks: [
      "박스 + 단말 시리얼 일치 — macOS: '이 Mac에 관하여' / Windows: msinfo32 (시스템 정보)",
      "Apple checkcoverage.apple.com / 제조사 보증 사이트 시리얼 조회",
      "BIOS / 펌웨어 비밀번호 잠금 여부 확인 (해제 어려움)",
    ],
    marketRisks: [
      "iCloud Activation Lock (Mac) / Microsoft 계정 락 (Windows) — 셀러 로그아웃 필수",
      "배터리 사이클 — 사용감 X 실제 마모. Coconut Battery (Mac) / BatteryInfoView (Windows) 확인 권장",
      "액정 멍/번인 / 키보드 눌림 / 트랙패드 동작",
      "SSD 사용 시간 — CrystalDiskInfo (Windows) / macOS '시스템 정보 > 저장 장치'",
      "게이밍 노트북 = GPU 장기 고온 손상 + 쿨링 팬/먼지 노후 위험 ↑",
    ],
    authentication: [
      "Apple checkcoverage.apple.com",
      "제조사 보증 사이트 (Samsung 멤버스 / LG 멤버십 / 레노보 보증)",
    ],
  },
  brands: {
    "apple-macbook": {
      detectKeywords: ["맥북", "macbook", "macbook air", "macbook pro", "맥북에어", "맥북프로", "맥북 에어", "맥북 프로"],
      skuIdPrefixes: ["macbook-"],
      label: "Apple 맥북 (MacBook Air / Pro)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "왼쪽 위 Apple 메뉴 > '이 Mac에 관하여' — 모델 (예: 'MacBook Air (M3, 13인치, 2024)'), 시리얼, 메모리, 저장공간, 그래픽 확인",
        "Apple checkcoverage.apple.com — 시리얼 입력 후 'Apple ID 등록됨' (Activation Lock 가능성) + 잔여 보증/AppleCare+ 확인",
        "macOS Sonoma+: 설정 > 일반 > 정보 > 부품 및 서비스 이력 — 사제 액정/배터리/로직보드 = '정품 부품 아님' 표시",
        "Coconut Battery (무료 앱) 또는 시스템 정보 > 전원 — 사이클 수 확인. M1+ 정상 1000 cycle / 80% 이상 잔여 정상",
        "키보드 모든 키 누름 시연 + 트랙패드 4면 클릭 — 2016~2019 버터플라이 키보드는 키 눌림/스티키 흔함",
      ],
      marketRisks: [
        "iCloud Activation Lock (T2 칩 + Apple Silicon 모델) — 셀러 Apple ID 로그아웃 + '나의 찾기 해제' 시연 필수",
        "M1/M2 vs M3/M4 세대 차 — M3+ 시세 ₩30~50만 ↑. 같은 'MacBook Air'라도 세대 정확히 확인",
        "통합 메모리 (M1+): 램/SSD 자체 교체 불가. 16GB vs 32GB / 256GB vs 512GB vs 1TB 시세 차 큼 (메모리 1단계 = ₩20~30만, SSD 1단계 = ₩15~25만)",
        "키보드 US vs KR 배열 — 한국 중고시장 KR 우월 (US 매물은 시세 ₩5~10만 ↓)",
        "AppleCare+ 가입 매물 = 시세 ₩10~20만 ↑",
        "OLED 모델 (Pro 14/16 M4 이후) — 번인 위험 (장시간 같은 화면 표시 매물 주의)",
      ],
      authentication: [
        "Apple checkcoverage.apple.com (시리얼 + AppleCare 잔여)",
        "직거래 시 'Apple ID 로그아웃' + '나의 Mac 찾기 해제' 시연",
        "macOS Sonoma+ 부품 및 서비스 이력 화면 캡처 요청",
      ],
    },
    "samsung-book": {
      detectKeywords: ["갤럭시북", "galaxy book", "갤북", "갤럭시 북"],
      skuIdPrefixes: ["galaxy-book-"],
      label: "Samsung 갤럭시북 (Galaxy Book)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "시작 > 시스템 정보 (msinfo32) — 모델/시리얼/CPU/RAM 확인. 박스 라벨 시리얼과 일치 확인",
        "Samsung 멤버스 앱 / samsung.com/sec/support — 시리얼 조회 + 보증 잔여 확인",
        "흰/검정 풀스크린 — 액정 멍/번인 확인 (AMOLED 모델 번인 위험)",
        "BatteryInfoView (무료) — 배터리 사이클 + 설계 용량 대비 잔여 용량 (Full charge capacity / Designed capacity)",
        "키보드 모든 키 + 터치패드 + 360 힌지 (2-in-1 모델) 시연",
      ],
      marketRisks: [
        "Microsoft 계정 락 — 윈도우 로그인 잠금 시 비밀번호 모르면 사용 불가. 셀러 계정 로그아웃/포맷 시연 필수",
        "BIOS 비밀번호 — 해제 어려움. 부팅 시 BIOS 진입 (F2/Delete) 시연 권장",
        "Galaxy Book 4 vs 5 / Pro vs Ultra — 사양 차 큼 (Ultra = 외장 GPU). 모델 정확히 확인",
        "삼성 페이/녹스 (Knox) 잠금 — 일부 모델 분실 신고 시 부팅 차단",
        "SSD/RAM 자체 교체 가능 — 사제 부품 교체 매물 흔함. CrystalDiskInfo 로 SSD 사용 시간 확인",
      ],
      authentication: ["Samsung 멤버스 앱 시리얼 조회", "samsung.com/sec/support 보증 조회"],
    },
    "lg-gram": {
      detectKeywords: ["lg 그램", "lg그램", "lg gram", "그램 17", "그램 16", "그램17", "그램16", "그램노트북", "그램 노트북"],
      skuIdPrefixes: ["lg-gram-"],
      label: "LG 그램 (LG gram)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "시작 > 시스템 정보 (msinfo32) — 모델/시리얼/CPU/RAM 확인. 박스 라벨과 일치",
        "LG 멤버십 앱 또는 lge.co.kr — 시리얼 조회 + 보증 잔여 확인",
        "흰/검정 풀스크린 — 액정 멍/픽셀 죽음 확인",
        "BatteryInfoView — 배터리 사이클 + 잔여 용량 확인 (그램은 가벼움 강조 라인 → 배터리 셀 작아 노화 빠를 수 있음)",
        "키보드 모든 키 + 터치패드 + 힌지 시연",
      ],
      marketRisks: [
        "Microsoft 계정 락 — 셀러 로그아웃/포맷 시연 필수",
        "BIOS 비밀번호 잠금 — 해제 어려움. 부팅 시 BIOS 진입 (F2) 시연 권장",
        "그램 17 vs 16 vs 15 — 사이즈별 시세 다름. 17인치는 휴대성 ↓ 시세 ↓",
        "연식별 시세 차 — 그램 2024 vs 2023 vs 2022 — Intel 세대 (12/13/14 Gen) 별 시세 ₩20~30만 차",
        "SSD/RAM 자체 교체 가능 — 사제 부품 매물 흔함",
      ],
      authentication: ["LG 멤버십 앱 시리얼 조회", "lge.co.kr 보증 조회"],
    },
    "microsoft-surface": {
      detectKeywords: ["서피스", "surface", "surface laptop", "surface pro", "surface book"],
      skuIdPrefixes: ["surface-"],
      label: "Microsoft Surface",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "msinfo32 (시스템 정보) — 모델/시리얼/CPU/RAM 확인",
        "Microsoft 공식 사이트 (account.microsoft.com/devices) — 기기 등록 + 보증 조회",
        "흰/검정 풀스크린 — 액정 멍/번인 확인",
        "BatteryInfoView — 배터리 사이클 (Surface는 배터리 일체형 → 마모 시 교체 어려움)",
        "Surface Pen 페어링 시연 (Surface Pro / Studio)",
      ],
      marketRisks: [
        "Microsoft 계정 락 — 셀러 로그아웃 + Bitlocker 해제 확인 필수",
        "Surface Pro vs Laptop vs Book — 폼팩터 다름. 타입 커버 풀세트 vs 본체만 시세 차 ₩10~15만",
        "배터리 일체형 — 마모 후 교체 비용 큼 (서비스 센터 의뢰)",
        "한국 정식 판매 매물 적음 — 미국/영국 직구 매물 위주. 키보드 배열 (US) + 보증 한국 적용 X",
      ],
      authentication: ["account.microsoft.com/devices 기기 등록 조회", "Microsoft 공식 매장 영수증"],
    },
    "lenovo-thinkpad": {
      detectKeywords: ["씽크패드", "thinkpad", "레노보", "lenovo", "x1 carbon", "x1carbon"],
      skuIdPrefixes: ["thinkpad-", "lenovo-"],
      label: "Lenovo ThinkPad",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "msinfo32 — 모델/시리얼 확인. ThinkPad는 모델 코드 (예: T14 Gen 4, X1 Carbon Gen 12) 명시 매물 권장",
        "Lenovo 공식 (pcsupport.lenovo.com) — 시리얼 입력 후 보증 잔여 + Premier Support 가입 여부 확인",
        "흰/검정 풀스크린 — 액정 멍/픽셀 죽음 확인",
        "BatteryInfoView — 배터리 사이클 + 마모도 (ThinkPad는 배터리 교체 가능 모델 多)",
        "키보드 모든 키 + TrackPoint (빨간 포인터) 시연",
      ],
      marketRisks: [
        "Microsoft 계정 락 + BIOS Supervisor Password — 두 락 모두 해제 어려움. 셀러 로그아웃/포맷 + BIOS 진입 시연 필수",
        "ThinkPad X1 Carbon vs T 시리즈 vs P (워크스테이션) vs E (저가) — 라인별 시세 차 큼",
        "Intel vs AMD Ryzen — 세대별 시세 다름. CPU 정확히 확인",
        "한국 정식 (레노보 코리아) vs 직구 — 직구는 보증 한국 적용 X, 키보드 US 배열",
        "기업 리스 반납 매물 多 — 사용 시간 ↑↑ 배터리/키보드 마모 흔함",
      ],
      authentication: ["pcsupport.lenovo.com 시리얼 조회", "Lenovo Vantage 앱"],
    },
    "gaming-laptop": {
      detectKeywords: [
        "게이밍",
        "게이밍 노트북",
        "게이밍노트북",
        "msi",
        "asus rog",
        "rog ",
        "asus tuf",
        "tuf ",
        "rtx 4060",
        "rtx 4070",
        "rtx 4080",
        "rtx 4090",
        "rtx4060",
        "rtx4070",
        "rtx4080",
        "rtx4090",
        "razer blade",
        "alienware",
        "acer predator",
        "predator helios",
      ],
      skuIdPrefixes: ["gaming-laptop-", "msi-", "asus-rog-"],
      label: "게이밍 노트북 (MSI / ASUS ROG / Razer / Alienware)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "msinfo32 — 모델/CPU/RAM 확인. GPU 정확히 확인 (RTX 4060 vs 4070 vs 4080 vs 4090 시세 차 ₩50~150만)",
        "GPU-Z (무료) — GPU 모델 + 메모리 + 코어 확인 (가짜 라벨 vs 실제 칩 확인 가능)",
        "CrystalDiskInfo — SSD 사용 시간. 1000시간+ = 장시간 사용 매물",
        "BatteryInfoView — 배터리 사이클 + 마모도 (게이밍 노트북은 충방전 사이클 多 매물 흔함)",
        "발열/팬 테스트 — 부팅 후 5분 idle 발열 + 게임 1판 (또는 부하 툴) 시연 권장",
      ],
      marketRisks: [
        "GPU 장기 고온 손상 — 게이밍은 GPU 80~90°C 장시간 작동 → 솔더링/메모리 손상 위험 ↑↑. 사용 환경 (스탠드/쿨러) 확인 권장",
        "쿨링 — 팬 먼지/노이즈 매물 흔함. 팬 풀가동 영상 권장 (이상한 소리 X)",
        "배터리 — 게이밍은 어차피 충전 상시 → 셀러가 배터리 무관심 매물 多. 마모 50%+ 흔함",
        "GPU 모델 (RTX 4060 vs 4070 vs 4080 vs 4090) + CPU (i7 vs i9 vs Ryzen 7 vs 9) 시세 차 큼. 모델 정확 확인",
        "1년 이상 사용 매물 = 키보드/스피커/팬 노후 흔함. 사용 시간 명시 매물 권장",
      ],
      authentication: ["제조사 공식 사이트 시리얼 조회 (MSI / ASUS / Razer)", "구매 영수증"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// bag — Wave C
// ─────────────────────────────────────────────────────────────────────────
// 명품 (LV/Chanel/Gucci/Hermes/Dior) — 가품 위험 매우 큼. 인증 서비스 권장.
// 등록된 SKU (TNF/Stussy/Margiela/Supreme/Carhartt/Acne 등) — 가품 위험 중간.

const BAG: CategoryBrandDepth = {
  category: "bag",
  default: {
    counterfeitRisk: "high",
    counterfeitChecks: [
      "라벨/태그 폰트 — 정품은 균일한 자간/굵기, 가품은 미세한 어긋남",
      "봉제선 간격 — 정품은 1cm당 일정 땀수, 가품은 불균일",
      "안감/가죽 결 — 정품은 모공/패턴 자연, 가품은 매끈하거나 균일 X",
      "시리얼/모델 번호 — 박스/태그/내부 라벨 3곳 일치 확인",
    ],
    marketRisks: [
      "정품 인증 서비스 (KREAM, 트렌비, MJ인증) 카드 동봉 매물 신뢰 ↑↑",
      "가짜 박스 / dust bag 도 흔함 — 박스 X도 정품 가능",
    ],
    authentication: ["KREAM 검수", "트렌비 정품 인증", "MJ인증 (한국)"],
  },
  brands: {
    "louis-vuitton": {
      detectKeywords: ["루이비통", "louis vuitton", "lv ", " lv,", "네버풀", "스피디", "키폴"],
      skuIdPrefixes: ["bag-lv", "bag-louis-vuitton"],
      label: "루이비통 (Louis Vuitton)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "데이트 코드 — 내부 가죽 탭 6자리 (2021 이전: 알파벳 2 + 숫자 4 / 2021 이후: 마이크로칩 RFID 매립)",
        "모노그램 패턴 — 정품은 꽃잎/LV 가운데 정확 배치, 가품은 패턴 어긋나거나 잘림",
        "스티치(봉제) — 정품 황금색 미세 잔잔, 가품은 굵거나 노란기 강함",
        "지퍼/금속 마감 — 정품은 'LV' 각인 깊이 균일 + 광택 일정",
        "내부 보일 가죽 — 정품은 모공 자연, 가품은 매끈하거나 PVC 광택",
      ],
      marketRisks: [
        "한정/콜라보 (LV x Murakami, Supreme, Yayoi Kusama) = 가품 위험 최상위 — 인증 없으면 거래 금지",
        "2021+ 마이크로칩 매물은 LV 공식 매장에서 칩 reading 가능 — 인증 ↑",
        "Speedy/Neverfull 흔한 가품 모델 — 정품 인증 카드 필수",
      ],
      authentication: ["KREAM 검수", "트렌비 정품 인증", "LV 공식 매장 RFID 칩 확인 (2021+ 모델)"],
    },
    "chanel": {
      detectKeywords: ["샤넬", "chanel", "클래식플랩", "보이샤넬", "19백"],
      skuIdPrefixes: ["bag-chanel"],
      label: "샤넬 (Chanel)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "시리얼 — 7자리 (Classic/Boy/19 등) 또는 8자리 (최신). 내부 시리얼 스티커 + 보증 카드 매칭",
        "퀼팅 패턴 — 정품은 다이아몬드 균일, 봉제선이 다이아몬드 꼭지점에서 정확히 만남",
        "CC 로고 금속 — 'CC'가 겹치는 부분 (오른쪽 C가 위) 일관",
        "체인 스트랩 — 가죽 weave 균일, 금속 무게감 (정품 무거움)",
        "지퍼 'CC' 각인 깊이 + 'YKK Excella' 또는 'Lampo' 마킹 확인",
      ],
      marketRisks: [
        "Classic Flap / Boy / 19 = 가품 매우 흔함 — 인증 카드 없으면 70%+ 의심",
        "샤넬 매장 AS 거부 = 가품 또는 그레이 마켓 (병행 수입) 매물",
        "보증 카드 시리얼 + 가방 내부 시리얼 매칭 (꼭 사진 비교)",
      ],
      authentication: ["KREAM 검수 + 인증 카드", "샤넬 공식 매장 AS 가능성 확인"],
    },
    "gucci": {
      detectKeywords: ["구찌", "gucci", "마몬트", "디오니소스", "재키"],
      skuIdPrefixes: ["bag-gucci"],
      label: "구찌 (Gucci)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "내부 시리얼 — 가죽 탭 2줄 (위: 6자리 모델 / 아래: 6자리 시리얼). 흰 가죽 + 검정 각인",
        "GG 모노그램 — 정품은 G가 살짝 떨어짐 (붙어있지 않음), 가품은 G가 너무 가까움",
        "Marmont/Dionysus 금속 마감 — 'Made in Italy' 각인 + 광택",
        "안감 — 정품은 면/캔버스 (베이지~카키), 가품은 폴리에스터 광택",
        "지퍼 — 'Lampo' 또는 'YKK' 마킹 (Lampo가 더 흔함)",
      ],
      marketRisks: [
        "Marmont 흔한 가품 모델 — KREAM 검수 권장",
        "Tom Ford 시대 (1994-2004) 빈티지는 진짜 가품 적음 (다른 마감)",
      ],
      authentication: ["KREAM 검수", "트렌비"],
    },
    "hermes": {
      detectKeywords: ["에르메스", "hermes", "켈리", "버킨", "에블린", "린디"],
      skuIdPrefixes: ["bag-hermes"],
      label: "에르메스 (Hermès)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "스탬프 — 'HERMÈS PARIS MADE IN FRANCE' 외 + 가죽 종류 표기 (Togo/Epsom/Box 등)",
        "년식 마크 — Square/Circle 안 알파벳 (예: A=2017, Z=2024)",
        "봉제 — 새들 스티치 (한 줄로 보이지만 양쪽에서 박는 방식). 정품 손바느질, 가품 기계바느질",
        "금속 마감 — Palladium/Gold 도금 + 무게감 (켈리 락 25g+)",
        "가죽 결 — Togo (자연 모공), Epsom (인쇄 패턴), Box (광택). 모델 매칭 필수",
      ],
      marketRisks: [
        "Kelly/Birkin = 가품 매우 흔함 — 매장 영수증 + 인증 필수",
        "리세일 가격 ₩2000만~수억원 — 인증 비용 (₩50만+) 들여도 회수 가능",
        "Hermès 공식 매장 AS = 정품 검증 도구. 가품 시 AS 거부",
      ],
      authentication: ["KREAM 검수 (켈리/버킨)", "Hermès 공식 매장 AS"],
    },
    "dior": {
      detectKeywords: ["디올", "dior", "북토트", "새들백", "레이디디올"],
      skuIdPrefixes: ["bag-dior"],
      label: "디올 (Dior)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "시리얼 — 가죽 탭 코드 (예: 02-MA-1234). 2 자리 = 월/주, 알파벳 2 = 공장, 4 = 시리얼",
        "CD 로고 폰트 + 자간 균일",
        "Cannage (퀼팅) 패턴 — Lady Dior 다이아몬드 정확, 가품은 패턴 크기 다름",
        "안감 — 양가죽 (lambskin) 부드러움, 가품은 매끈한 PU",
      ],
      marketRisks: [
        "Lady Dior / Saddle / Book Tote = 가품 흔함",
        "Cannage 모델 흠집 흔함 — 사용감 사진 필수",
      ],
      authentication: ["KREAM 검수", "트렌비"],
    },
    "goyard": {
      detectKeywords: ["고야드", "goyard", "쌩루이", "안조"],
      skuIdPrefixes: ["bag-goyard"],
      label: "고야드 (Goyard)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Y 헤링본 패턴 — 손으로 그린듯한 미세 변동 (정품), 가품은 기계 인쇄 균일",
        "내부 시리얼 — 가죽 탭 'Goyard' 각인",
        "캔버스 코팅 — 정품은 살짝 광택, 가품은 매트 또는 과한 광택",
      ],
      marketRisks: [
        "Saint Louis / Anjou = 가품 흔함 — 인증 권장",
        "맞춤 페인팅 가품도 흔함 (이니셜/스트라이프 추가 매물 검증 어려움)",
      ],
      authentication: ["트렌비", "MJ인증"],
    },
    "prada": {
      detectKeywords: ["프라다", "prada", "사피아노", "리나일론", "갤러리아"],
      skuIdPrefixes: ["bag-prada"],
      label: "프라다 (Prada)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "삼각 로고 — 정품은 살짝 입체 (양각), 가품은 평면 인쇄",
        "지퍼 — 'Lampo' / 'Riri' 마킹",
        "Saffiano 가죽 패턴 — 십자 사선 균일 (정품), 가품은 무늬 흐림",
        "Re-Nylon 매물 — 'Prada Re-Nylon' 라벨 + ECONYL® 표기 (재활용 나일론)",
      ],
      marketRisks: [
        "갤러리아 (Galleria) / Re-Edition = 가품 위험 중간 — 인증 권장",
        "1990년대 빈티지 = 진짜 가품 적음 (제조 방식 다름)",
      ],
      authentication: ["KREAM 검수", "트렌비"],
    },
    "celine": {
      detectKeywords: ["셀린느", "celine", "트리오페", "벨트백", "럭기지"],
      skuIdPrefixes: ["bag-celine"],
      label: "셀린느 (Celine)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "로고 — 옛 (Céline, 악센트 포함) vs 신 (CELINE) 구분",
        "시리얼 — 가죽 탭 'F-MA-...' 식 (Phoebe 시대) 또는 'CELINE...' (Hedi 시대)",
        "Triomphe 캔버스 — 패턴 균일",
      ],
      marketRisks: [
        "Phoebe Philo 시대 빈티지 = 시세 매우 높음 (단종으로 인한 희소성)",
        "Hedi Slimane 신상 = 가품 위험 늘어남",
      ],
      authentication: ["트렌비"],
    },
    "bottega-veneta": {
      detectKeywords: ["보테가", "bottega", "베네타", "카세트", "파우치"],
      skuIdPrefixes: ["bag-bottega"],
      label: "보테가 베네타 (Bottega Veneta)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Intrecciato (인트레치아토) 위빙 — 가죽 strip 너비 균일 (정품 일정 mm), 가품은 너비 다름",
        "시리얼 — 가죽 탭 'Bottega Veneta Made in Italy' + 6자리",
        "가죽 결 — Nappa (부드러움), 가품은 PU/PVC 광택",
      ],
      marketRisks: [
        "카세트 / 파우치 / Jodie = 가품 흔함",
        "인트레치아토 가품 = 위빙 풀리기 쉬움 (정품은 견고)",
      ],
      authentication: ["KREAM 검수", "트렌비"],
    },
    "loewe": {
      detectKeywords: ["로에베", "loewe", "퍼즐백", "햄목", "버킨", "고야"],
      skuIdPrefixes: ["bag-loewe"],
      label: "로에베 (Loewe)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Anagram 로고 — 4개 L 모양 균일 + 가운데 사각형 정확",
        "시리얼 — 가죽 탭 'Loewe Made in Spain' + 코드",
        "가죽 결 — Soft Calf (부드러움), Classic Calf (단단함). 모델 매칭",
      ],
      marketRisks: [
        "Puzzle Bag / Hammock = 인기 모델 가품 늘어나는 중",
        "수공예 마감 — 정품 봉제선 정확, 가품은 풀린 부분 보임",
      ],
      authentication: ["KREAM 검수", "트렌비"],
    },
    "margiela-bag": {
      detectKeywords: ["마르지엘라", "margiela", "마틴마르지엘라", "글램슬램", "5ac"],
      skuIdPrefixes: ["bag-margiela"],
      label: "메종 마르지엘라 (Maison Margiela)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Four-stitch — 외부 4개 흰 실 박음 (모델 시그니처). 모든 가방에 있음",
        "Numbers 라벨 — 0~23 라인 중 하나에 동그라미 (라인 표시)",
        "안감 'MM' 또는 'Maison Margiela' 라벨",
      ],
      marketRisks: [
        "Glam Slam / 5AC = 인기 모델",
        "리세일 시세 안정적 — 가품 적음",
      ],
      authentication: ["KREAM 검수"],
    },
    "supreme-bag": {
      detectKeywords: ["슈프림", "supreme", "박스로고"],
      skuIdPrefixes: ["bag-supreme"],
      label: "슈프림 가방 (Supreme)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "BOX 로고 — Futura Heavy Oblique 폰트 (clothing wave B 와 동일)",
        "지퍼 'YKK' 마킹 + Cordura/Nylon 안감",
        "시즌 태그 — 'SS' (봄여름) 또는 'FW' (가을겨울) + 연도",
      ],
      marketRisks: [
        "콜라보 (Supreme x TNF, LV, etc) = 가품 위험 최상위",
        "특정 시즌 (SS17 등) 한정 인기 = 시세 변동 큼",
      ],
      authentication: ["KREAM 검수", "Stockx"],
    },
    "stussy-bag": {
      detectKeywords: ["스투시", "stussy", "더블에스"],
      skuIdPrefixes: ["bag-stussy"],
      label: "스투시 (Stussy)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Logo — 손글씨 'Stussy' (Shawn Stussy 시그니처) 폰트 균일",
        "안감 라벨 + 시즌 태그",
      ],
      marketRisks: [
        "콜라보 매물 시세 ↑ — 인증 권장",
      ],
      authentication: ["KREAM 검수"],
    },
    "tnf-bag": {
      detectKeywords: ["노스페이스", "north face", "tnf", "thenorthface", "보레알리스", "핫샷", "빅샷"],
      skuIdPrefixes: ["bag-tnf"],
      label: "노스페이스 (The North Face)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "로고 자수 — TNF 폰트 균일 + 미국기 배지 (있는 모델)",
        "지퍼 YKK 마킹",
        "Nylon 강도 + 봉제 균일",
      ],
      marketRisks: [
        "Supreme x TNF 콜라보 = 가품 위험 ↑↑",
        "보레알리스/핫샷/빅샷 = 인기 백팩 — 가품 적당",
      ],
      authentication: ["KREAM 검수 (콜라보)"],
    },
    "acne-bag": {
      detectKeywords: ["아크네", "acne", "무수비"],
      skuIdPrefixes: ["bag-acne"],
      label: "아크네 스튜디오 (Acne Studios)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "로고 — 'Acne Studios' 또는 분홍 라벨",
        "안감 — 면 라벨 + 시리얼",
      ],
      marketRisks: [
        "Musubi 시그니처 매물 인기",
      ],
      authentication: ["KREAM 검수"],
    },
    "carhartt-bag": {
      detectKeywords: ["칼하트", "carhartt", "wip", "메신저"],
      skuIdPrefixes: ["bag-carhartt"],
      label: "칼하트 WIP (Carhartt)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "Square Label — 노란 사각형 'Carhartt' 정확",
        "안감 + 봉제 균일",
      ],
      marketRisks: [
        "가품 위험 낮음 (시세 적당)",
      ],
      authentication: [],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// watch — Wave E
// ─────────────────────────────────────────────────────────────────────────
// 명품 시계 = 가품 매우 큼 (Rolex/Omega/Cartier/AP/PP). AS 가능성 = 정품 검증 도구.
// G-Shock/Seiko 등 중저가 = 가품 적음.

const WATCH: CategoryBrandDepth = {
  category: "watch",
  default: {
    counterfeitRisk: "high",
    counterfeitChecks: [
      "시리얼/모델 번호 — 케이스 백 + 무브먼트 + 보증 카드 3곳 일치",
      "무브먼트 — 자동/쿼츠 차이. 정품 자동시계는 초침이 부드럽게 흐름, 쿼츠는 1초씩 톡톡",
      "다이얼 인쇄 — 폰트 굵기 균일, 인덱스 위치 대칭",
      "케이스 무게감 — 명품은 메탈 무게감 (Steel 150g+, Gold 250g+)",
    ],
    marketRisks: [
      "보증서 + 박스 + 카드 풀세트 = 정가 +20~30% (정품 검증 도구로도 활용)",
      "공식 매장 AS 가능 = 정품 검증 가능 (사설 AS만 가능 = 의심)",
    ],
    authentication: ["공식 매장 AS 가능성 확인", "Chrono24 인증"],
  },
  brands: {
    "rolex": {
      detectKeywords: ["롤렉스", "rolex", "서브마리너", "데이토나", "gmt", "익스플로러"],
      skuIdPrefixes: ["watch-rolex"],
      label: "롤렉스 (Rolex)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "크라운 (왕관) 로고 — 5각형 + 5개 점. 다이얼 6시 + 케이스 백 + 베젤 마이크로 각인 일치",
        "시리얼 — 8자리 (2010 이후 무작위 알파벳+숫자). 케이스 백 + 보증 카드 매칭",
        "무브먼트 — Caliber 3xxx 시리즈 (3135, 3186 등). 정품 'COSC 인증' 표기",
        "사이클로프 렌즈 — 데이트 창 2.5배 확대 (정품), 가품은 1.5배~2배",
        "초침 — 부드럽게 흐름 (Hi-Beat 4Hz=28800 vph). 가품은 끊김 있음",
      ],
      marketRisks: [
        "Submariner / GMT-Master / Daytona / Datejust = 가품 매우 흔함",
        "공식 매장 AS 가능 매물 = 정품 검증 도구. AS 거부 = 가품 또는 부품 교체",
        "최근 'frankenwatch' (정품 부품 + 가품 부품 혼합) 위험",
      ],
      authentication: ["롤렉스 공식 매장 AS (한국)", "Chrono24 인증 매물"],
    },
    "omega": {
      detectKeywords: ["오메가", "omega", "스피드마스터", "씨마스터", "컨스텔레이션"],
      skuIdPrefixes: ["watch-omega"],
      label: "오메가 (Omega)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "시리얼 — 8자리 숫자 (현대 모델). 케이스 백 안쪽 + 보증서",
        "Co-Axial 무브먼트 (2007 이후) — 정품 시계는 'Co-Axial' 표기 + 인증",
        "Seamaster Diver — Helium Escape Valve (HEV) 정확 위치 + 마감",
        "Speedmaster Moonwatch — Hesalite 크리스탈 (플라스틱) 모델은 NASA 인증 표시",
      ],
      marketRisks: [
        "Speedmaster Moonwatch (스피드 문워치) = 가품 흔함 — 보증서 + 박스 필수",
        "Seamaster 300m (제임스 본드) = 가품 매우 흔함",
      ],
      authentication: ["오메가 공식 매장 AS", "Chrono24 인증"],
    },
    "cartier": {
      detectKeywords: ["까르띠에", "cartier", "탱크", "산토스", "발롱블루"],
      skuIdPrefixes: ["watch-cartier"],
      label: "까르띠에 (Cartier)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "사파이어 크라운 (cabochon) — 블루/레드 보석 마감. 정품 색감 진함, 가품 옅음",
        "시리얼 — 케이스 백 + 보증 카드",
        "다이얼 폰트 — Cartier 'C' 곡선 균일",
        "Roman Numeral (로마자 인덱스) — VII 가 12시 방향, 'IIII' (IV 아님) 표기",
      ],
      marketRisks: [
        "Tank Must / Solo = 인기 모델, 가품 흔함",
        "Santos / Ballon Bleu = 명품 가품 위험 큼",
      ],
      authentication: ["까르띠에 공식 매장 AS", "Chrono24 인증"],
    },
    "audemars-piguet": {
      detectKeywords: ["오데마피게", "audemars piguet", "ap watch", "로열오크"],
      skuIdPrefixes: ["watch-audemars-piguet", "watch-ap"],
      label: "오데마 피게 (Audemars Piguet)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "Royal Oak 8각 베젤 — 8개 hex screw 위치 정확 (모든 screw 같은 방향 일치)",
        "Tapisserie 다이얼 — 격자 패턴 정확. 정품 디테일 선명",
        "시리얼 — 5자리 (현대 RO 15400/15500). 케이스 백 + 보증 카드",
        "무브먼트 Calibre 3120/4302 — 자동, 60시간 파워 리저브",
      ],
      marketRisks: [
        "Royal Oak = 가품 매우 흔함, 리세일 ₩3000만~수억원",
        "공식 매장 AS 가능 = 정품 검증. AS 거부 = 가품",
      ],
      authentication: ["AP 공식 매장 AS", "Chrono24 인증"],
    },
    "patek-philippe": {
      detectKeywords: ["파텍필립", "patek philippe", "노틸러스", "아쿠아넛"],
      skuIdPrefixes: ["watch-patek-philippe", "watch-patek"],
      label: "파텍 필립 (Patek Philippe)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "시리얼 — 케이스 백 안쪽 + 보증 카드 (Origin / Service papers)",
        "Patek 'Extract from Archives' (₩400+) 발급 가능 = 정품 검증 최고 도구",
        "무브먼트 — Caliber 240 (2.4mm 마이크로 로터) 등. 정품 무브먼트 사진 필수",
        "케이스 백 마이크로 각인 — 'PP & Co.' 로고 깊이 균일",
      ],
      marketRisks: [
        "Nautilus 5711/5980 = 가품 흔함 + 리세일 ₩5000만+",
        "Aquanaut 5167/5168 = 흔한 가품 모델",
        "Patek Extract 발급 ($400) = 진품 확정 최고 방법",
      ],
      authentication: ["Patek Extract from Archives", "공식 매장 AS"],
    },
    "iwc": {
      detectKeywords: ["iwc", "포르투기저", "파일럿", "포르토피노"],
      skuIdPrefixes: ["watch-iwc"],
      label: "IWC 샤프하우젠",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "시리얼 — 케이스 백 + 보증 카드",
        "무브먼트 — Caliber 32xxx / 51xxx / 89xxx 등 자체 무브먼트",
        "Portuguese (포르투기저) Lume — 야광 균일",
      ],
      marketRisks: [
        "Portuguese / Pilot / Aquatimer = 가품 흔함",
      ],
      authentication: ["IWC 공식 매장 AS", "Chrono24 인증"],
    },
    "casio-gshock": {
      detectKeywords: ["지샥", "g-shock", "gshock", "casio g"],
      skuIdPrefixes: ["watch-casio-gshock"],
      label: "카시오 지샥 (G-Shock)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "모듈 번호 — 케이스 백 (예: 3431 = GA-2100 모듈)",
        "후면 'CASIO' 음각 + 'JAPAN MOVT'",
      ],
      marketRisks: [
        "가품 거의 없음 (시세 ₩5~30만)",
        "스트랩/베젤 교체 가능 — 정품 부품 확인 (정품 부품 다르면 시세 ↓)",
      ],
      authentication: ["카시오 공식 시리얼 조회"],
    },
    "seiko": {
      detectKeywords: ["세이코", "seiko", "프리미어", "프로스펙스", "프레자지"],
      skuIdPrefixes: ["watch-seiko"],
      label: "세이코 (Seiko)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "케이스 백 — 'Seiko Japan' + 모듈 번호 (예: 4R36) + 시리얼",
        "무브먼트 — Caliber 4R/6R 시리즈",
      ],
      marketRisks: [
        "5 Sports / Prospex (다이버) = 가품 적음, 인기 모델",
        "Grand Seiko = 별도 시세, 가품 가능성 ↑",
      ],
      authentication: ["세이코 공식 AS (한국 - 동일이트레이딩)"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// perfume — Wave E
// ─────────────────────────────────────────────────────────────────────────
// 공병/가짜 향료 위험 — 시리얼 + 박스 인쇄 + 잔량 확인.

const PERFUME: CategoryBrandDepth = {
  category: "perfume",
  default: {
    counterfeitRisk: "moderate",
    counterfeitChecks: [
      "시리얼 — 박스 바닥 + 병 바닥 일치 (생산 batch 표시)",
      "박스 인쇄 — 폰트 굵기/색감/마감 균일",
      "스프레이 노즐 — 분사력 + 향 패턴 (정품은 미세 분무)",
      "캡 — 무게감 + 끼움새 (정품은 정확히 맞음)",
    ],
    marketRisks: [
      "공병에 가짜 향료 채워 판매 — 직거래 시 시향 권장",
      "잔량 X% 명시 매물 = 시세 (50% = 정가 -50%)",
      "박스/박스 봉인 확인 (꽉찬 매물 = 거의 새것)",
    ],
    authentication: ["공식 매장 영수증", "면세점 영수증"],
  },
  brands: {
    "chanel-perfume": {
      detectKeywords: ["샤넬", "chanel", "코코마드모아젤", "no.5", "넘버5", "블루드샤넬", "블루 드 샤넬"],
      skuIdPrefixes: ["chanel-"],
      label: "샤넬 향수 (Chanel)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "병 바닥 시리얼 — 박스 바닥과 매칭 (배치 번호 4~7자리)",
        "라벨 폰트 — Chanel 폰트 (균일 자간), 'EAU DE PARFUM' 글자 선명",
        "캡 — 정품은 무거움 + 자석 끼임 (Coco Mademoiselle), 가품은 가볍거나 헐거움",
        "박스 셀로판 봉인 — 정품 정사각형 + 빈틈 없음",
      ],
      marketRisks: [
        "Coco Mademoiselle / No.5 / Chance = 가품 흔함",
        "Bleu de Chanel (남성) 가품 매우 흔함",
        "면세점 영수증 매물 = 신뢰 ↑",
      ],
      authentication: ["샤넬 공식 매장 영수증", "면세점 영수증 (롯데/신라/현대)"],
    },
    "dior-perfume": {
      detectKeywords: ["디올", "dior", "쇼비주", "미스디올", "사우바주", "사바주"],
      skuIdPrefixes: ["dior-"],
      label: "디올 향수 (Dior)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "병 바닥 — 시리얼 + 'France' 음각",
        "캡 — 무게감 + Dior 폰트 균일",
        "라벨 인쇄 — Dior CD 로고 선명",
      ],
      marketRisks: [
        "Sauvage (사우바주) 남성 향수 가품 매우 흔함",
        "Miss Dior / J'adore 흔한 가품 모델",
      ],
      authentication: ["디올 공식 매장 영수증", "면세점 영수증"],
    },
    "tom-ford": {
      detectKeywords: ["톰포드", "tom ford", "tobacco", "ombre", "오드"],
      skuIdPrefixes: ["tom-ford-"],
      label: "톰 포드 (Tom Ford)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "병 바닥 — 'TF' 로고 음각 + 시리얼",
        "캡 — 메탈 무게감 (Private Blend 라인은 무거움)",
        "박스 — 검정 매트 마감 + 흰 라벨 'TOM FORD' 정확",
      ],
      marketRisks: [
        "Private Blend (Tobacco Vanille, Oud Wood, Lost Cherry) = 가품 흔함",
        "Signature 라인 (Black Orchid) = 가품 가능",
      ],
      authentication: ["면세점/매장 영수증"],
    },
    "jo-malone": {
      detectKeywords: ["조말론", "jo malone", "잉글리시", "라임", "우드세이지"],
      skuIdPrefixes: ["jo-malone-"],
      label: "조 말론 (Jo Malone)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "박스 — 크림색 + 검정 라벨 'Jo Malone London'",
        "병 — 사각형 클리어 글래스 + 검정 캡",
        "병 바닥 시리얼",
        "리본 — 검정 새틴 리본 (선물 포장)",
      ],
      marketRisks: [
        "Wood Sage & Sea Salt / Lime Basil & Mandarin / English Pear = 인기 + 가품 흔함",
        "잔량 표기 (꽉찬 / 80% 등) 가격 영향",
      ],
      authentication: ["면세점/매장 영수증"],
    },
    "diptyque": {
      detectKeywords: ["딥티크", "diptyque", "도손", "탐다오", "오선"],
      skuIdPrefixes: ["diptyque-"],
      label: "딥티크 (Diptyque)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "박스 — 흰 박스 + Diptyque 손글씨 로고",
        "병 — 흰 라벨 + 손글씨 폰트 'Diptyque'",
        "캡 — 메탈 무게감 (EDP 라인)",
      ],
      marketRisks: [
        "Do Son / Tam Dao / Eau Rose = 인기 모델",
        "캔들 매물도 흔함 — 향수와 별도 시세",
      ],
      authentication: ["면세점/매장 영수증"],
    },
    "le-labo": {
      detectKeywords: ["르라보", "le labo", "산탈", "베르가못", "더라이트"],
      skuIdPrefixes: ["le-labo-"],
      label: "르 라보 (Le Labo)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "병 — 흰 라벨에 손글씨처럼 적힘 (모델명 + 사용자 이름 + 날짜)",
        "박스 — 갈색 박스 + 흰 라벨",
        "캡 — 메탈 무게감",
      ],
      marketRisks: [
        "Santal 33 / Bergamote 22 / The Noir = 가장 인기",
        "병 라벨에 적힌 사용자 이름/날짜는 정품 표시 (커스텀 가능)",
      ],
      authentication: ["면세점/매장 영수증", "Le Labo 공식 매장"],
    },
    "memo": {
      detectKeywords: ["메모", "memo paris", "아이리시 레더", "russian", "쟈로니어"],
      skuIdPrefixes: ["memo-"],
      label: "메모 파리 (Memo Paris)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "박스 — Memo 로고 + 'Paris'",
        "병 — 두꺼운 글래스 + 메탈 캡",
      ],
      marketRisks: [
        "Irish Leather / Russian Leather = 인기",
        "분사 노즐 작동 확인 (정품은 미세 분무)",
      ],
      authentication: ["면세점/매장 영수증"],
    },
    "replica": {
      detectKeywords: ["레플리카", "replica", "메종 마르지엘라 향수", "비치워크", "재즈클럽"],
      skuIdPrefixes: ["replica-"],
      label: "레플리카 (Maison Margiela Replica)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "박스 — 종이 라벨 (사진 같음, 'When the Rain Stops' 등)",
        "병 — 흰 라벨 + 시리얼",
        "캡 — 메탈 마감",
      ],
      marketRisks: [
        "Jazz Club / Beach Walk / Lazy Sunday Morning = 인기",
      ],
      authentication: ["면세점/매장 영수증"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// camera — Wave E
// ─────────────────────────────────────────────────────────────────────────
// 가품 거의 X — 진짜 위험 = 셔터 카운트 / 렌즈 곰팡이 / 센서 / AS.

const CAMERA: CategoryBrandDepth = {
  category: "camera",
  default: {
    counterfeitRisk: "low",
    counterfeitChecks: [
      "시리얼 — 바디 하단 + 박스 일치 (제조사 공식 등록 조회)",
      "센서 — 클리닝 (먼지/얼룩 사진 확인) + 결함 (Hot pixel)",
      "셔터 카운트 — 메뉴에서 확인 (브랜드별 다름)",
    ],
    marketRisks: [
      "셔터 카운트 명시 매물 = 신뢰 ↑ (10만 이하 정상)",
      "AS 가능 + 보증 잔여 매물 = 시세 +",
      "풀세트 (박스/배터리/충전기/스트랩) vs 본체만 가격 차",
    ],
    authentication: ["제조사 공식 시리얼 조회", "공식 AS 매장"],
  },
  brands: {
    "sony-camera": {
      detectKeywords: ["소니", "sony alpha", "a7", "fx3", "zv"],
      skuIdPrefixes: ["camera-sony"],
      label: "소니 알파 (Sony α)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "셔터 카운트 — 메뉴 > 설정 > 카메라 설정 (a7 시리즈)",
        "시리얼 — 바디 하단 + 박스 일치. Sony 한국 AS 등록 가능",
      ],
      marketRisks: [
        "a7M3/M4 = 정격 셔터 300,000. 10만 초과 = -20% 시세",
        "센서 클리닝 비용 (₩3~5만 — 직거래 후 cleaning 권장)",
        "E-mount 렌즈 호환 — 풀프레임 (FE) vs 크롭 (E) 구분",
      ],
      authentication: ["Sony Korea AS", "사진 갤러리/카페 후기"],
    },
    "canon-camera": {
      detectKeywords: ["캐논", "canon", "eos", "r5", "r6", "5d"],
      skuIdPrefixes: ["camera-canon"],
      label: "캐논 EOS (Canon)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "셔터 카운트 — Canon 메뉴 (R 시리즈) 또는 EOSInfo (DSLR)",
        "시리얼 — 바디 하단 + 박스",
      ],
      marketRisks: [
        "5D Mark IV/III = DSLR 인기. AF 모듈 자주 고장 (점검 권장)",
        "R5/R6 = 미러리스 인기. EF → RF 마운트 어댑터 호환",
        "센서 곰팡이 — 한국 습도 영향 (특히 보관 잘못 시)",
      ],
      authentication: ["Canon Korea AS", "사진 갤러리 후기"],
    },
    "nikon-camera": {
      detectKeywords: ["니콘", "nikon", "z6", "z7", "z9", "d850"],
      skuIdPrefixes: ["camera-nikon"],
      label: "니콘 Z (Nikon)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "셔터 카운트 — Nikon 메뉴 (Z 시리즈)",
        "시리얼 + 펌웨어 버전 확인",
      ],
      marketRisks: [
        "Z9 = 플래그십, 비싼 매물 (₩600만+)",
        "Z mount → F mount 어댑터 호환 (DSLR 렌즈 사용)",
      ],
      authentication: ["Nikon Korea AS"],
    },
    "fujifilm-camera": {
      detectKeywords: ["후지", "fujifilm", "x-t", "xt4", "xt5", "x100"],
      skuIdPrefixes: ["camera-fujifilm"],
      label: "후지필름 X (Fujifilm)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "셔터 카운트 — Fuji 메뉴 또는 EXIF data",
        "시리얼 + 펌웨어",
      ],
      marketRisks: [
        "X100V/X100VI = 인기 + 매물 적음 (시세 ↑)",
        "X-T5/X-T4 = 메인 미러리스",
        "X mount 렌즈 호환",
      ],
      authentication: ["Fujifilm Korea AS"],
    },
    "leica": {
      detectKeywords: ["라이카", "leica", "m10", "m11", "q3", "sl2"],
      skuIdPrefixes: ["camera-leica"],
      label: "라이카 (Leica)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "시리얼 — Leica 공식 등록 + AS 가능",
        "마운트 — M mount (M 시리즈) / L mount (SL/Q)",
      ],
      marketRisks: [
        "M11/Q3 = ₩1000~1500만 — 가품 위험 ↑ (희소 + 비싼 매물)",
        "Leica Korea AS = 정품 검증 도구",
      ],
      authentication: ["Leica Korea AS", "Chrono24 (수입 매물)"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// drone — Wave E
// ─────────────────────────────────────────────────────────────────────────
// DJI 가품 거의 X. 진짜 위험 = 활성화 + 펌웨어 + 배터리 사이클.

const DRONE: CategoryBrandDepth = {
  category: "drone",
  default: {
    counterfeitRisk: "low",
    counterfeitChecks: [
      "시리얼 — DJI Fly 앱 > 기기 정보 (시리얼 + 활성화 횟수)",
      "활성화 횟수 = 1회 권장 (2회 이상 = 이전 사용자 deactivate 안 함 의심)",
      "펌웨어 버전 — 최신 권장",
    ],
    marketRisks: [
      "배터리 사이클 (200 cycle 미만 정상)",
      "프로펠러 크랙 + 짐벌 흔들림 점검",
      "DJI Care Refresh 잔여 기간 (보험 — 추락/사고 보상)",
    ],
    authentication: ["DJI 공식 account 등록 조회", "DJI Korea AS"],
  },
  brands: {
    "dji-drone": {
      detectKeywords: ["dji", "디제이아이", "매빅", "mavic", "에어3", "미니4", "fpv", "아바타"],
      skuIdPrefixes: ["dji-"],
      label: "DJI (드론)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "DJI Fly 앱 페어링 — 시리얼 + 활성화 횟수 + 배터리 사이클 표시",
        "account.dji.com 시리얼 등록 확인",
        "펌웨어 업데이트 가능 (최신 펌웨어 적용 매물 = 신뢰 ↑)",
      ],
      marketRisks: [
        "Mavic 3 Pro / Air 3S / Mini 4 Pro = 인기. 가품 거의 없음",
        "배터리 사이클 (200 cycle 미만 권장)",
        "Combo (Fly More Combo) vs 본체만 = 가격 차 (배터리/충전기/필터)",
        "한국 항공법 — 250g 이상 드론 = 사용 등록 필요",
      ],
      authentication: ["DJI account 시리얼 조회", "DJI Korea AS"],
    },
    "gopro": {
      detectKeywords: ["고프로", "gopro", "hero", "max"],
      skuIdPrefixes: ["gopro-"],
      label: "고프로 (GoPro)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "시리얼 — GoPro Quik 앱 또는 본체 메뉴",
        "GoPro Care 가입 여부 (보험)",
      ],
      marketRisks: [
        "Hero 12/13 = 최신, 인기 매물",
        "배터리/방수 케이스 부속 별도 시세",
      ],
      authentication: ["GoPro Korea AS"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// earphone — Wave E
// ─────────────────────────────────────────────────────────────────────────
// AirPods 차이팟 가품 매우 흔함. Galaxy Buds/Sony/Bose 가품 적당.

const EARPHONE: CategoryBrandDepth = {
  category: "earphone",
  default: {
    counterfeitRisk: "high",
    counterfeitChecks: [
      "무게 측정 (정품 사양 비교)",
      "시리얼 — 케이스 안쪽 + 공식 사이트 등록",
      "페어링 — 정품은 자동 팝업, 가품은 일반 BT 페어링만",
    ],
    marketRisks: [
      "좌/우 단품 매물 = 페어링 X, 매입 가치 50% 이하",
      "케이스 only / 본체 only = 정가 -50%",
      "정품 박스/케이블/이어팁 완비 시 가격 +",
    ],
    authentication: ["제조사 공식 시리얼 조회"],
  },
  brands: {
    "airpods-pro": {
      detectKeywords: ["에어팟 프로", "airpods pro"],
      skuIdPrefixes: ["airpods-pro-"],
      label: "Apple AirPods Pro",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "본체 좌/우 무게 = 각 5.3g (±0.05). 가품 4.5~5.5g 변동",
        "케이스 무게 = 50.8g. 가품 45~52g 변동",
        "시리얼 — 케이스 안쪽 + checkcoverage.apple.com 등록",
        "iOS 자동 페어링 팝업 + animation. 가품 = 일반 BT 페어링만",
        "케이스 LED — 정품 호박색 → 녹색. 가품 어두운 노란색",
        "공기 흐름 — 정품 분리 시 공기 흐름 X. 가품 = '치익' 소리",
      ],
      marketRisks: [
        "차이팟 가품 매우 흔함 — 15만원 미만 매물 = 의심",
        "좌/우 단품 = 페어링 X (50% 이하 시세)",
        "케이스 only / 본체 only = -50%",
      ],
      authentication: ["Apple checkcoverage.apple.com", "iOS 페어링 팝업 동작"],
    },
    "airpods-other": {
      detectKeywords: ["airpods 2", "airpods 3", "airpods 4", "에어팟 2", "에어팟 3", "에어팟 4"],
      skuIdPrefixes: ["airpods-2", "airpods-3", "airpods-4"],
      label: "Apple AirPods (Pro 외)",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "본체 좌/우 무게 (AirPods 2/3 ~4g, AirPods 4 ~4.2g)",
        "케이스 무게 (AirPods 3 ~37g, AirPods 4 ~32g)",
        "iOS 자동 페어링 팝업",
        "시리얼 + checkcoverage.apple.com",
      ],
      marketRisks: [
        "에어팟 2/3/4 일반 = 차이팟 가품 흔함",
        "좌/우 단품 매물 = -50%",
      ],
      authentication: ["Apple checkcoverage", "iOS 페어링"],
    },
    "airpods-max": {
      detectKeywords: ["에어팟 맥스", "airpods max"],
      skuIdPrefixes: ["airpods-max"],
      label: "Apple AirPods Max",
      counterfeitRisk: "high",
      counterfeitChecks: [
        "무게 = 384.8g (정확). 가품 350~400g",
        "Smart Case 자석 끼임 — 케이스 분리 시 자동 꺼짐",
        "USB-C (2024+) vs Lightning (2020) 구분",
        "Digital Crown 회전 부드러움 + 노이즈 캔슬링 동작",
      ],
      marketRisks: [
        "가품 흔함 (₩50만 이상 시세)",
        "이어컵 (메모리폼) 마모 — 교체 부품 시세 ₩15만",
        "Lightning vs USB-C — USB-C 신규 권장 (가격 +)",
      ],
      authentication: ["Apple checkcoverage", "iOS 페어링"],
    },
    "galaxy-buds": {
      detectKeywords: ["갤럭시 버즈", "galaxy buds", "버즈 프로", "buds pro"],
      skuIdPrefixes: ["galaxy-buds-"],
      label: "삼성 갤럭시 버즈 (Galaxy Buds)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Samsung Galaxy Wearable 앱 페어링",
        "시리얼 — 케이스 안쪽 + samsung.com/sec/support 등록",
        "본체 좌/우 무게 (Buds 3 Pro ~5.4g)",
      ],
      marketRisks: [
        "Buds 3 Pro / Buds 2 Pro = 인기. 가품 발견됨 (적음)",
        "Buds Live (콩나물) 케이스 = 분실 흔함",
      ],
      authentication: ["Samsung Korea AS", "Galaxy Wearable 앱 페어링"],
    },
    "sony-earphone": {
      detectKeywords: ["sony wf", "sony wh", "1000xm5", "1000xm4", "linkbuds"],
      skuIdPrefixes: ["sony-wf", "sony-wh"],
      label: "Sony WF/WH",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Sony Headphones Connect 앱 페어링",
        "시리얼 — 케이스 + 박스 + 본체",
        "노이즈 캔슬링 강도 (Sony 자체 LDAC 코덱)",
      ],
      marketRisks: [
        "WF-1000XM5 / WH-1000XM5/M6 = 인기 노이즈캔슬링",
        "이어팁 마모 — 교체 권장",
      ],
      authentication: ["Sony Korea AS"],
    },
    "bose-earphone": {
      detectKeywords: ["보스", "bose qc", "qc ultra"],
      skuIdPrefixes: ["bose-"],
      label: "Bose (QC 시리즈)",
      counterfeitRisk: "moderate",
      counterfeitChecks: [
        "Bose Music 앱 페어링",
        "시리얼 + 박스",
      ],
      marketRisks: [
        "QC Ultra Earbuds / QC SE = 인기",
        "Headphones 700 / QC45 = 단종 모델 시세 변동",
      ],
      authentication: ["Bose Korea AS"],
    },
    "beats": {
      detectKeywords: ["비츠", "beats", "studio buds", "solo 4"],
      skuIdPrefixes: ["beats-"],
      label: "Beats (Apple 산하)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "Apple checkcoverage.apple.com 시리얼 조회 (Apple 인수 후)",
        "iOS/Android Beats 앱 페어링",
      ],
      marketRisks: [
        "Studio Buds+ / Solo 4 / Studio Pro = 최신",
        "Apple 인수 후 가품 적어짐 (Apple 검증 system)",
      ],
      authentication: ["Apple checkcoverage"],
    },
    "sennheiser": {
      detectKeywords: ["젠하이저", "sennheiser", "momentum", "ie 100", "ie 300"],
      skuIdPrefixes: ["sennheiser-"],
      label: "젠하이저 (Sennheiser)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "시리얼 — 본체 + 박스",
        "Sennheiser Smart Control 앱 (Momentum 시리즈)",
      ],
      marketRisks: [
        "Momentum True Wireless 4 = 최신",
        "유선 IE 시리즈 (100/300/600/900) = 음향 매니아",
      ],
      authentication: ["Sennheiser 공식 사이트 등록"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// smartwatch — Wave E
// ─────────────────────────────────────────────────────────────────────────
// Apple Watch / Galaxy Watch — 가품 거의 X. 진짜 위험 = iCloud/FRP 잠금 + 배터리.

const SMARTWATCH: CategoryBrandDepth = {
  category: "smartwatch",
  default: {
    counterfeitRisk: "low",
    counterfeitChecks: [
      "시리얼 — 본체 + 박스 + 페어링 앱 매칭",
      "iCloud Activation Lock (Apple) / FRP Lock (Galaxy) 해제 여부 확인",
      "배터리 사이클 — 1년 800 cycle 권장",
    ],
    marketRisks: [
      "셀룰러 모델 vs Wi-Fi (셀룰러 +₩5~10만)",
      "밴드/스트랩 별도 시세 (정품 vs 사제)",
      "페어링 해제 = 직거래 시 즉시 확인",
    ],
    authentication: ["Apple checkcoverage.apple.com", "Samsung samsung.com/sec/support"],
  },
  brands: {
    "applewatch": {
      detectKeywords: ["애플워치", "apple watch", "applewatch", "워치 시리즈", "워치 울트라"],
      skuIdPrefixes: ["applewatch-"],
      label: "Apple Watch",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "설정 > 일반 > 정보 (시리얼 + 모델 번호)",
        "Watch 앱 (iPhone) 페어링 + Activation Lock 해제 여부",
        "Apple checkcoverage.apple.com 시리얼 등록",
        "Digital Crown / Side Button 작동",
      ],
      marketRisks: [
        "Series 9/10 + Ultra/Ultra 2 = 인기",
        "셀룰러 vs Wi-Fi (셀룰러 +₩5~10만)",
        "배터리 사이클 (1년 800 cycle 권장)",
        "AppleCare+ 가입 매물 = 시세 ↑",
      ],
      authentication: ["Apple checkcoverage", "iPhone Watch 앱 페어링"],
    },
    "galaxywatch": {
      detectKeywords: ["갤럭시 워치", "galaxy watch", "galaxywatch"],
      skuIdPrefixes: ["galaxywatch-"],
      label: "Samsung Galaxy Watch",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "설정 > 시계 정보 (시리얼 + 모델)",
        "Samsung Galaxy Wearable 앱 페어링 + FRP 해제",
        "samsung.com/sec/support 시리얼 등록",
      ],
      marketRisks: [
        "Watch 7 / Watch Ultra / Watch 6 = 최신",
        "Classic (회전 베젤) vs 일반 가격 차",
        "Samsung Care+ 가입 매물 = 시세 ↑",
      ],
      authentication: ["Samsung Korea AS", "Galaxy Wearable 앱 페어링"],
    },
    "garmin": {
      detectKeywords: ["가민", "garmin", "fenix", "epix", "forerunner", "venu"],
      skuIdPrefixes: ["garmin-"],
      label: "가민 (Garmin)",
      counterfeitRisk: "low",
      counterfeitChecks: [
        "시리얼 — 본체 후면 + 박스",
        "Garmin Connect 앱 페어링",
      ],
      marketRisks: [
        "Fenix / Epix = 프리미엄 (₩60~120만)",
        "Forerunner = 러닝 특화",
        "GPS 정확도 + 배터리 (Solar 모델 = 태양광)",
      ],
      authentication: ["Garmin Korea AS"],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Registry & helpers
// ─────────────────────────────────────────────────────────────────────────

export const CATEGORY_BRAND_DEPTH: Record<string, CategoryBrandDepth> = {
  shoe: SHOE,
  clothing: CLOTHING,
  smartphone: SMARTPHONE,
  tablet: TABLET,
  laptop: LAPTOP,
  bag: BAG,
  watch: WATCH,
  perfume: PERFUME,
  camera: CAMERA,
  drone: DRONE,
  earphone: EARPHONE,
  smartwatch: SMARTWATCH,
};

export type BrandDepthMatch = {
  category: string;
  brandKey: string;
  brand: BrandDepth;
};

/**
 * 카테고리 + 카드 텍스트(skuId/skuName/name)에서 브랜드 매칭.
 *   1. skuIdPrefixes 매칭 우선 (가장 정확)
 *   2. detectKeywords 매칭 (skuName + name 합쳐 lowercase 검사)
 *   3. 매칭 실패 시 null — UI 는 default 정보 사용
 */
export function detectBrandDepth(
  category: string | null | undefined,
  ctx: { skuId?: string | null; skuName?: string | null; name?: string | null },
): BrandDepthMatch | null {
  if (!category) return null;
  const data = CATEGORY_BRAND_DEPTH[category.toLowerCase()];
  if (!data) return null;

  const skuIdLower = (ctx.skuId ?? "").toLowerCase();
  const haystack = `${ctx.skuName ?? ""} ${ctx.name ?? ""}`.toLowerCase();

  // 1. skuId prefix 우선
  if (skuIdLower) {
    for (const [brandKey, brand] of Object.entries(data.brands)) {
      const prefixes = brand.skuIdPrefixes ?? [];
      if (prefixes.some((p) => skuIdLower.startsWith(p))) {
        return { category: data.category, brandKey, brand };
      }
    }
  }

  // 2. keyword 매칭
  if (haystack.trim()) {
    for (const [brandKey, brand] of Object.entries(data.brands)) {
      if (brand.detectKeywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
        return { category: data.category, brandKey, brand };
      }
    }
  }

  return null;
}

/** 매칭 실패 시 fallback 정보. 카테고리는 있지만 브랜드 미확정인 경우 사용. */
export function categoryDefaultDepth(
  category: string | null | undefined,
): { category: string; brand: Omit<BrandDepth, "detectKeywords" | "label">; label: string } | null {
  if (!category) return null;
  const data = CATEGORY_BRAND_DEPTH[category.toLowerCase()];
  if (!data) return null;
  // label 은 counterfeit-checklist.ts 와 별개 — 여긴 UI 가 "이 카테고리 일반" 톤으로 표시.
  return { category: data.category, brand: data.default, label: "" };
}

/** 가품 위험 한국어 라벨. */
export const COUNTERFEIT_RISK_LABEL: Record<BrandDepth["counterfeitRisk"], string> = {
  high: "가품 위험 큼",
  moderate: "가품 가능 — 변별 권장",
  low: "가품 거의 없음",
};
