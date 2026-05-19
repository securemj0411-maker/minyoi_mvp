// Wave 254.3 (2026-05-20): restFetchPaginated shared helper.
//
// 배경 — Wave 253/254.2 영역 1 진단:
//   PostgREST 의 server-side default row cap (≈1000건) 으로 인해
//   `?limit=${N}` 와 무관하게 GET / PATCH 결과가 1000건에서 잘림. 영향 helper 3곳
//   (silent stale 12,736건 영역 1 chain 확정):
//     - mvp/src/lib/tick-pipeline.ts:2049 loadParsedRowsByComparableKeys
//     - mvp/src/lib/rematch-helpers.ts:213 triggerRematchForSkus PATCH unbounded
//     - mvp/src/lib/rematch-helpers.ts:288 triggerRematchForListings PATCH chunk 5000
//   각 helper 마다 page-loop / chunk 분할 / Prefer header 박는 코드 흩어짐 →
//   "1타 2피" shared helper 로 묶어 silent cap miss 시스템적 차단.
//
// 사용자 명시 정책 (memory feedback_proceed_on_clear_wins / systemic priority):
//   - additive only — DB UPDATE X, fetch logic refactor 만.
//   - PATCH/GET/POST 모두 cover. 1000-row cap 자동 chunk + offset pagination.
//   - retry on transient (`restFetch` 의 기존 backoff 흐름 재사용).
//   - Wave 253 fix 통합: `Prefer: resolution=ignore-duplicates` + `on_conflict` URL param.
//
// 정책 (memory destructive_actions_require_explicit_confirm):
//   - 새 destructive UPDATE 안 함. 기존 PATCH 패턴 그대로 자동 chunk.
//   - in.(...) URL param 길이 8KB 추정 한계 위에선 caller 가 명시적으로 batchSize 조정.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

/**
 * PostgREST server-side default row cap. `db-default-row-limit` 설정값.
 *   GET 응답 row 가 이 수치를 넘으면 silent truncation — 명시적 page-loop 필요.
 *   Wave 253 fix A / Wave 254.3 의 핵심 root cause.
 */
export const POSTGREST_DEFAULT_PAGE = 1000;

/**
 * `?<col>=in.(...)` URL param 1 chunk 의 최대 element 수.
 *   PostgREST URL 길이 한계 ≈ 8 KB. comparable_key 같은 긴 string key 일 때
 *   더 작게 조정 필요. 기본은 numeric pid (≈10 byte/pid) 기준 안전 마진.
 */
export const REST_IN_CLAUSE_PID_CHUNK = 1000;

/**
 * GET-with-offset-pagination 결과 row.
 */
type Json = Record<string, unknown>;

export type PaginatedGetOptions = {
  /** 한 page 당 row (default 1000 = PostgREST 기본 cap). */
  pageSize?: number;
  /**
   * 최대 fetch row (총 cap). 없으면 무제한.
   *   safety net — 12k 같은 큰 batch 도 명시적으로 박힘. cron timeout 회피.
   */
  maxRows?: number;
  /**
   * 강제 order — `order=` URL param 미박힘 시 PostgREST page 일관성 깨질 위험.
   *   default `pid.asc` (대부분 mvp_* table 의 PK 가 pid). caller 가 다른 PK 면 명시.
   */
  orderBy?: string;
  /** 추가 헤더 (apikey/authz 외). */
  extraHeaders?: Record<string, string>;
};

/**
 * `?...&order=&limit=PAGE&offset=N` 패턴으로 모든 row 수집.
 *
 * 사용 시점:
 *   - sku_id in.() 조건 매물 pid 모두 fetch (rematch-helpers.fetchPidsBySkuIds).
 *   - parser_version in.() 조건 매물 pid 모두 fetch (rematch-helpers.triggerRematchForParserVersions).
 *   - comparable_key in.() 조건 parsed row 모두 fetch (tick-pipeline.loadParsedRowsByComparableKeys).
 *
 * 가드:
 *   - base URL 에 `limit=` 또는 `offset=` 가 이미 있으면 강제 strip — silent cap 회피.
 *   - `order=` 미박힘 시 `orderBy` 자동 박음 (default `pid.asc`).
 *   - maxRows 도달 시 즉시 break — caller 가 명시한 cap 존중.
 *
 * @param baseUrl PostgREST query URL (limit/offset 미박힘).
 * @param opts pageSize/maxRows/orderBy/extraHeaders.
 */
export async function restFetchAll<T extends Json>(
  baseUrl: string,
  opts: PaginatedGetOptions = {},
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? POSTGREST_DEFAULT_PAGE, POSTGREST_DEFAULT_PAGE));
  const maxRows = opts.maxRows ?? Number.POSITIVE_INFINITY;
  const orderBy = opts.orderBy ?? "pid.asc";

  // base URL strip — limit/offset 이미 있으면 silent cap miss 위험 → 제거.
  const stripped = stripLimitOffset(baseUrl);
  // order param 누락 시 추가. 이미 있으면 그대로.
  const ordered = stripped.includes("order=") ? stripped : appendQuery(stripped, `order=${orderBy}`);

  const headers = { ...serviceHeaders(), ...(opts.extraHeaders ?? {}) };
  const out: T[] = [];

  for (let offset = 0; out.length < maxRows; offset += pageSize) {
    const remaining = maxRows - out.length;
    const limit = Math.min(pageSize, remaining);
    const pageUrl = appendQuery(ordered, `limit=${limit}&offset=${offset}`);
    const res = await restFetch(pageUrl, { headers });
    const rows = (await res.json()) as T[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < pageSize) break;
  }

  return out.slice(0, maxRows === Number.POSITIVE_INFINITY ? out.length : maxRows);
}

export type PatchAllOptions = {
  /**
   * 단일 PATCH 의 `?pid=in.(...)` 최대 element 수.
   *   default 1000 — PostgREST URL 길이 한계 안전 마진. caller 가 더 작게
   *   설정해 cron timeout/RLS 부하 분산 가능.
   */
  chunkSize?: number;
  /**
   * PATCH body — 모든 chunk 에 동일하게 적용.
   */
  payload: Record<string, unknown>;
  /**
   * 추가 PATCH 헤더 (Prefer 포함 가능). default `serviceHeaders` + `Prefer: return=minimal`.
   */
  preferReturn?: string;
};

/**
 * pid 집합을 PATCH 로 update (자동 chunk 분할).
 *
 * 사용 시점:
 *   - triggerRematchForListings PATCH chunk (cap 1000 silent miss 위험).
 *   - score-stage `markRawScoreClean` 등 모든 pid 별 PATCH.
 *
 * 가드:
 *   - 기존 PATCH header pattern 보존 (`Prefer: return=minimal`).
 *   - chunkSize 1000 초과 거부 — URL 길이 안전 마진.
 *
 * @param table table name (e.g. "mvp_raw_listings").
 * @param pids update 대상 pid 배열.
 * @param opts payload (필수) + chunkSize/preferReturn.
 * @returns affected pid count (chunk 합).
 */
export async function patchAllByPids(
  table: string,
  pids: number[],
  opts: PatchAllOptions,
): Promise<number> {
  if (pids.length === 0) return 0;
  const chunkSize = Math.max(1, Math.min(opts.chunkSize ?? REST_IN_CLAUSE_PID_CHUNK, REST_IN_CLAUSE_PID_CHUNK));
  const preferReturn = opts.preferReturn ?? "return=minimal";
  let affected = 0;
  for (let i = 0; i < pids.length; i += chunkSize) {
    const chunk = pids.slice(i, i + chunkSize);
    const url = `${tableUrl(table)}?pid=in.(${chunk.join(",")})`;
    await restFetch(url, {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: preferReturn },
      body: JSON.stringify(opts.payload),
    });
    affected += chunk.length;
  }
  return affected;
}

export type InsertIgnoreOptions<T> = {
  /**
   * 단일 POST 의 row chunk 크기. default 500 — body 길이 / DB 부하 안전 마진.
   *   rematch-helpers DETAIL_QUEUE_INSERT_CHUNK=500 와 같은 값.
   */
  chunkSize?: number;
  /**
   * ON CONFLICT 대상 column (PostgREST `on_conflict=` URL param).
   *   필수 — 미박힘 시 unique constraint violation 23505 raise (Wave 253 fix A 발견).
   */
  onConflict: string;
  /**
   * 호출자가 row[] 의 모든 row 에 동일하게 박을 수 있는 default 값 — 없으면 caller 가
   *   직접 row[] 에 박음.
   */
  rowDefaults?: Partial<T>;
};

/**
 * Wave 253 fix 통합 — `Prefer: resolution=ignore-duplicates` + `on_conflict` URL param INSERT.
 *
 * 사용 시점:
 *   - rematch-helpers.enqueueDetailQueue (Wave 253 fix A 의 INSERT IGNORE).
 *   - 미래 wave 의 INSERT IGNORE 패턴 — 모두 본 helper 로 통일.
 *
 * 가드:
 *   - onConflict 필수 — caller 가 명시 안 하면 SOL.
 *   - Prefer header 자동 박음 — caller 가 까먹어도 안전.
 *
 * @param table table name.
 * @param rows insert 대상 row array.
 * @param opts onConflict (필수), chunkSize, rowDefaults.
 * @returns inserted row count (chunk 합 — DB 가 실제 inserted vs ignored 구분 안 함).
 */
export async function insertIgnoreRows<T extends Json>(
  table: string,
  rows: T[],
  opts: InsertIgnoreOptions<T>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const chunkSize = Math.max(1, Math.min(opts.chunkSize ?? 500, 1000));
  const onConflictParam = encodeURIComponent(opts.onConflict);
  const defaults = opts.rowDefaults ?? {};
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => ({ ...defaults, ...row }));
    await restFetch(`${tableUrl(table)}?on_conflict=${onConflictParam}`, {
      method: "POST",
      headers: { ...serviceHeaders("resolution=ignore-duplicates,return=minimal") },
      body: JSON.stringify(chunk),
    });
    inserted += chunk.length;
  }
  return inserted;
}

/**
 * URL 의 `limit=N` / `offset=N` query param 제거.
 *   restFetchAll 가 자동 박을 자리 — 미리 박혀있으면 silent cap miss.
 */
function stripLimitOffset(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("limit");
    u.searchParams.delete("offset");
    return u.toString();
  } catch {
    // URL 파싱 실패 — string-level 대체 (env 누락 등 edge case).
    return url.replace(/[?&]limit=\d+/g, "").replace(/[?&]offset=\d+/g, "");
  }
}

/**
 * URL 에 query string 추가 — 기존 `?` 유무 자동 처리.
 */
function appendQuery(url: string, qs: string): string {
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}
