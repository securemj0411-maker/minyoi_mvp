// Wave 714 (2026-05-23): 의류 raw 텍스트 → 5-axis 라벨링.
//
// cross-tab agent (a2d7c17a34f40235e, n=11,543) 의 axis 정의와 1:1 일치.
// 신발과 axis 자체가 다름 (구제, 시즌, 수선 positive, 콜라보, 자율등급, X/10 점수).

import { sanitizeForGrading } from "./text-sanitize";
import type { BrandCluster, ClothingAxisLabels } from "./types";

// =============================================================================
// Axis A — 사용감 (의류 특화: 보관만 → unworn, 구제 별도)
// =============================================================================

const A_UNWORN = [
  "미사용",
  "미착용",
  "새상품",
  "새 상품",
  "신상품",
  "택그대로",
  "택 그대로",
  "보관만",
  "보관품",
  "소장만",
  "소장용",
];
const A_WORN_1TO2 = ["1회 착용", "1회 입음", "한번 입음", "한번만 입음", "한 번 입음", "실착 1회", "실착1회", "1번 입", "딱 한번"];
const A_WORN_3TO5 = ["2~3회 착용", "2-3회", "2회 착용", "3회 착용", "2~3회 입", "잠깐 입"];
const A_USED = ["사용감 있음", "사용감있음", "상태 보통"];
const A_HEAVILY_USED = ["많이 입음", "많이입음", "오래 입음", "오래입음", "사용감 많음", "사용감많음"];
const A_VINTAGE = ["빈티지", "vintage", "archive", "아카이브"];
const A_GUNJE = ["구제"];

// =============================================================================
// Axis B — 박스/태그 (의류 97.9% unknown)
// =============================================================================

const B_FULL = ["풀구성", "풀 구성", "풀박", "완전체"];
const B_TAG_ATTACHED = ["택그대로", "택 그대로", "택유", "택 유", "택부착", "택 부착", "택있"];
const B_TAG_ONLY_CUT = ["택만 띤", "택만 자름", "택만 띤거", "택컷", "택 컷"];
const B_NO_BOX_NO_TAG = ["박스 없음", "박스없", "택 없음", "택없음"];

// =============================================================================
// Axis C — 정품 anchor (season = SS/FW 연도 — 의류 최강 3.27x)
// =============================================================================

const C_KREAM = ["kream", "크림", "kream 구매", "크림 구매", "kream구매", "크림구매"];
const C_STORE = ["매장판", "백화점", "면세점", "매장 구매", "매장구매"];
const C_MUSINSA = ["무신사"];
/** 시즌 anchor — 정확한 패턴 매칭은 regex 로 별도 처리 (XXSS / XXFW / SS24 등). */
const C_SEASON_RE = /\b(\d{2}\s?(ss|fw|aw)|(ss|fw|aw)\s?\d{2})\b/i;

// =============================================================================
// Axis D — 하자 (의류 특화: repair_pos POSITIVE, 신발 반대)
// =============================================================================

const D_MAJOR = [
  "이염 있음",
  "이염있음",
  "구멍",
  "터짐",
  "터진",
  "찢어짐",
  "찢어진",
  "황변",
  "변색",
  "색바램",
  "데미지 있음",
  "데미지있음",
  "하자 있음",
  "하자있음",
];
const D_MINOR = ["보풀", "보푸라기", "먼지", "오염 있음", "오염있음", "늘어", "줄어든"];
/**
 * D4 — 수선/줄임 = **POSITIVE** signal (의류 only, 1.59x).
 * 신발은 같은 표현이 negative — clothing-only axis.
 */
const D_REPAIR_POS = ["수선", "줄임", "기장 줄임", "기장줄임", "기장 수선", "맞춤", "사이즈 수선"];

// =============================================================================
// Axis E — 의류 특화 (collab / self_grade / X점 score)
// =============================================================================

const E_COLLAB = ["콜라보", "콜라보레이션", "collab", "collaboration", "한정판", "한정 판매", "리미티드", "limited"];
const E_SELF_GRADE = ["s급", "S급", "a급", "A급", "b급", "B급", "미품"];
const E_X10_SCORE_RE = /\b(\d{1,2})\s?[\/／]\s?10\b|\b(\d{1,2})\s?점\s?(\s?\/\s?10)?\b|컨디션\s?(\d{1,2})/;

// =============================================================================
// Negation-aware matcher (shoe-axes.ts 와 동일 패턴)
// =============================================================================

const NEGATION_SUFFIXES = ["없음", "없습", "없네", "없어", "안함", "X", "x", "X.", "x."];

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
// Brand cluster mapping (의류)
// =============================================================================

const CLOTHING_CLUSTER_KEYWORDS: ReadonlyArray<{
  cluster: BrandCluster;
  keywords: readonly string[];
}> = [
  {
    cluster: "premium_archive",
    keywords: ["rrl", "stone island", "스톤아일랜드", "스톤 아일랜드", "arc'teryx", "arcteryx", "아크테릭스", "fear of god", "fog essentials", "fog "],
  },
  {
    cluster: "volume_vintage_cloth",
    keywords: ["polo", "폴로", "carhartt", "칼하트", "patagonia", "파타고니아"],
  },
  {
    cluster: "collab_heavy",
    keywords: ["stussy", "스투시", "bape", "베이프", "cdg", "꼼데가르송", "꼼데", "north face", "노스페이스", "놋페"],
  },
  {
    cluster: "casual_mass",
    keywords: ["adidas", "아디다스", "mlb", "엠엘비"],
  },
] as const;

export function detectClothingBrandCluster(name: string): BrandCluster {
  const lower = name.toLowerCase();
  for (const { cluster, keywords } of CLOTHING_CLUSTER_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cluster;
    }
  }
  return "generic";
}

// =============================================================================
// 5-axis labeling (의류)
// =============================================================================

export interface ClothingLabelInput {
  name: string;
  description: string | null | undefined;
}

export function labelClothingAxes(input: ClothingLabelInput): {
  labels: ClothingAxisLabels;
  positiveMatches: string[];
  negativeMatches: string[];
} {
  const rawText = `${input.name ?? ""}\n${input.description ?? ""}`;
  const text = sanitizeForGrading(rawText);
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];

  // A — 사용감 (priority: unworn > worn_1to2 > worn_3to5 > used > heavily_used > vintage > gunje)
  let wear: ClothingAxisLabels["wear"] = "unknown";
  const aMatchers: Array<[ClothingAxisLabels["wear"], readonly string[]]> = [
    ["gunje", A_GUNJE], // 구제 먼저 — 빈티지+구제 동시 시 구제 우선 (deep discount)
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

  // B — 박스/태그 (의류는 대부분 unknown)
  let box: ClothingAxisLabels["box"] = "unknown";
  const bMatchers: Array<[ClothingAxisLabels["box"], readonly string[]]> = [
    ["full", B_FULL],
    ["tag_attached", B_TAG_ATTACHED],
    ["tag_only_cut", B_TAG_ONLY_CUT],
    ["no_box_no_tag", B_NO_BOX_NO_TAG],
  ];
  for (const [label, kws] of bMatchers) {
    const m = anyMatch(text, kws);
    if (m.hit) {
      box = label;
      if (label === "full" || label === "tag_attached") positiveMatches.push(...m.matched);
      else negativeMatches.push(...m.matched);
      break;
    }
  }

  // C — 정품 anchor (season > kream > store > musinsa)
  let auth: ClothingAxisLabels["auth"] = "none";
  if (C_SEASON_RE.test(text)) {
    auth = "season";
    positiveMatches.push("season");
  } else if (anyMatch(text, C_KREAM).hit) {
    auth = "kream";
    positiveMatches.push("kream");
  } else if (anyMatch(text, C_STORE).hit) {
    auth = "store";
    positiveMatches.push("매장");
  } else if (anyMatch(text, C_MUSINSA).hit) {
    auth = "musinsa";
    positiveMatches.push("무신사");
  }

  // D — 하자 (major > minor > repair_pos)
  let damage: ClothingAxisLabels["damage"] = "none";
  const dMajor = anyMatch(text, D_MAJOR);
  if (dMajor.hit) {
    damage = "major";
    negativeMatches.push(...dMajor.matched);
  } else {
    const dMinor = anyMatch(text, D_MINOR);
    if (dMinor.hit) {
      damage = "minor";
      negativeMatches.push(...dMinor.matched);
    } else {
      const dRepair = anyMatch(text, D_REPAIR_POS);
      if (dRepair.hit) {
        damage = "repair_pos";
        positiveMatches.push(...dRepair.matched); // POSITIVE (의류 only)
      }
    }
  }

  // E — 의류 특화 (collab > self_grade > x10_score)
  let extra: ClothingAxisLabels["extra"] = "none";
  if (anyMatch(text, E_COLLAB).hit) {
    extra = "collab";
    positiveMatches.push("colab");
  } else if (anyMatch(text, E_SELF_GRADE).hit) {
    extra = "self_grade";
    positiveMatches.push("self_grade");
  } else if (E_X10_SCORE_RE.test(text)) {
    extra = "x10_score";
    negativeMatches.push("X/10"); // negative — 셀러 자술용
  }

  return {
    labels: { wear, box, auth, damage, extra },
    positiveMatches,
    negativeMatches,
  };
}
