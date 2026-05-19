// Wave 2026-05-19 (외부인 #2 카테고리별 가품 체크리스트):
// 한국 중고시장 실 가품 패턴 기반. 12개 위험 카테고리. 카테고리당 5~8개 체크 항목.
// "필수" = 안 하면 거래 안 됨 / "권장" = 가능하면 / "참고" = 추가 신뢰 신호.
//
// 카테고리 매핑은 RevealCard.marketBasis.comparableKey 또는 categoryFromComparableKey() 활용.
// 안전 카테고리 (monitor/desktop/lego/speaker/kickboard/game_console/home_appliance/sport_golf)는
// 의도적으로 미포함 — 카드에 노이즈 안 박음.

export type CounterfeitCheckPriority = "must" | "recommended" | "extra";

export type CounterfeitCheck = {
  title: string;
  detail: string;
  priority: CounterfeitCheckPriority;
};

export type CounterfeitCategoryChecklist = {
  category: string;
  label: string;
  riskHeadline: string;
  checks: CounterfeitCheck[];
};

export const COUNTERFEIT_CHECKLIST: Record<string, CounterfeitCategoryChecklist> = {
  shoe: {
    category: "shoe",
    label: "신발 (스니커즈)",
    riskHeadline: "한국 중고 스니커즈는 가품 위험 최상위. KREAM 검수 인증 없는 매물은 항상 의심.",
    checks: [
      {
        title: "KREAM/솔드아웃 검수 기록 사진",
        detail: "정품 인증 거친 신발이면 검수 카드/태그 사진 요청. 검수 없는 매물은 단가 낮춰서라도 +반품 보호 필수.",
        priority: "must",
      },
      {
        title: "박스 사이드 라벨 사진",
        detail: "스타일 번호 + 컬러 코드 + 사이즈가 모두 일치해야 함. 박스 코드와 신발 안창 사이즈 라벨 비교.",
        priority: "must",
      },
      {
        title: "솔(밑창) 패턴 클로즈업",
        detail: "정품은 솔 패턴이 균일하고 선명. 짭은 모서리가 흐리고 글자 깊이가 얕음. 솔 정면 + 측면 사진.",
        priority: "must",
      },
      {
        title: "로고/스우시 디테일",
        detail: "스우시 곡선 끝부분, 아디다스 3선 간격, 뉴발란스 N자 폭. 짭은 0.5mm~1mm 차이로 다름.",
        priority: "must",
      },
      {
        title: "안창 사이즈 라벨 폰트",
        detail: "US/EU/CM 표기 + 폰트 균일성. 정품은 모든 라벨 폰트가 동일 깊이/굵기.",
        priority: "recommended",
      },
      {
        title: "안창/혀 봉제선",
        detail: "정품은 봉제 간격 균일. 짭은 흐트러짐/들뜸. 안창 봉제 사진 요청.",
        priority: "recommended",
      },
      {
        title: "구매 인보이스/영수증",
        detail: "정품 매장(나이키 매장, ABC마트, 무신사) 영수증. 해외 직구면 배송 추적 화면.",
        priority: "recommended",
      },
    ],
  },

  smartphone: {
    category: "smartphone",
    label: "스마트폰 (아이폰/갤럭시)",
    riskHeadline: "가품보다 잠금/부품 갈이/IMEI 위변조 위험. 통신사 잠금은 사용 불가 직결.",
    checks: [
      {
        title: "IMEI/시리얼 조회",
        detail: "아이폰: apple.com/checkcoverage 입력 결과 사진. 갤럭시: 통신사 SK/KT/LG에서 IMEI 조회. 조회 안 되면 위변조 가능성.",
        priority: "must",
      },
      {
        title: "Find My iPhone / Find My Mobile 해제",
        detail: "이전 소유자 계정 연결 끊김 영상. iCloud/삼성계정 로그아웃 → 새 계정 로그인 가능 확인.",
        priority: "must",
      },
      {
        title: "통신사 잠금 여부",
        detail: "자급제 vs 통신사 잠금. 잠금은 다른 통신사 USIM 미사용. 설정 → 정보 → '캐리어 잠금'.",
        priority: "must",
      },
      {
        title: "부품 갈이 (디스플레이/배터리/카메라)",
        detail: "아이폰: 설정 → 정보 → 화면 아래 '정품 부품' 항목. 비정품이면 '확인되지 않은 부품' 표시. 갤럭시: Smart Switch로 인증.",
        priority: "must",
      },
      {
        title: "배터리 최대 용량 %",
        detail: "설정 → 배터리 → 최대 용량. 80% 미만이면 배터리 교체 필요 (애플 8.9만원). 거래가에 반영.",
        priority: "recommended",
      },
      {
        title: "AppleCare+ / 통신사 보증 만료일",
        detail: "보증 잔여 6개월 이상이면 +5만원 가치. apple.com/checkcoverage에서 확인.",
        priority: "recommended",
      },
      {
        title: "박스/구성품 시리얼 일치",
        detail: "박스 라벨 IMEI vs 폰 IMEI 동일. 정품 충전기/케이블 포함 여부.",
        priority: "recommended",
      },
    ],
  },

  earphone: {
    category: "earphone",
    label: "이어폰 (에어팟/버즈/보스/소니/비츠)",
    riskHeadline: "한국 중고 가품 1위 품목. 짭 에어팟이 정품 케이스에 들어있는 경우도 많음.",
    checks: [
      {
        title: "시리얼 코드 사진 (충전 케이스 안쪽)",
        detail: "에어팟: 케이스 뚜껑 열고 안쪽 각인. 갤럭시 버즈: 박스 코드. apple.com/checkcoverage 조회 결과까지 요청.",
        priority: "must",
      },
      {
        title: "Find My 해제 + 새 페어링 가능",
        detail: "이전 소유자 Apple ID 연결 끊김. 새 폰과 페어링 시연 영상. 페어링 안 되면 100% 짭/도난.",
        priority: "must",
      },
      {
        title: "노이즈 캔슬 시연 영상",
        detail: "정품 에어팟 프로/맥스/4 ANC는 노캔 작동. 짭은 미작동 또는 '가짜 모드'. 시끄러운 환경에서 영상.",
        priority: "must",
      },
      {
        title: "공간 음향/투명 모드 작동",
        detail: "정품은 머리 돌려도 음향이 고정. 짭은 평면 스테레오. 영상으로 확인.",
        priority: "recommended",
      },
      {
        title: "충전 케이스 무게/마감",
        detail: "에어팟 프로 2: 정품 50.8g. 짭은 ±10g 차이. 이음새 매끈도, 라이트닝/USB-C 포트 깊이.",
        priority: "recommended",
      },
      {
        title: "배터리 사이클 (가능 시)",
        detail: "에어팟 배터리 사이클은 직접 확인 어려움. 사용감 + 배터리 지속 시간으로 추정.",
        priority: "extra",
      },
    ],
  },

  bag: {
    category: "bag",
    label: "가방 (명품)",
    riskHeadline: "명품 중고시장 가품 비율 30%+. 인증 거치지 않은 매물은 100% 의심.",
    checks: [
      {
        title: "시리얼/데이트 코드 위치 사진",
        detail: "LV: 안쪽 핀스탬프 (모델별 위치 다름). 샤넬: 미니북릿/홀로그램. 구찌: 라벨 뒷면. 에르메스: 핸들 아래 각인.",
        priority: "must",
      },
      {
        title: "백화점/매장 영수증 또는 인증서",
        detail: "정품 영수증 또는 진품 감정서 (한국명품감정원 등). 영수증 없으면 가품 의심도 +50%.",
        priority: "must",
      },
      {
        title: "봉제선 균일성 (안감)",
        detail: "정품은 스티치 간격 정확. 짭은 들뜸/불균일. 안감 사진 + 봉제 클로즈업 요청.",
        priority: "must",
      },
      {
        title: "패턴 매칭 (모노그램)",
        detail: "LV/구찌 모노그램은 양면 대칭. 짭은 패턴이 어긋나거나 잘림. 정면/측면 사진.",
        priority: "recommended",
      },
      {
        title: "금속 부품 무게/각인 깊이",
        detail: "정품은 무겁고 매끈. 각인은 깊고 균일. 짭은 가볍고 각인 얕음.",
        priority: "recommended",
      },
      {
        title: "박스/더스트백 정품",
        detail: "정품 더스트백 폰트/색상 일정. 박스 라벨 코드. 더스트백만으로는 인증 부족.",
        priority: "recommended",
      },
      {
        title: "가죽 냄새/감촉",
        detail: "정품은 자연 가죽 향. 짭은 화학/플라스틱 냄새. 직접 만져봤다고 표현하는 셀러는 신뢰도 +.",
        priority: "extra",
      },
    ],
  },

  perfume: {
    category: "perfume",
    label: "향수 (명품 브랜드)",
    riskHeadline: "향수 가품은 알코올 비율 변조. 피부 트러블 + 향 지속 시간 짧음.",
    checks: [
      {
        title: "박스 바코드/시리얼 코드",
        detail: "정품 바코드 패턴 + 박스 안쪽 시리얼. 동일 코드 다른 매물에 쓰였는지 검색.",
        priority: "must",
      },
      {
        title: "캡 모양/이음새 마감",
        detail: "정품 캡은 매끈 + 묵직. 짭은 가볍고 이음새 거침. 캡 클로즈업 사진.",
        priority: "must",
      },
      {
        title: "분사 시연 영상",
        detail: "정품은 미세 mist 형태. 짭은 굵은 spray 또는 액체 흘러나옴. 영상 요청.",
        priority: "must",
      },
      {
        title: "병 바닥 시리얼/각인",
        detail: "정품 병 바닥 각인 (브랜드별 형식). 짭은 각인 없거나 흐릿.",
        priority: "recommended",
      },
      {
        title: "박스 봉인 (미개봉 시)",
        detail: "비닐 봉인 또는 스티커. 미개봉 매물인데 봉인 없으면 의심.",
        priority: "recommended",
      },
      {
        title: "향 변질/알코올 냄새",
        detail: "오래된 가품/유통기한 지난 정품은 알코올 냄새 강함. 향이 5분 안에 사라짐.",
        priority: "extra",
      },
    ],
  },

  watch: {
    category: "watch",
    label: "명품 시계 (롤렉스/오메가/태그호이어)",
    riskHeadline: "명품 시계 가품 정밀도 매우 높음. 무브먼트 + 무게로 판별.",
    checks: [
      {
        title: "케이스백 무브먼트 사진",
        detail: "셀러에게 케이스백 열어 무브먼트 사진 요청. 정품 무브먼트 시리얼 각인 + 마감. 짭은 무브먼트 완전 다름.",
        priority: "must",
      },
      {
        title: "무게 측정 (저울)",
        detail: "정품 롤렉스 서브마리너 ~155g. 짭은 130~140g. 10~30g 차이. 저울 위 무게 사진.",
        priority: "must",
      },
      {
        title: "케이스백 시리얼/모델 번호",
        detail: "브랜드별 시리얼 형식. 위변조 흔적 (각인 위 덧칠). 시리얼 조회 가능.",
        priority: "must",
      },
      {
        title: "인증서/워런티 카드 원본",
        detail: "정품 워런티 카드 (브랜드별 다름). 카드 없으면 백화점 영수증.",
        priority: "must",
      },
      {
        title: "초침 작동 영상",
        detail: "정품 자동시계는 부드러움 (8회/초 진동). 짭은 1초 간격 똑딱. 초침 10초 영상.",
        priority: "recommended",
      },
      {
        title: "다이얼 디테일 (폰트/도장)",
        detail: "정품은 폰트 일정 + 도장 깊이 균일. 야광 도색 마감. 클로즈업 사진.",
        priority: "recommended",
      },
    ],
  },

  tablet: {
    category: "tablet",
    label: "태블릿 (아이패드/갤럭시탭)",
    riskHeadline: "iCloud/삼성계정 잠금이 가품보다 큰 위험. 잠긴 기기는 벽돌.",
    checks: [
      {
        title: "iCloud / 삼성계정 잠금 해제 영상",
        detail: "Find My iPad 해제 + iCloud 로그아웃 → 새 계정 로그인. 영상으로 전 과정 확인.",
        priority: "must",
      },
      {
        title: "시리얼 조회 (apple.com/checkcoverage)",
        detail: "설정 → 정보 → 시리얼. apple.com/checkcoverage 조회 결과 사진. 갤럭시탭은 Samsung Members.",
        priority: "must",
      },
      {
        title: "액정 부품 갈이 확인",
        detail: "설정 → 정보 → '비정품 디스플레이' 메시지 있으면 액정 교체 이력. 거래가 -10~15% 차감.",
        priority: "must",
      },
      {
        title: "배터리 사이클",
        detail: "코코넛 배터리 같은 도구로 사이클 카운트. 1000회 미만 권장.",
        priority: "recommended",
      },
      {
        title: "AppleCare+ 보증",
        detail: "보증 잔여 확인. 6개월+ 잔여면 +가치.",
        priority: "recommended",
      },
      {
        title: "박스/구성 시리얼 일치",
        detail: "박스 라벨 시리얼 vs 기기 시리얼. 충전기 정품.",
        priority: "recommended",
      },
    ],
  },

  smartwatch: {
    category: "smartwatch",
    label: "스마트워치 (애플워치/갤럭시워치)",
    riskHeadline: "Find My 잠금 + 배터리 수명이 핵심. 짭 애플워치는 거의 없지만 잠금은 흔함.",
    checks: [
      {
        title: "Find My / 활성화 잠금 해제 영상",
        detail: "이전 소유자 Apple ID 연결 끊김. 새 폰과 페어링 시연. 잠금 풀린 채로 거래 필수.",
        priority: "must",
      },
      {
        title: "페어링 시연 + 정상 작동",
        detail: "새 폰과 페어링 영상 + 심박/걸음 정상 작동. ECG/혈중산소 작동 (정품만).",
        priority: "must",
      },
      {
        title: "시리얼 조회",
        detail: "워치 앱 → 일반 → 정보 → 시리얼. apple.com/checkcoverage 조회.",
        priority: "must",
      },
      {
        title: "배터리 잔량 / 사이클",
        detail: "애플워치는 사이클 직접 확인 어려움. 사용감 등급별 배터리 정상 (~80%+) 시연 필요.",
        priority: "recommended",
      },
      {
        title: "액정 부품 갈이",
        detail: "비정품 디스플레이 메시지 확인. 스크린 색감/터치 균일성.",
        priority: "recommended",
      },
      {
        title: "박스/충전기 정품",
        detail: "박스 코드, 정품 자기 충전기 (짭 충전기는 발열).",
        priority: "extra",
      },
    ],
  },

  clothing: {
    category: "clothing",
    label: "명품 의류",
    riskHeadline: "명품 옷 가품도 흔함. 라벨/봉제/안감 시리얼 3축 확인.",
    checks: [
      {
        title: "내부 라벨/태그 사진",
        detail: "브랜드 정품 폰트 + 봉제 균일. 워시 라벨 (한글 + 영어 + 사이즈 + 소재 표기).",
        priority: "must",
      },
      {
        title: "안감 시리얼/홀로그램",
        detail: "스톤아일랜드: 안주머니 라벨 인증 카드. 버버리: 안감 시리얼. 몽클레르: 홀로그램 + DPP 코드.",
        priority: "must",
      },
      {
        title: "정품 영수증 또는 미사용 택",
        detail: "백화점/매장 영수증. 미사용 매물은 가격 택/리테일 택 부착.",
        priority: "must",
      },
      {
        title: "봉제 디테일",
        detail: "정품은 스티치 균일. 짭은 들뜸/꼬임. 안감 + 어깨/소매 봉제 사진.",
        priority: "recommended",
      },
      {
        title: "워시 라벨 폰트/소재",
        detail: "정품은 라벨 폰트 일정 + 소재 표기 정확 (실사 비율). 짭은 폰트 다름 또는 오타.",
        priority: "recommended",
      },
      {
        title: "박스/포장",
        detail: "백화점 박스 또는 정품 더스트백. 포장만으론 인증 부족이지만 신뢰 +.",
        priority: "extra",
      },
    ],
  },

  laptop: {
    category: "laptop",
    label: "노트북 (맥북/그램)",
    riskHeadline: "EFI 잠금 + 부품 갈이 + 배터리 사이클이 핵심. 짭은 적지만 부품 위변조 위험.",
    checks: [
      {
        title: "시리얼 조회 + 부팅 영상",
        detail: "바닥 시리얼 사진. 맥북: apple.com/checkcoverage. 그램: LG 사이트. 부팅 → iCloud/MS 계정 로그아웃 영상.",
        priority: "must",
      },
      {
        title: "EFI/펌웨어 잠금 해제 (맥북)",
        detail: "맥북: 시동 시 EFI 비밀번호 없음 확인 + recovery 모드 진입 가능. 잠긴 맥북은 사용 불가.",
        priority: "must",
      },
      {
        title: "배터리 사이클 카운트",
        detail: "맥북: 시스템 정보 → 전원. 그램: HWiNFO 같은 도구. 1000회 미만 권장. 그 이상은 배터리 교체 필요.",
        priority: "must",
      },
      {
        title: "부품 갈이 확인 (맥북)",
        detail: "시스템 리포트 → 메모리/저장공간 사양 일치. 비정품 부품은 시스템에서 알림.",
        priority: "recommended",
      },
      {
        title: "AppleCare+ 보증 (맥북)",
        detail: "잔여 보증 6개월+면 +5~10만원 가치.",
        priority: "recommended",
      },
      {
        title: "키보드 정품 (한국 매장)",
        detail: "한국 매장 키보드 = 한글 각인. 해외 직구 = 영문 only. 가격 차이 있음.",
        priority: "extra",
      },
      {
        title: "박스/충전기 정품",
        detail: "정품 충전기 (와트 표기 일치). 박스 시리얼 일치.",
        priority: "recommended",
      },
    ],
  },

  drone: {
    category: "drone",
    label: "드론 (DJI 위주)",
    riskHeadline: "DJI 활성화 기록 + 펌웨어 위변조 + 배터리 사이클이 핵심. 해킹 모델은 비행 금지.",
    checks: [
      {
        title: "DJI 활성화 기록 + 시리얼",
        detail: "DJI Assistant 앱 또는 DJI Fly에서 시리얼 + 활성화 날짜 확인. 셀러 계정 → 새 계정 인계 가능 확인.",
        priority: "must",
      },
      {
        title: "배터리 사이클 카운트",
        detail: "DJI Fly 앱 → 배터리 정보 → 사이클. 50회 미만 권장. 200회+ 면 배터리 수명 단축.",
        priority: "must",
      },
      {
        title: "짐벌 카메라 시연 영상",
        detail: "이륙 + 짐벌 회전 + 촬영 영상. 짐벌 모터 소음 정상 (윙윙).",
        priority: "must",
      },
      {
        title: "펌웨어 위변조 (해킹) 여부",
        detail: "DJI Assistant가 펌웨어 정상 인식. 커스텀 펌웨어(NLD/모드)는 비행 금지/추적 차단. 정품 펌웨어 영상.",
        priority: "must",
      },
      {
        title: "컴퓨터 연결 + 인식",
        detail: "USB 연결 시 DJI Assistant 정상 인식 영상. 인식 안 되면 메인보드 위변조.",
        priority: "recommended",
      },
      {
        title: "박스/리모트/프로펠러 정품",
        detail: "정품 리모트 (펌웨어 정상). 정품 프로펠러 (저진동 vs 짭은 흔들림).",
        priority: "recommended",
      },
    ],
  },

  camera: {
    category: "camera",
    label: "카메라 (소니/캐논/니콘)",
    riskHeadline: "셔터 카운트 + 렌즈 곰팡이 + 펌웨어가 핵심. 가품보단 사용감 위변조 위험.",
    checks: [
      {
        title: "셔터 카운트 조회",
        detail: "캐논: Eos Info. 소니: Imaging Edge. 니콘: ShutterCount.com. 5만 회 미만 권장. 10만+ 면 셔터 교체 필요.",
        priority: "must",
      },
      {
        title: "렌즈 곰팡이/카비 검사",
        detail: "백라이트로 렌즈 안쪽 비춤. 곰팡이/먼지/카비 확인. 렌즈 정면 + 뒷면 사진.",
        priority: "must",
      },
      {
        title: "펌웨어 정품 + 메뉴",
        detail: "메뉴 → 펌웨어 버전. 브랜드 정식 펌웨어 (해킹 펌웨어 X). 시리얼 조회.",
        priority: "must",
      },
      {
        title: "센서 클리닝/먼지",
        detail: "센서 정면 사진 (조명 비추기). 먼지/스크래치 확인. 센서 클리닝은 5~10만원.",
        priority: "recommended",
      },
      {
        title: "박스/보증서/한국 정품",
        detail: "병행수입 vs 한국 정품 구분. 한국 보증서 있으면 +가치.",
        priority: "recommended",
      },
      {
        title: "동작 시연 (AF/노출/저장)",
        detail: "오토포커스 + 셔터 + 저장 시연 영상. 메모리 카드 슬롯 인식.",
        priority: "recommended",
      },
    ],
  },
};

// RevealCard → 우리 카테고리 매핑은 categoryFromComparableKey() 함수가 처리.
// 여기선 카테고리 라벨 입력받아 체크리스트 반환.

export function counterfeitChecklistFor(category: string | null | undefined): CounterfeitCategoryChecklist | null {
  if (!category) return null;
  return COUNTERFEIT_CHECKLIST[category.toLowerCase()] ?? null;
}

export const PRIORITY_LABEL: Record<CounterfeitCheckPriority, string> = {
  must: "필수",
  recommended: "권장",
  extra: "참고",
};
