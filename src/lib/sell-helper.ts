// Wave 2026-05-19 (외부인 #A1 판매 단계 도우미):
// 카테고리별 정적 템플릿. LLM 호출 없음. 12개 카테고리(가품 위험 카테고리와 동일).
// 매수 후(bought/inspected feedback) 자동 펼침. 매수 전엔 접힌 상태로 미리 보기.
//
// 카테고리별:
//   1. 추천 제목 패턴 (placeholder를 카드 데이터로 채움)
//   2. 본문 템플릿 (체크리스트 형식 — 복붙 가능)
//   3. 사진 가이드 (필수 사진 N장 리스트)
//   4. 호가 룰 (시세 + α% — 카테고리별 협상 폭 차이)
//   5. 부가 팁

export type SellHelperPhoto = {
  title: string;
  detail: string;
  required: boolean;
};

export type SellHelperBodyLine = {
  label: string;
  hint: string;
};

export type SellHelperCategory = {
  category: string;
  label: string;
  // 제목 패턴 placeholder: {brand} {model} {color} {size} {status} {capacity} {network}
  titlePattern: string;
  bodyLines: SellHelperBodyLine[];
  photos: SellHelperPhoto[];
  askingPriceMarkupPct: number;
  priceNote: string;
  proTip: string;
};

export const SELL_HELPER: Record<string, SellHelperCategory> = {
  shoe: {
    category: "shoe",
    label: "신발 (스니커즈)",
    titlePattern: "{brand} {model} {color} {size} {status}",
    bodyLines: [
      { label: "사이즈", hint: "정확한 사이즈 (US/EU/CM)" },
      { label: "컨디션", hint: "미사용 / 1~2회 착용 / 사용감 ([구체적])" },
      { label: "정품 인증", hint: "KREAM 검수 인증 / 매장 영수증 / 발급일" },
      { label: "박스/구성", hint: "박스 O/X, 더스트백, 추가 끈" },
      { label: "거래 방법", hint: "안전결제 가능, 직거래 [지역] 가능" },
    ],
    photos: [
      { title: "정면 + 측면", detail: "신발 정면 + 양쪽 측면. 로고 디테일 잘 보이게.", required: true },
      { title: "솔(밑창) 전체", detail: "정품 패턴 확인용. 균일성 + 마모 정도.", required: true },
      { title: "박스 사이드 라벨", detail: "스타일 번호 + 컬러 코드 + 사이즈. 신발과 일치 확인.", required: true },
      { title: "안창 사이즈 라벨", detail: "US/EU/CM 표기 + 폰트 균일.", required: true },
      { title: "KREAM 검수 카드/인보이스", detail: "있으면 정품 신뢰도 +20%. 검수 거친 신발 강조.", required: false },
      { title: "사용감 부위 클로즈업", detail: "있는 그대로. 신뢰 +.", required: false },
    ],
    askingPriceMarkupPct: 5,
    priceNote: "스니커즈 평균 협상 폭 5~7%. KREAM 검수 거친 매물은 +α 가능.",
    proTip: "KREAM/솔드아웃 검수 인증 사진 첨부하면 시세 +10~15% 가능. 박스 + 인보이스 + 검수 3박자 = 가장 빨리 팔림.",
  },

  smartphone: {
    category: "smartphone",
    label: "스마트폰 (아이폰/갤럭시)",
    titlePattern: "{brand} {model} {capacity} {color} {network} {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm] (영수증 O/X)" },
      { label: "배터리 효율", hint: "설정 → 배터리 → 최대 용량 [N]%" },
      { label: "통신사", hint: "자급제 / SK / KT / LG (잠금 여부)" },
      { label: "외관 상태", hint: "액정 [무기스/기스 위치], 후면 [무기스/기스]" },
      { label: "부품 갈이", hint: "비정품 부품 없음 (설정 → 정보 확인)" },
      { label: "구성품", hint: "본체, 충전기, 케이블, 박스 (있는 대로)" },
      { label: "AppleCare+/보증", hint: "만료일 [yyyy-mm-dd] / 보증 없음" },
    ],
    photos: [
      { title: "정면 (액정 켜진 상태)", detail: "잠금 화면 또는 홈. 액정 상태 확인.", required: true },
      { title: "후면", detail: "카메라 + 로고 + 사용감 확인.", required: true },
      { title: "옆면 4면", detail: "측면 사용감 + 버튼 상태.", required: true },
      { title: "박스 라벨 (IMEI/시리얼)", detail: "박스 IMEI가 폰 IMEI와 일치 확인.", required: true },
      { title: "설정 → 정보 화면 (IMEI/시리얼)", detail: "본체 IMEI 노출. apple.com/checkcoverage 결과 권장.", required: true },
      { title: "배터리 효율 화면", detail: "설정 → 배터리 → 최대 용량 %.", required: true },
      { title: "부품 정품 화면", detail: "설정 → 정보 → 정품 부품 확인.", required: false },
      { title: "구성품 (충전기/케이블)", detail: "박스 안 구성 그대로.", required: false },
    ],
    askingPriceMarkupPct: 7,
    priceNote: "폰은 협상 폭 큼 (7~10%). 자급제 + 풀박 + 배터리 90%+ 면 +α 가능.",
    proTip: "AppleCare+ 잔여 6개월+ 면 +5만원 가치. 배터리 80% 미만이면 거래가 -10만원. 영수증 첨부 시 가장 빨리 팔림.",
  },

  earphone: {
    category: "earphone",
    label: "이어폰 (에어팟/버즈/보스/소니/비츠)",
    titlePattern: "{brand} {model} {color} {status} {accessories}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm] (영수증 O/X)" },
      { label: "시리얼", hint: "충전 케이스 안쪽 [코드] (사진 첨부)" },
      { label: "사용 횟수", hint: "[N]시간 사용 / 미개봉 / 한쪽만 사용" },
      { label: "Find My/정품", hint: "Find My 해제 완료, 페어링 정상" },
      { label: "구성품", hint: "본체, 케이스, 충전 케이블, 이어팁 (있는 대로)" },
      { label: "AppleCare+/보증", hint: "보증 [N]개월 잔여 / 없음" },
    ],
    photos: [
      { title: "케이스 전면 (닫힌 상태)", detail: "케이스 외관 + 마감 확인.", required: true },
      { title: "케이스 안쪽 시리얼 각인", detail: "에어팟: 뚜껑 열고 안쪽 각인. 갤럭시 버즈: 박스 코드.", required: true },
      { title: "본체 양쪽 (귀 부분)", detail: "본체 사용감 + 메쉬망 청결도.", required: true },
      { title: "박스 라벨", detail: "박스 시리얼 + 모델명 + 구매처.", required: true },
      { title: "노이즈 캔슬/페어링 시연 영상", detail: "정품 인증 핵심. 영상으로 노캔 + 페어링 작동.", required: true },
      { title: "충전 케이블 + 이어팁", detail: "정품 충전기/이어팁 사이즈.", required: false },
    ],
    askingPriceMarkupPct: 5,
    priceNote: "이어폰은 가품 의심 많아 협상 폭 5%. 정품 인증 사진이 결정적.",
    proTip: "케이스 시리얼 + 영수증 + 노캔 영상 첨부 시 +10% 가능. 정품 의심 줄어 빠른 거래.",
  },

  bag: {
    category: "bag",
    label: "가방 (명품)",
    titlePattern: "{brand} {model} {color} {size} {status} (정품 인증)",
    bodyLines: [
      { label: "구매처/시기", hint: "[백화점/매장/면세점] [yyyy-mm] (영수증 O)" },
      { label: "시리얼 위치", hint: "[LV: 안감 핀스탬프 / 샤넬: 미니북릿 / 구찌: 라벨 뒷면]" },
      { label: "구성품", hint: "본체, 더스트백, 박스, 영수증, 인증서 (있는 대로)" },
      { label: "사용감", hint: "미사용 / 사용감 [등급] (코너/손잡이 상태)" },
      { label: "정품 보장", hint: "영수증 첨부 + 한국명품감정원 인증 가능 [O/X]" },
      { label: "거래 방법", hint: "안전결제 + 검수 거래 / 직거래 (직접 확인 가능)" },
    ],
    photos: [
      { title: "정면 + 후면", detail: "전체 외관. 패턴 매칭 확인.", required: true },
      { title: "측면 + 바닥", detail: "측면 봉제 + 바닥 보호 가죽 상태.", required: true },
      { title: "안감 (시리얼 위치 클로즈업)", detail: "브랜드별 시리얼 위치 사진. 정품 인증 핵심.", required: true },
      { title: "손잡이/금속 부품 클로즈업", detail: "각인 깊이 + 마감. 짭 의심 줄임.", required: true },
      { title: "더스트백 + 박스", detail: "정품 포장 풀세트.", required: true },
      { title: "영수증/인증서", detail: "백화점 영수증 또는 한국명품감정원 인증서.", required: true },
      { title: "봉제 디테일 클로즈업", detail: "안감 스티치 균일성. 신뢰 +.", required: false },
    ],
    askingPriceMarkupPct: 3,
    priceNote: "명품 가방 협상 폭 좁음 (3~5%). 정품 인증이 가장 큰 가치.",
    proTip: "영수증 + 한국명품감정원 인증서 둘 다 있으면 시세 +20~30% 가능. 더스트백/박스 풀세트 = 빠른 거래.",
  },

  perfume: {
    category: "perfume",
    label: "향수 (명품 브랜드)",
    titlePattern: "{brand} {model} {capacity}ml {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[면세점/백화점/공식몰] [yyyy-mm]" },
      { label: "잔량", hint: "미개봉 / [N]% 사용" },
      { label: "박스 상태", hint: "봉인 [O/X], 코드 라벨 [O/X]" },
      { label: "시리얼", hint: "박스 안쪽 + 병 바닥 코드 (사진)" },
      { label: "구성품", hint: "본체, 박스, 쇼핑백, 영수증 (있는 대로)" },
      { label: "거래 방법", hint: "안전결제 + 직거래 (향 직접 확인 가능)" },
    ],
    photos: [
      { title: "정면 + 후면", detail: "병 정면 + 라벨 후면.", required: true },
      { title: "박스 봉인 (미개봉 시)", detail: "비닐 봉인 또는 스티커 봉인.", required: true },
      { title: "박스 안쪽 코드 라벨", detail: "정품 시리얼 코드 위치.", required: true },
      { title: "병 바닥 시리얼/각인", detail: "각인 깊이 + 브랜드별 형식.", required: true },
      { title: "분사 시연 영상", detail: "미세 mist 형태 확인. 정품 인증.", required: false },
      { title: "영수증 (있으면)", detail: "면세점 또는 공식몰 영수증.", required: false },
    ],
    askingPriceMarkupPct: 5,
    priceNote: "향수는 미개봉/잔량 따라 가격 큰 차이. 미개봉 풀가, 사용감 -30~50%.",
    proTip: "미개봉 + 면세점 영수증 = 정품 신뢰 최상. 사용감 매물은 분사 시연 영상으로 신뢰 + 빠른 거래.",
  },

  watch: {
    category: "watch",
    label: "명품 시계 (롤렉스/오메가/태그호이어)",
    titlePattern: "{brand} {model} {reference} {status} (풀세트/하프세트)",
    bodyLines: [
      { label: "구매처/시기", hint: "[백화점/매장] [yyyy-mm] (워런티 카드 O)" },
      { label: "무브먼트", hint: "정품 [무브먼트 번호 / 자동/쿼츠]" },
      { label: "무게", hint: "[N]g (저울 사진 첨부)" },
      { label: "케이스백 시리얼", hint: "[시리얼 번호] (사진 첨부)" },
      { label: "구성품", hint: "본체, 박스, 워런티 카드, 매뉴얼, 부속품 (풀세트/하프세트)" },
      { label: "정품 보장", hint: "워런티 카드 또는 한국명품감정원 인증 가능" },
      { label: "거래 방법", hint: "안전결제 + 검수 거래 강력 권장" },
    ],
    photos: [
      { title: "정면 (다이얼)", detail: "다이얼 폰트 + 시침 디테일.", required: true },
      { title: "측면 + 케이스백", detail: "케이스백 시리얼 클로즈업.", required: true },
      { title: "무브먼트 (가능 시)", detail: "케이스백 열어서 무브먼트 사진. 정품 인증 핵심.", required: true },
      { title: "무게 (저울 위)", detail: "정품 무게 확인.", required: true },
      { title: "워런티 카드 원본", detail: "정품 인증 결정적.", required: true },
      { title: "박스/매뉴얼/부속품", detail: "풀세트 vs 하프세트 구분.", required: true },
      { title: "초침 작동 영상", detail: "자동시계는 부드러움. 영상 권장.", required: false },
    ],
    askingPriceMarkupPct: 3,
    priceNote: "명품 시계 협상 폭 좁음 (3%). 풀세트 vs 하프세트 가격 차이 큼.",
    proTip: "워런티 카드 + 박스 풀세트 = 시세 +15~25%. 무브먼트 사진 첨부 시 신뢰 + 빠른 거래.",
  },

  tablet: {
    category: "tablet",
    label: "태블릿 (아이패드/갤럭시탭)",
    titlePattern: "{brand} {model} {capacity} {network} {color} {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm] (영수증 O)" },
      { label: "시리얼", hint: "[번호] (apple.com/checkcoverage 조회 가능)" },
      { label: "iCloud 잠금", hint: "해제 완료" },
      { label: "외관 상태", hint: "액정 [무기스/기스], 후면 [무기스/사용감]" },
      { label: "배터리 사이클", hint: "[N]회 (코코넛 배터리 화면 첨부)" },
      { label: "구성품", hint: "본체, 충전기, 케이블, 박스" },
      { label: "AppleCare+", hint: "만료일 [yyyy-mm-dd]" },
    ],
    photos: [
      { title: "정면 (액정 켜짐)", detail: "잠금 화면. 액정 무기스 확인.", required: true },
      { title: "후면 + 측면", detail: "후면 사용감 + 측면 버튼.", required: true },
      { title: "박스 라벨 (시리얼)", detail: "박스 시리얼 vs 기기 시리얼 일치.", required: true },
      { title: "설정 → 정보 (시리얼 화면)", detail: "본체 시리얼 노출.", required: true },
      { title: "배터리 사이클 화면", detail: "코코넛 배터리 또는 시스템 정보.", required: false },
      { title: "충전기/케이블/박스", detail: "구성 풀세트.", required: false },
    ],
    askingPriceMarkupPct: 6,
    priceNote: "태블릿 협상 폭 6~8%. 풀박 + 사이클 낮음 = +α.",
    proTip: "풀박 + AppleCare+ 잔여 + 사이클 낮음 = 시세 +10~15%. iCloud 해제 영상 첨부 권장.",
  },

  smartwatch: {
    category: "smartwatch",
    label: "스마트워치 (애플워치/갤럭시워치)",
    titlePattern: "{brand} {model} {size} {material} {color} {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm]" },
      { label: "시리얼", hint: "[번호] (워치 앱 → 정보)" },
      { label: "Find My", hint: "해제 완료" },
      { label: "배터리 잔량", hint: "[N]% / 정상 작동" },
      { label: "외관 상태", hint: "액정 [무기스], 케이스 [무기스/사용감]" },
      { label: "구성품", hint: "본체, 충전기, 박스, 줄 (정품/예비)" },
      { label: "AppleCare+", hint: "만료일 [yyyy-mm-dd]" },
    ],
    photos: [
      { title: "정면 (화면 켜짐)", detail: "잠금 화면 또는 시계 화면.", required: true },
      { title: "후면 (센서)", detail: "심박 센서 + 마감 확인.", required: true },
      { title: "측면 (디지털 크라운)", detail: "크라운 마감 + 측면 사용감.", required: true },
      { title: "박스 + 시리얼", detail: "박스 시리얼 일치.", required: true },
      { title: "충전기 + 줄", detail: "정품 자기 충전기 + 줄.", required: false },
      { title: "Find My 해제 영상", detail: "이전 소유자 연결 끊김 시연.", required: false },
    ],
    askingPriceMarkupPct: 6,
    priceNote: "스마트워치 협상 폭 6~8%. 줄 정품/예비 줄 가치 추가.",
    proTip: "정품 줄 + 미사용 + 풀박 + AppleCare+ = +10~15%. 배터리 90%+ 시연.",
  },

  clothing: {
    category: "clothing",
    label: "명품 의류",
    titlePattern: "{brand} {model} {size} {color} {status} (정품 인증)",
    bodyLines: [
      { label: "구매처/시기", hint: "[백화점/공식몰] [yyyy-mm] (영수증 O)" },
      { label: "사이즈", hint: "[사이즈] 실측 [어깨/가슴/길이/소매]" },
      { label: "상태", hint: "미사용 (택 O) / 1~2회 착용 (택 X)" },
      { label: "정품 인증", hint: "안주머니 라벨 + DPP 코드 / 영수증" },
      { label: "구성품", hint: "본체, 더스트백, 박스, 영수증" },
      { label: "거래 방법", hint: "안전결제 + 직거래 (직접 확인 가능)" },
    ],
    photos: [
      { title: "정면 + 후면", detail: "전체 외관. 핏 확인.", required: true },
      { title: "안주머니 라벨 (시리얼)", detail: "정품 인증 핵심.", required: true },
      { title: "외부 택 (미사용 시)", detail: "가격 택 + 리테일 택 부착 상태.", required: true },
      { title: "사이즈/소재 워시 라벨", detail: "정품 폰트 + 한글 + 영어.", required: true },
      { title: "봉제 디테일 클로즈업", detail: "어깨/소매 봉제 균일성.", required: false },
      { title: "박스/더스트백/영수증", detail: "정품 포장 + 영수증.", required: false },
    ],
    askingPriceMarkupPct: 4,
    priceNote: "명품 옷 협상 폭 4~6%. 미사용 + 택 풀세트 = +α.",
    proTip: "미사용 + 택 + 영수증 + DPP 인증 = 시세 +15~20%. 사용감 매물은 신뢰도 표시 결정적.",
  },

  laptop: {
    category: "laptop",
    label: "노트북 (맥북/그램)",
    titlePattern: "{brand} {model} {capacity} {color} {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm] (영수증 O)" },
      { label: "시리얼", hint: "[번호] (바닥 + 시스템 리포트)" },
      { label: "iCloud/MS 계정", hint: "로그아웃 완료" },
      { label: "배터리 사이클", hint: "[N]회 (시스템 정보 화면)" },
      { label: "외관", hint: "무기스 / 약간 사용감 (사진)" },
      { label: "구성품", hint: "본체, 충전기, 박스 (있는 대로)" },
      { label: "AppleCare+", hint: "만료일 [yyyy-mm-dd]" },
      { label: "부품 갈이", hint: "없음 (시스템 리포트 첨부)" },
    ],
    photos: [
      { title: "정면 (열린 + 켜진 상태)", detail: "화면 켜짐. 액정 무기스.", required: true },
      { title: "닫힌 상태 + 측면 4면", detail: "외관 사용감 전체.", required: true },
      { title: "바닥 (시리얼)", detail: "바닥 시리얼 클로즈업.", required: true },
      { title: "박스 라벨", detail: "박스 시리얼 일치.", required: true },
      { title: "시스템 리포트 (시리얼/부품)", detail: "시리얼 + 메모리/저장공간 사양 + 부품 정품.", required: true },
      { title: "배터리 사이클 화면", detail: "시스템 정보 → 전원 → 사이클 카운트.", required: true },
      { title: "충전기/박스 구성", detail: "정품 충전기 풀세트.", required: false },
    ],
    askingPriceMarkupPct: 6,
    priceNote: "노트북 협상 폭 6~8%. 풀박 + 사이클 낮음 = +α.",
    proTip: "풀박 + 사이클 100회 미만 + AppleCare+ 잔여 = 시세 +10~15%. EFI 잠금 해제 확인 필수.",
  },

  drone: {
    category: "drone",
    label: "드론 (DJI)",
    titlePattern: "{brand} {model} {bundle} {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm] (영수증 O)" },
      { label: "시리얼/활성", hint: "[번호] / DJI 활성 [yyyy-mm] (정품 펌웨어)" },
      { label: "배터리 사이클", hint: "[N]회 (DJI Fly 화면)" },
      { label: "비행 시간", hint: "총 [N]시간 (DJI 기록)" },
      { label: "구성품", hint: "본체, 리모트, 배터리 [N]개, 충전기, 케이스, 프로펠러 예비" },
      { label: "정상 작동", hint: "짐벌 카메라 정상, 펌웨어 정품" },
      { label: "거래 방법", hint: "안전결제 + 비행 시연 가능" },
    ],
    photos: [
      { title: "정면 + 짐벌 카메라 클로즈업", detail: "짐벌 마감 + 카메라 상태.", required: true },
      { title: "후면 + 측면", detail: "프로펠러 + 모터 마감.", required: true },
      { title: "리모트 + 시리얼", detail: "리모트 정품 + 시리얼.", required: true },
      { title: "배터리 + 사이클 화면 (DJI Fly)", detail: "배터리 개수 + 사이클 카운트.", required: true },
      { title: "박스 + 케이스 + 구성품", detail: "풀박 + 케이스 + 예비 프로펠러.", required: true },
      { title: "비행 시연 영상", detail: "이륙 + 짐벌 회전 + 촬영.", required: false },
    ],
    askingPriceMarkupPct: 5,
    priceNote: "드론 협상 폭 5~7%. 배터리 개수 + 사이클이 가격 결정.",
    proTip: "배터리 3개+ + 풀박 + 사이클 50회 미만 = 시세 +10~15%. 정품 펌웨어 + 활성 기록 강조.",
  },

  camera: {
    category: "camera",
    label: "카메라 (소니/캐논/니콘)",
    titlePattern: "{brand} {model} {lens_kit} 셔터 {shutter}회 {status}",
    bodyLines: [
      { label: "구매처/시기", hint: "[정품 매장] [yyyy-mm] (한국 정품 / 병행수입)" },
      { label: "시리얼", hint: "[번호] (브랜드 사이트 조회 가능)" },
      { label: "셔터 카운트", hint: "[N]회 (Imaging Edge/Eos Info 화면)" },
      { label: "렌즈 상태", hint: "곰팡이 없음, 카비 없음 (백라이트 검사 사진)" },
      { label: "외관", hint: "무기스 / 약간 사용감" },
      { label: "구성품", hint: "본체, 렌즈, 배터리 [N]개, 충전기, 박스, 보증서" },
      { label: "펌웨어", hint: "정품 [버전]" },
      { label: "보증", hint: "한국 정품 [잔여 기간] / 보증 만료" },
    ],
    photos: [
      { title: "정면 (렌즈 장착)", detail: "본체 + 렌즈 + 마운트 상태.", required: true },
      { title: "후면 (LCD)", detail: "LCD 무기스 + 버튼 정상.", required: true },
      { title: "위/아래 + 측면", detail: "마운트 + 배터리 슬롯 + 메모리 슬롯.", required: true },
      { title: "셔터 카운트 화면 (Imaging Edge)", detail: "정확한 셔터 카운트 노출.", required: true },
      { title: "렌즈 정면/뒷면 (곰팡이 검사)", detail: "백라이트로 렌즈 안쪽 비춤. 곰팡이/카비 확인.", required: true },
      { title: "박스 + 보증서 + 구성품", detail: "한국 보증서 + 정품 박스.", required: true },
      { title: "동작 시연 영상 (AF/셔터)", detail: "오토포커스 + 셔터 + 저장.", required: false },
    ],
    askingPriceMarkupPct: 6,
    priceNote: "카메라 협상 폭 6~8%. 셔터 카운트 + 렌즈 곰팡이가 가격 결정.",
    proTip: "셔터 5만 미만 + 렌즈 깨끗 + 한국 정품 + 풀박 = 시세 +10~15%. 곰팡이 검사 사진 신뢰 결정적.",
  },
};

export function sellHelperFor(category: string | null | undefined): SellHelperCategory | null {
  if (!category) return null;
  return SELL_HELPER[category.toLowerCase()] ?? null;
}

// 추천 호가 계산 — 시세 + 카테고리별 markupPct
export function suggestedAskingPrice(category: string | null | undefined, medianPrice: number) {
  const helper = sellHelperFor(category);
  if (!helper) return null;
  const markupPct = helper.askingPriceMarkupPct;
  return {
    askingPrice: Math.round(medianPrice * (1 + markupPct / 100)),
    targetClosePrice: medianPrice,
    markupPct,
  };
}

// 본문 템플릿을 텍스트 블록으로 — 사용자 복붙용.
export function buildBodyTemplate(category: string | null | undefined, productName: string) {
  const helper = sellHelperFor(category);
  if (!helper) return null;
  const lines = helper.bodyLines.map((line, idx) => `${idx + 1}. ${line.label}: ${line.hint}`);
  return [
    `[${productName}]`,
    "",
    ...lines,
    "",
    "문의 환영합니다. 안전결제 가능합니다.",
  ].join("\n");
}
