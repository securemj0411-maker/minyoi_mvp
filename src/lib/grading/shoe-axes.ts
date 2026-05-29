// Wave 714 (2026-05-23): 신발 raw 텍스트 → 5-axis 라벨링.
//
// cross-tab agent (ac955968c16adba21, 2026-05-23) 의 axis 정의와 1:1 일치.
// SQL ~* (POSIX regex) 패턴을 JS-side negation-aware matcher 로 옮김.
//
// Wave 714b (2026-05-23): text-sanitize 적용 — 셀러 boilerplate 등급표 / 시제 모호 제거.

import { sanitizeForGrading } from "./text-sanitize";
import type { AxisLabels, BrandCluster } from "./types";

// =============================================================================
// Axis A — 사용감 (raw 표현, n=11,087 매칭률 기반)
// =============================================================================

const A_UNWORN = [
  "미시착", "미사용", "미착용", "데드스탁", "deadstock", "dead stock",
  "미개봉", "박스 미개봉", "박스미개봉",
  "새상품", "새 상품", "새제품", "새 제품", "새신발", "새 신발", "새거", "새 것",
];
// Wave 720 (2026-05-23): 17K sample sweep — 216건 uncovered S 신호 발견.
//   "시착만" 148건 / "한번도 안 신" 70건 / "신어보기만" 8건 추가.
//   13% S-cover 확장. pid 221667421 sample mismatch (40만원 시착만 → B → S/A 정정).
const A_WORN_1TO2 = [
  "1회 착용", "1회착용", "1회 신음", "1회신음", "1번 신음", "1번 착용",
  "한번 착용", "한번만 착용", "한 번 착용", "한번 신음", "한번신음",
  "한번 신어서", "한번신어서", "한 번 신어서", "딱 한번",
  "실착 1회", "실착1회", "실내 시착", "실내시착",
  // Wave 720 추가
  "시착만", "시착 만",
  "한번도 안 신", "한 번도 안 신", "한번도안신", "한 번도안신",
  "신어보기만", "신어보기만 함", "신어 보기만",
  "집에서 시착만", "집에서시착만",
];
// Wave 714b (2026-05-23): ready sample 검증 발견 누락 표현 추가.
//   - "거의 새것/거의 새상품/거의 새신발" — A_WORN_3TO5 진입 (의류 cross-tab 검증 / 1.05~1.08x).
//   - "사용감 거의 없" / "사용감 적음" / "사용감 적게" — 셀러 자주 사용 표현.
//   - "4-5회 착용" / "4-5번 신음" — 기존 "3회 까지" 만 있어서 누락.
const A_WORN_3TO5 = [
  "2~3회 착용", "2-3회 착용", "2회 착용", "3회 착용", "4회 착용", "5회 착용",
  "2번 신음", "3번 신음", "4번 신음", "5번 신음",
  "2번 착용", "3번 착용", "4번 착용", "5번 착용",
  "두번 신음", "세번 신음", "네번 신음", "다섯번 신음",
  "잠깐 신음", "잠깐 착용", "보관만", "보관품",
  "거의 새것", "거의새것", "거의 새상품", "거의새상품", "거의 새신발", "거의새신발", "거의 새 신발",
  "새상품급", "새 상품급", "새제품급", "새 제품급", "민트급", "민트 급",
  "사용감 거의 없", "사용감거의없", "사용감 없", "사용감없",
  "사용감 적", "사용감적",
];
// Wave 714b: "10번정도/여러번/한 10번/10회" 등 broad 사용 표현 — A_USED.
const A_USED = [
  "사용감 있음", "사용감있음", "사용감 있", "사용감있",
  "사용감 있습니다", "사용감있습니다", "사용감 있어", "사용감있어",
  "5번 신음", "5회 착용",
  "10회 착용", "10번 신음", "10번정도", "10번 정도",
  "여러번 신음", "여러 번 신음", "여러번 착용", "여러 번 착용",
  "상태 보통",
];
const A_HEAVILY_USED = ["많이 신음", "많이신음", "오래 신음", "오래신음", "사용감 많음", "사용감많음", "사용감 큼"];
const A_VINTAGE = ["빈티지", "vintage", "오래된"];

// =============================================================================
// Axis B — 박스/구성품
// =============================================================================

// Wave 720 (2026-05-23): 17K sample — 더스트백/dust bag 388건, 영수증/인보이스 306건, 보증서 102건 발견.
//   더스트백+박스 결합 276건은 full 상승. 영수증/인보이스/보증서 단독 → box_included.
const B_FULL = [
  "풀구성", "풀 구성", "풀박", "풀박스", "풀 박스", "완전체",
  // Wave 720 추가 — 박스 외 추가 구성품 (full 신호 강화)
  "더스트백", "더스트 백", "dust bag",
];
const B_BOX_INCLUDED = [
  "박스 포함", "박스포함", "박스 있음", "박스있",
  // Wave 720 추가 — 단독 영수증/인보이스/보증서 박스 있음 신호
  "영수증", "인보이스", "보증서", "개런티 카드", "개런티카드",
];
const B_BOX_ONLY = ["박스만"];
const B_NO_BOX = ["박스 없음", "박스없", "박스없음"];
const B_BOX_DAMAGED = ["박스 손상", "박스 찌그", "박스찌그"];

// =============================================================================
// Axis C — 정품 anchor
// =============================================================================

// Wave 720 (2026-05-23): 17K sample — "크림택 달려있음" 72건 단독 강력 S 신호 발견.
//   pid 347553600 "구매후 한번도 안신은 새상품(크림택 달려있음)" — 시스템 A → S 정정.
const C_KREAM = [
  "kream", "크림", "kream 구매", "크림 구매", "kream구매", "크림구매", "kream 인증", "크림 검수",
  // Wave 720 추가 — 크림택 (kream tag) 단독 신호
  "크림택", "크림 택", "kream 택", "kream택",
];
// Wave 714b (2026-05-23): ready sample 검증 — "매장용/공홈/국내 발매/정상가" 누락 추가.
const C_STORE = [
  "매장판", "매장 구매", "매장구매", "매장용", "매장가",
  "백화점", "면세점",
  "abcmart", "abc마트", "풋락커",
  "정가", "정상가", "원가",
  "공홈", "공식몰", "공식 발매", "공식발매",
  "국내 발매", "국내발매", "한국 발매", "한국발매",
  "아디다스코리아", "나이키코리아", "아식스코리아", "뉴발란스코리아", "푸마코리아",
];
const C_MUSINSA = ["무신사"];

// =============================================================================
// Axis D — 하자 (negation 차단 필수)
// =============================================================================

const D_MAJOR = [
  "이염 있음",
  "이염있음",
  "이염 있습니다",
  "이염있습니다",
  "이염 있",
  "이염있",
  "구멍",
  "터짐",
  "터진",
  "찢어짐",
  "찢어진",
  "굽 닳음",
  "굽닳음",
  "데미지 있음",
  "데미지있음",
  "하자 있음",
  "하자있음",
  "분리됨",
  "수리",
  "접착",
  // Wave 720 (2026-05-23): 17K sample — 솔/밑창 하자 표현 추가 (negation matcher가 "없고" 자동 처리).
  "솔 갈림", "솔갈림", "솔 마모", "솔마모",
  "밑창 닳음", "밑창닳음", "밑창 떨어짐", "밑창떨어짐",
  "뒷굽닳음", "뒷굽 닳음",
  "갑피 찢어짐", "갑피찢어짐",
];
const D_MINOR = [
  "보푸라기",
  "보풀",
  "먼지",
  "오염 있음",
  "오염있음",
  "오염 있습니다",
  "오염있습니다",
  "오염 있",
  "오염있",
  "오염 있는데",
  "오염있지만",
  "미세 오염",
  "작은 오염",
  "약간의 오염",
  "얼룩 있음",
  "얼룩있음",
  "얼룩 있습니다",
  "얼룩있습니다",
  "얼룩 있",
  "얼룩있",
  "약간의 얼룩",
  "미세 얼룩",
  "작은 얼룩",
  "스크래치",
  "긁힘",
  "마모",
  "누렁",
];

// =============================================================================
// Axis E — 신발 특화
// =============================================================================

const E_EXTRA_LACES = ["여분끈", "여분 끈", "여분신발끈", "여분 신발끈"];
const E_INSOLE_CHANGED = ["깔창 교체", "인솔 교체", "깔창교체", "인솔교체"];
const E_WASHED = ["세탁"];

// =============================================================================
// Negation-aware matcher
// =============================================================================

const NEGATION_SUFFIXES = ["없음", "없습", "없네", "없어", "없고", "없다", "없이", "안함", "X", "x", "X.", "x."];
// Wave launch-80: list 끝 부정 패턴 — 의류 audit 에서 발견한 "X Y Z 없음" / "X 등 없" / "X 외에" 처리 (clothing-axes.ts 와 동일).
const LIST_NEG_TERMINATORS = [
  /^[\s가-힣A-Za-z]*\s*등\s*(없음|없습|없네|없어|없이|X|x|x\.|X\.)/,
  /^[\s가-힣A-Za-z]*\s*외(에|로)?\s*(없|깨끗|괜찮)/,
  /^[\s가-힣A-Za-z,]*\s*(없음|없습|없네|없어|없이|없는)\b/,
  // Wave launch-80b: 괄호/콤마 list 끝 X negation.
  /^[\s가-힣A-Za-z,]*\s*(X|x)(\b|\.|\)|,|\s|$)/,
];

/**
 * keyword 가 text 에 있는지 — keyword 직후 negation suffix 흡수.
 *
 * 예: "이염 없음" → match("이염") = false
 *     "오염 없음" → match("오염") = false
 *     "이염 있음" → match("이염") = true
 *     "안 닳음" → match("닳음") = false (직전 "안")
 *     Wave launch-80: "스크래치 등 없" / "이염 외 깨끗" / "스크래치 늘어남 없음" 도 negation 처리.
 */
function matchesKeyword(text: string, keyword: string): boolean {
  let searchFrom = 0;
  while (searchFrom <= text.length) {
    const idx = text.indexOf(keyword, searchFrom);
    if (idx < 0) return false;
    const after = text.slice(idx + keyword.length, idx + keyword.length + 10);
    let isNegated = false;
    for (const neg of NEGATION_SUFFIXES) {
      if (after.startsWith(neg) || after.startsWith(" " + neg)) {
        isNegated = true;
        break;
      }
    }
    // Wave launch-80: list 끝 부정 처리.
    if (!isNegated) {
      const afterExtended = text.slice(idx + keyword.length, idx + keyword.length + 20);
      for (const re of LIST_NEG_TERMINATORS) {
        if (re.test(afterExtended)) { isNegated = true; break; }
      }
    }
    if (!isNegated) {
      const before = text.slice(Math.max(0, idx - 3), idx);
      if (/안\s?$/.test(before)) isNegated = true;
    }
    if (!isNegated) return true;
    // 매칭됐지만 negation 흡수 — 같은 keyword 다음 위치에서 다시 검색.
    searchFrom = idx + keyword.length;
  }
  return false;
}

function anyMatch(text: string, keywords: readonly string[]): { hit: boolean; matched: string[] } {
  const matched: string[] = [];
  for (const kw of keywords) {
    if (matchesKeyword(text, kw)) matched.push(kw);
  }
  return { hit: matched.length > 0, matched };
}

// =============================================================================
// Brand cluster mapping
// =============================================================================

const CLUSTER_KEYWORDS: ReadonlyArray<{ cluster: BrandCluster; keywords: readonly string[] }> = [
  {
    cluster: "casual_parts",
    keywords: ["crocs", "크록스"],
  },
  {
    cluster: "premium_snk",
    keywords: ["jordan", "조던", "yeezy", "이지부스트", "이지 부스트", "new balance", "뉴발란스", "salomon", "살로몬", "on running", "on cloud", "온러닝", "온 러닝"],
  },
  {
    cluster: "run_tech",
    keywords: ["asics", "아식스", "hoka", "호카", "saucony", "써코니"],
  },
  {
    cluster: "volume_vintage",
    keywords: [
      "nike", "나이키",
      "adidas", "아디다스",
      "converse", "컨버스",
      "vans", "반스",
      "puma", "푸마",
      // Wave 714b (2026-05-23): outdoor/casual 신발 추가 (ready sample 발견 — 노스페이스 뮬 generic 으로 떨어짐).
      "north face", "노스페이스", "tnf ", "thermoball", "nuptse",
      "dr.martens", "dr martens", "닥터마틴", "닥마",
      "timberland", "팀버랜드", "팀버",
      "ugg", "어그",
    ],
  },
] as const;

export function detectShoeBrandCluster(name: string): BrandCluster {
  const lower = name.toLowerCase();
  for (const { cluster, keywords } of CLUSTER_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cluster;
    }
  }
  return "generic";
}

// =============================================================================
// 5-axis labeling (raw text → AxisLabels)
// =============================================================================

export interface LabelInput {
  name: string;
  description: string | null | undefined;
}

export function labelShoeAxes(input: LabelInput): {
  labels: AxisLabels;
  positiveMatches: string[];
  negativeMatches: string[];
} {
  // sanitize: boilerplate 등급표 ("S: 새상품 / A: 사용감 / B: 스크래치 이염") 제거
  //         + "오래 입을 수 있" 같은 durable positive copy 마스킹.
  const rawText = `${input.name ?? ""}\n${input.description ?? ""}`;
  const text = sanitizeForGrading(rawText);
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];

  // A — 사용감 (priority: unworn > worn_1to2 > worn_3to5 > used > heavily_used > vintage)
  let wear: AxisLabels["wear"] = "unknown";
  const aMatchers: Array<[AxisLabels["wear"], readonly string[]]> = [
    ["unworn", A_UNWORN],
    ["worn_1to2", A_WORN_1TO2],
    ["worn_3to5", A_WORN_3TO5],
    ["used", A_USED],
    ["heavily_used", A_HEAVILY_USED],
    ["vintage", A_VINTAGE],
  ];
  for (const [label, kws] of aMatchers) {
    const m = anyMatch(text, kws);
    if (m.hit) {
      wear = label;
      positiveMatches.push(...m.matched);
      break;
    }
  }

  // B — 박스 (priority: full > box_included > box_only > no_box > box_damaged)
  let box: AxisLabels["box"] = "unknown";
  const bMatchers: Array<[AxisLabels["box"], readonly string[]]> = [
    ["full", B_FULL],
    ["box_included", B_BOX_INCLUDED],
    ["box_only", B_BOX_ONLY],
    ["box_damaged", B_BOX_DAMAGED],
    ["no_box", B_NO_BOX],
  ];
  for (const [label, kws] of bMatchers) {
    const m = anyMatch(text, kws);
    if (m.hit) {
      box = label;
      if (label === "full" || label === "box_included") positiveMatches.push(...m.matched);
      else if (label === "no_box" || label === "box_damaged") negativeMatches.push(...m.matched);
      break;
    }
  }

  // C — 정품 anchor (priority: kream > store > musinsa)
  let auth: AxisLabels["auth"] = "none";
  if (anyMatch(text, C_KREAM).hit) {
    auth = "kream";
    positiveMatches.push("kream");
  } else if (anyMatch(text, C_STORE).hit) {
    auth = "store";
    positiveMatches.push("매장");
  } else if (anyMatch(text, C_MUSINSA).hit) {
    auth = "musinsa";
    positiveMatches.push("무신사");
  }

  // D — 하자 (major > minor, negation 차단)
  let damage: AxisLabels["damage"] = "none";
  const dMajor = anyMatch(text, D_MAJOR);
  if (dMajor.hit) {
    damage = "major";
    negativeMatches.push(...dMajor.matched);
  } else {
    const dMinor = anyMatch(text, D_MINOR);
    if (dMinor.hit) {
      damage = "minor";
      negativeMatches.push(...dMinor.matched);
    }
  }

  // E — 신발 특화
  let shoe: AxisLabels["shoe"] = "none";
  if (anyMatch(text, E_EXTRA_LACES).hit) shoe = "extra_laces";
  else if (anyMatch(text, E_INSOLE_CHANGED).hit) shoe = "insole_changed";
  else if (anyMatch(text, E_WASHED).hit) shoe = "washed";

  return {
    labels: { wear, box, auth, damage, shoe },
    positiveMatches,
    negativeMatches,
  };
}
