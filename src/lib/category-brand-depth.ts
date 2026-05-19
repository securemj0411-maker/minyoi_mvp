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
//   Wave A 범위: shoe 만. 후속 wave (B clothing, C bag, D 전자, E 나머지) 에서 동일 구조로 확장.

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
// Registry & helpers
// ─────────────────────────────────────────────────────────────────────────

export const CATEGORY_BRAND_DEPTH: Record<string, CategoryBrandDepth> = {
  shoe: SHOE,
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
