// Daangn query pool — catalog SKU 기반 동적 생성.
//
// 정적 DEFAULT_DAANGN_FASHION_QUERY_SEEDS 가 6개로 너무 적음.
// 미뇨이 catalog 의 ready category SKU 들의 alias/model 명을 기반으로
// 50+ query 를 자동 생성. 새 brand 추가 시 자동 query pool 갱신.
//
// 카테고리 → 당근 categoryIds 매핑:
//   - shoe / clothing (fashion):  14 (남성패션/잡화), 5 (여성패션/잡화), 31 (스포츠/레저)
//   - smartphone / tablet / earphone / laptop / smartwatch: 1 (디지털기기)
//   - game_console:                                          7 (취미/게임/음반)
//   - sport_golf:                                            31 (스포츠/레저)
//   - bag:                                                   14, 5
//
// 출력 query 정렬:
//   1. Hot category (shoe/clothing/electronics) Pareto 우선
//   2. ready lane 가진 SKU 우선 (실제 시세 매칭 가능한 brand)
//   3. 한글 query 우선 (당근 검색 친화)

import type { Sku } from "@/lib/catalog";
import { CATALOG } from "@/lib/catalog";
import { LANE_READINESS, type CategoryReadinessMap, type LaneReadinessMap } from "@/lib/category-readiness";
import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import type { DaangnQuerySeed } from "@/lib/daangn";

// 미뇨이 SKU.category → 당근 category dbId.
const FASHION_CATEGORY_IDS = [14, 5, 31];
const ELECTRONICS_CATEGORY_IDS = [1];
const SPORT_CATEGORY_IDS = [31];
const GAME_CATEGORY_IDS = [7];

function daangnCategoryIdsFor(category: Sku["category"]): number[] {
  switch (category) {
    case "shoe":
    case "clothing":
    case "bag":
      return FASHION_CATEGORY_IDS;
    case "smartphone":
    case "tablet":
    case "earphone":
    case "smartwatch":
    case "laptop":
    case "desktop":
    case "monitor":
    case "speaker":
    case "camera":
      return ELECTRONICS_CATEGORY_IDS;
    case "game_console":
    case "lego":
      return GAME_CATEGORY_IDS;
    case "sport_golf":
    case "bike":
    case "drone":
    case "kickboard":
      return SPORT_CATEGORY_IDS;
    case "watch":
    case "perfume":
    case "home_appliance":
    case "small_appliance":
      return FASHION_CATEGORY_IDS;
    default:
      return FASHION_CATEGORY_IDS;
  }
}

// query 길이 + 한글 우선 score (joongna 패턴 따라옴)
function preferKorean(a: string): boolean {
  return /[가-힣]/.test(a);
}

function preferredQueryFromSku(sku: Sku): string | null {
  const list: string[] = [];
  if (Array.isArray(sku.aliases)) list.push(...sku.aliases);
  list.push(sku.modelName);
  list.push(`${sku.brand} ${sku.modelName}`);

  const cleaned = list
    .map((q) => q.trim())
    .filter((q) => q.length >= 3 && q.length <= 30);
  if (cleaned.length === 0) return null;

  // 한글 query 우선
  const korean = cleaned.find(preferKorean);
  if (korean) return korean;
  return cleaned[0] ?? null;
}

// Category 별 Pareto 가중치 (운영 관점 우선순위)
const CATEGORY_PRIORITY: Partial<Record<Sku["category"], number>> = {
  shoe: 100,
  clothing: 95,
  bag: 70,
  earphone: 65,
  smartphone: 60,
  tablet: 55,
  smartwatch: 50,
  laptop: 45,
  game_console: 40,
  sport_golf: 35,
  watch: 30,
  desktop: 25,
  monitor: 20,
  speaker: 18,
  camera: 16,
  drone: 14,
  bike: 12,
  perfume: 10,
  home_appliance: 8,
  kickboard: 6,
  lego: 5,
};

export type BuildDaangnQueryPoolOptions = {
  categoryReadiness?: CategoryReadinessMap;
  laneReadiness?: LaneReadinessMap;
  maxQueries?: number;  // 최대 query 수 (default 50)
  includeBroad?: boolean;  // *-broad SKU 포함 (default true)
};

export function buildDaangnQueryPool(options: BuildDaangnQueryPoolOptions = {}): DaangnQuerySeed[] {
  const maxQueries = options.maxQueries ?? 50;
  const includeBroad = options.includeBroad ?? true;
  const laneMap = options.laneReadiness ?? LANE_READINESS;

  type Candidate = {
    sku: Sku;
    query: string;
    score: number;
  };
  const seenQueries = new Set<string>();
  const candidates: Candidate[] = [];

  for (const sku of CATALOG) {
    if (!includeBroad && sku.id.endsWith("-broad")) continue;
    // ready lane 또는 ready category 만 통과
    const gate = evaluatePoolGate(
      { sku, category: sku.category },
      { categoryReadiness: options.categoryReadiness, laneReadiness: laneMap },
    );
    if (!gate.canEnterPool) continue;

    const q = preferredQueryFromSku(sku);
    if (!q) continue;
    const key = q.toLowerCase();
    if (seenQueries.has(key)) continue;
    seenQueries.add(key);

    const priority = CATEGORY_PRIORITY[sku.category] ?? 0;
    candidates.push({
      sku,
      query: q,
      score: priority + (preferKorean(q) ? 5 : 0) + (q.length <= 10 ? 3 : 0),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates.slice(0, maxQueries);

  return selected.map((c) => ({
    label: c.sku.category,
    search: c.query,
    categoryIds: daangnCategoryIdsFor(c.sku.category),
  }));
}
