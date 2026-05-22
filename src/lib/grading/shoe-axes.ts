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

const A_UNWORN = ["미시착", "미사용", "미착용", "데드스탁", "deadstock", "dead stock", "미개봉", "박스 미개봉", "박스미개봉"];
const A_WORN_1TO2 = ["1회 착용", "1번 신음", "1번 착용", "한번 착용", "한번만 착용", "실착 1회", "실착1회", "실내 시착", "실내시착"];
const A_WORN_3TO5 = ["2~3회 착용", "2-3회 착용", "2회 착용", "3회 착용", "잠깐 신음", "잠깐 착용", "보관만", "보관품"];
const A_USED = ["사용감 있음", "사용감있음", "5번 신음", "5회 착용", "10회 착용", "10번 신음", "상태 보통"];
const A_HEAVILY_USED = ["많이 신음", "많이신음", "오래 신음", "오래신음", "사용감 많음", "사용감많음", "사용감 큼"];
const A_VINTAGE = ["빈티지", "vintage", "오래된"];

// =============================================================================
// Axis B — 박스/구성품
// =============================================================================

const B_FULL = ["풀구성", "풀 구성", "풀박", "풀박스", "풀 박스", "완전체"];
const B_BOX_INCLUDED = ["박스 포함", "박스포함", "박스 있음", "박스있"];
const B_BOX_ONLY = ["박스만"];
const B_NO_BOX = ["박스 없음", "박스없", "박스없음"];
const B_BOX_DAMAGED = ["박스 손상", "박스 찌그", "박스찌그"];

// =============================================================================
// Axis C — 정품 anchor
// =============================================================================

const C_KREAM = ["kream", "크림", "kream 구매", "크림 구매", "kream구매", "크림구매", "kream 인증", "크림 검수"];
const C_STORE = ["매장판", "백화점", "면세점", "abcmart", "abc마트", "풋락커", "정가", "매장 구매", "매장구매"];
const C_MUSINSA = ["무신사"];

// =============================================================================
// Axis D — 하자 (negation 차단 필수)
// =============================================================================

const D_MAJOR = [
  "이염 있음",
  "이염있음",
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
];
const D_MINOR = [
  "보푸라기",
  "보풀",
  "먼지",
  "오염 있음",
  "오염있음",
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

const NEGATION_SUFFIXES = ["없음", "없습", "없네", "없어", "안함", "X", "x", "X.", "x."];

/**
 * keyword 가 text 에 있는지 — keyword 직후 negation suffix 흡수.
 *
 * 예: "이염 없음" → match("이염") = false
 *     "오염 없음" → match("오염") = false
 *     "이염 있음" → match("이염") = true
 *     "안 닳음" → match("닳음") = false (직전 "안")
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
    keywords: ["nike", "나이키", "adidas", "아디다스", "converse", "컨버스", "vans", "반스", "puma", "푸마"],
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
