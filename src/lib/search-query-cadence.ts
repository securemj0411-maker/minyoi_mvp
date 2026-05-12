// P2-1: query별 yield-based cadence 결정 로직 (simulator/runtime 공유).
// simulator(scripts/report-query-cadence-simulator.mjs)와 runtime housekeeper의
// evaluateSearchQueryCadences가 같은 로직을 쓰도록 단일 소스.

export type CategoryReadinessStatus = "ready" | "internal_only" | "blocked";

export type QueryYieldRow = {
  query: string;
  family: string;
  observed: number;
  changed: number;
  active: number;
  normalType: number;
  detailsPending: number;
  detailsDone: number;
  poolAny: number;
  poolReady: number;
  poolReserved: number;
  poolSpent: number;
};

export type CadenceDecision = {
  cadenceMinutes: number;
  cadence: "5m" | "10m" | "30m" | "60m";
  reason: string;
  mode: "harvest" | "gather";
  keepFresh: boolean;
};

export function queryFamily(query: string): string {
  const q = String(query ?? "").toLowerCase();
  if (q.includes("에어팟")) return "earphone";
  if (q.includes("워치")) return "smartwatch";
  if (q.includes("아이폰") || q.includes("갤럭시 s")) return "smartphone";
  if (q.includes("아이패드") || q.includes("갤럭시탭")) return "tablet";
  if (q.includes("맥북")) return "laptop";
  return "unknown";
}

export function cadenceMinutesFromLabel(label: CadenceDecision["cadence"]): number {
  if (label === "5m") return 5;
  if (label === "10m") return 10;
  if (label === "30m") return 30;
  return 60;
}

export function costMultiplier(cadence: CadenceDecision["cadence"]): number {
  if (cadence === "5m") return 1;
  if (cadence === "10m") return 0.5;
  if (cadence === "30m") return 1 / 6;
  if (cadence === "60m") return 1 / 12;
  return 1;
}

/**
 * Query별 yield로 cadence를 결정한다.
 * - readiness !== 'ready' 또는 unknown family → mode='gather' + cadence='5m' 강제(downrank 면제).
 *   표본 부족 카테고리가 영영 못 자라는 악순환 방지.
 * - readiness='ready' 카테고리만 yield 기반 downrank(=harvest) 적용.
 * - 같은 query가 ready 기여 시작하면 자동 재평가에서 5m으로 승격됨.
 */
export function decideCadence(
  row: QueryYieldRow,
  readiness: { status: CategoryReadinessStatus } | null,
): CadenceDecision {
  const readyRate = row.observed ? row.poolReady / row.observed : 0;
  const poolRate = row.observed ? row.poolAny / row.observed : 0;
  const changeRate = row.observed ? row.changed / row.observed : 0;
  const family = row.family;
  const isHarvestable = readiness?.status === "ready";

  if (row.poolReady >= 2 || readyRate >= 0.0015) {
    return {
      cadenceMinutes: 5,
      cadence: "5m",
      reason: "ready_pool_yield",
      mode: "harvest",
      keepFresh: true,
    };
  }
  if ((family === "earphone" || family === "smartwatch") && row.poolAny > 0) {
    return {
      cadenceMinutes: 10,
      cadence: "10m",
      reason: "ready_family_pool_presence",
      mode: "harvest",
      keepFresh: true,
    };
  }

  if (!isHarvestable) {
    const status = readiness?.status ?? "unknown";
    return {
      cadenceMinutes: 5,
      cadence: "5m",
      reason: `gather_readiness=${status}`,
      mode: "gather",
      keepFresh: true,
    };
  }

  if (row.poolAny > 0 || poolRate >= 0.001 || changeRate >= 0.02) {
    return {
      cadenceMinutes: 30,
      cadence: "30m",
      reason: row.poolAny > 0 ? "some_pool_or_candidate_signal" : "high_change_rate",
      mode: "harvest",
      keepFresh: false,
    };
  }

  return {
    cadenceMinutes: 60,
    cadence: "60m",
    reason: "low_yield_broad_or_internal",
    mode: "harvest",
    keepFresh: false,
  };
}
