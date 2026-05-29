// Wave 714 (2026-05-23): condition chip 정규화 — axis 라벨 → stable chip key.
//
// 사용자 요구 (2026-05-23):
//   "박스도 잇고 실착 적을수도잇고 다른 chip도 될수도잇고 동시에"
//   "이식성 강하게 정규화해서 보관" + "/me 페이지 상세보기에서 간단하게 실착 2~3회, 박스포함"
//
// 설계:
// - chip key = `<axis>:<value>` (예: "wear:unworn", "box:full", "auth:kream")
// - listing 당 multi-chip 동시 보유 가능 (axis 5개 × 각 1 chip = 최대 5)
// - DB 에 `condition_chips text[]` 로 정규화 저장 → 어디서든 query/filter 가능
// - UI 라벨/색상 은 별도 mapping (CHIP_LABELS) — runtime 변환
//
// Wave 948 (2026-05-30): condition deepsweep 후 damage chip 도 표시.
// → "오염/이염/얼룩" 같은 하자 근거가 tier 로만 숨어 있으면 사용자가 왜 C/D인지 모름.

import type { AxisLabels, ClothingAxisLabels } from "./types";

/** 정규화된 chip key (DB 저장값). axis prefix + value. */
export type ChipKey =
  // ── 공통 (신발/의류) ─────────────────────────────────
  | "wear:unworn"
  | "wear:worn_1to2"
  | "wear:worn_3to5"
  | "auth:kream"
  | "auth:store"
  | "auth:musinsa"
  | "damage:minor"
  | "damage:major"
  // ── 신발 only ──────────────────────────────────────
  | "box:full"
  | "box:box_included"
  | "box:box_only"
  | "extra:extra_laces"
  | "extra:insole_changed"
  | "extra:charms" // Crocs 한정 — 지비츠/스트랩
  // ── 의류 only ──────────────────────────────────────
  | "box:tag_attached"
  | "box:tag_only_cut"
  | "auth:season"
  | "damage:repair_pos"
  | "extra:collab"
  | "extra:self_grade";

/** UI 표시용 한국어 라벨 + chip 유형 (색상 분기에 사용). */
export interface ChipLabel {
  ko: string;
  /** positive=긍정 (green/blue), auth=정품 anchor (blue), special=특수 (gold/purple), negative=하자 */
  type: "positive" | "auth" | "special" | "negative";
  /** 신발/의류/공통 */
  category: "shoe" | "clothing" | "both";
}

export const CHIP_LABELS: Record<ChipKey, ChipLabel> = {
  // 공통 사용감
  "wear:unworn": { ko: "미시착", type: "positive", category: "both" },
  "wear:worn_1to2": { ko: "실착 1-2회", type: "positive", category: "both" },
  "wear:worn_3to5": { ko: "실착 2-3회", type: "positive", category: "both" },

  // 공통 정품 anchor
  "auth:kream": { ko: "KREAM 인증", type: "auth", category: "both" },
  "auth:store": { ko: "매장 구매", type: "auth", category: "both" },
  "auth:musinsa": { ko: "무신사 구매", type: "auth", category: "both" },

  // 공통 하자
  "damage:minor": { ko: "경미 하자", type: "negative", category: "both" },
  "damage:major": { ko: "심각 하자", type: "negative", category: "both" },

  // 신발 박스/구성품
  "box:full": { ko: "풀구성", type: "positive", category: "shoe" },
  "box:box_included": { ko: "박스 포함", type: "positive", category: "shoe" },
  "box:box_only": { ko: "박스만", type: "positive", category: "shoe" },

  // 신발 특화
  "extra:extra_laces": { ko: "여분끈", type: "positive", category: "shoe" },
  "extra:insole_changed": { ko: "깔창 교체", type: "positive", category: "shoe" },
  "extra:charms": { ko: "지비츠/스트랩", type: "positive", category: "shoe" }, // Crocs only

  // 의류 박스/태그
  "box:tag_attached": { ko: "택 그대로", type: "positive", category: "clothing" },
  "box:tag_only_cut": { ko: "택만 제거", type: "positive", category: "clothing" },

  // 의류 정품 anchor (시즌)
  "auth:season": { ko: "시즌 anchor", type: "auth", category: "clothing" },

  // 의류 수선 (positive D, +10% multiplier)
  "damage:repair_pos": { ko: "수선됨 +10%", type: "special", category: "clothing" },

  // 의류 특화
  "extra:collab": { ko: "콜라보", type: "special", category: "clothing" },
  "extra:self_grade": { ko: "자율등급", type: "special", category: "clothing" },
};

/**
 * 신발 axis 라벨 → chip key array.
 * 사용자 노출 chip. Wave 948부터 damage:minor/major도 포함.
 */
export function chipsFromShoeAxes(axes: AxisLabels): ChipKey[] {
  const chips: ChipKey[] = [];

  // A — wear (positive: unworn / worn_1to2 / worn_3to5)
  if (axes.wear === "unworn") chips.push("wear:unworn");
  else if (axes.wear === "worn_1to2") chips.push("wear:worn_1to2");
  else if (axes.wear === "worn_3to5") chips.push("wear:worn_3to5");

  // B — box (positive: full / box_included / box_only)
  if (axes.box === "full") chips.push("box:full");
  else if (axes.box === "box_included") chips.push("box:box_included");
  else if (axes.box === "box_only") chips.push("box:box_only");

  // C — auth (kream / store / musinsa)
  if (axes.auth === "kream") chips.push("auth:kream");
  else if (axes.auth === "store") chips.push("auth:store");
  else if (axes.auth === "musinsa") chips.push("auth:musinsa");

  // D — 하자
  if (axes.damage === "minor") chips.push("damage:minor");
  else if (axes.damage === "major") chips.push("damage:major");

  // E — 신발 특화 (extra_laces / insole_changed)
  if (axes.shoe === "extra_laces") chips.push("extra:extra_laces");
  else if (axes.shoe === "insole_changed") chips.push("extra:insole_changed");

  return chips;
}

/**
 * 의류 axis 라벨 → chip key array.
 * positive + repair_pos (의류 only positive damage).
 */
export function chipsFromClothingAxes(axes: ClothingAxisLabels): ChipKey[] {
  const chips: ChipKey[] = [];

  // A — wear (positive only)
  if (axes.wear === "unworn") chips.push("wear:unworn");
  else if (axes.wear === "worn_1to2") chips.push("wear:worn_1to2");
  else if (axes.wear === "worn_3to5") chips.push("wear:worn_3to5");

  // B — box (의류는 약하지만 매칭 시 chip)
  if (axes.box === "full") chips.push("box:full");
  else if (axes.box === "tag_attached") chips.push("box:tag_attached");
  else if (axes.box === "tag_only_cut") chips.push("box:tag_only_cut");

  // C — auth (의류는 season 포함)
  if (axes.auth === "kream") chips.push("auth:kream");
  else if (axes.auth === "store") chips.push("auth:store");
  else if (axes.auth === "musinsa") chips.push("auth:musinsa");
  else if (axes.auth === "season") chips.push("auth:season");

  // D — repair_pos (의류 only positive damage)
  if (axes.damage === "repair_pos") chips.push("damage:repair_pos");
  else if (axes.damage === "minor") chips.push("damage:minor");
  else if (axes.damage === "major") chips.push("damage:major");

  // E — 의류 특화 (collab / self_grade — x10_score 는 negative 라 skip)
  if (axes.extra === "collab") chips.push("extra:collab");
  else if (axes.extra === "self_grade") chips.push("extra:self_grade");

  return chips;
}

/**
 * Chip key → UI label (한국어 + 색상 type).
 * UI 측에서 chip 렌더링 시 호출.
 */
export function getChipLabel(key: ChipKey): ChipLabel {
  return CHIP_LABELS[key];
}
