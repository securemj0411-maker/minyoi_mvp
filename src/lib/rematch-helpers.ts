// Wave 252.C (2026-05-20): rematch trigger helper 자동화.
//
// 배경 — 사용자 정책 (memory feedback_log_findings_even_before_fix):
//   Wave 248/251 같은 catalog 변경 후 영향 매물 자동 invalidate 안 됨 →
//   매번 SQL UPDATE 수동 (Wave 251.3 의 29건). 이 helper 가 catalog/policy 변경
//   직후 영향 SKU/매물 자동 reset (additive — `detail_status='pending'` set
//   + `score_dirty=true` set). 다음 cron tick 에 자동 reparse.
//
// 정책 — Wave 251.3 의 standard rematch trigger pattern:
//   - additive only — `detail_status` / `score_dirty` 두 column 만 reset.
//     raw_json / name / price / sku_id 등 보존.
//   - dry-run mode — 사용자 신뢰 확보. 영향 매물 수 미리 확인 후 실제 apply.
//   - audit log — 변경 사유 + 영향 매물 수 + 호출자 (caller wave) 콘솔 기록.
//
// 사용 예시 (catalog.ts 변경 후 다음 wave 부터):
//   import { triggerRematchForSkus } from "@/lib/rematch-helpers";
//   const r = await triggerRematchForSkus(
//     ["clothing-polo-pique-classic"],
//     "wave252-rematch-natgeo",
//     { dryRun: false },
//   );
//   console.log(`[rematch] ${r.count} listings affected`);
//
// 사용자 정책 준수 (memory destructive_actions_require_explicit_confirm):
//   본 helper 의 default 는 dry-run=true. 실제 UPDATE 는 caller 가
//   명시적으로 dryRun=false 선언해야 한다. wrapper script / API 가 사용자
//   confirm prompt 박은 다음 dryRun=false 호출 권고.
//
// Wave 253 fix A (2026-05-20) — bug fix:
//   Wave 252.C 1차 helper 는 `mvp_raw_listings.detail_status='pending'` +
//   `score_dirty=true` 만 PATCH, **`mvp_detail_queue` INSERT 안 함**.
//   detail-worker 는 `claim_mvp_detail_queue` RPC 로만 작업 수신 — queue
//   비어있으면 영영 reparse 안 됨 (Wave 253 진단 14,177 stuck 발견).
//   → 모든 3 helper 의 PATCH 이후 `mvp_detail_queue` INSERT IGNORE 추가.
//   additive (INSERT IGNORE 로 기존 queue row 보존). search-stage
//   `insert_detail_queue` (`tick-pipeline.ts:1502`) 와 같은 pattern.
//
// Wave 254.3 (2026-05-20) — restFetchPaginated shared helper 사용으로 refactor:
//   - fetchPidsBySkuIds → restFetchAll (cap 1000 silent miss fix).
//   - enqueueDetailQueue → insertIgnoreRows (Prefer + on_conflict 통합).
//   - triggerRematchForListings PATCH chunk → patchAllByPids (URL 길이 안전).
//   기존 동작 (additive PATCH + INSERT IGNORE) 보존, fetch logic 만 shared.

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { insertIgnoreRows, patchAllByPids, restFetchAll } from "@/lib/rest-paginated";

export type RematchOptions = {
  /**
   * dry-run mode. true 면 영향 매물 count + sample pids 만 보고, 실제
   * UPDATE 안 함. 사용자 confirm 받기 위함 (default true).
   */
  dryRun?: boolean;
  /**
   * 단일 batch UPDATE 최대 매물 수. default 5000.
   *   더 많으면 분할 (cron rate-limit 회피 — 다음 tick 에 다시 처리됨).
   *   `?pid=in.(...)` PostgREST limit 회피 위해 in-clause 분할.
   */
  batchSize?: number;
  /**
   * detail_status 도 reset (Wave 251.3 패턴). detail-worker 재상세수집 →
   * parser 재실행 → score 재계산. catalog 변경 후엔 detail re-fetch 필요 없을 수도
   * (text-based mustNotContain hit) 있지만 안전 default true.
   */
  resetDetailStatus?: boolean;
};

export type RematchResult = {
  /** dry-run 또는 실제 apply 후 영향 매물 수 */
  count: number;
  /** sample pids (첫 10개) — 사용자 confirm 시 검증용 */
  samplePids: number[];
  /** 호출 시점 (ISO) */
  triggeredAt: string;
  /** dryRun mode */
  dryRun: boolean;
  /** reason (caller wave) — audit log */
  reason: string;
};

const DEFAULT_BATCH = 5000;
const SAMPLE_PID_COUNT = 10;

// Wave 253 fix A — detail_queue INSERT IGNORE.
// search-stage `insert_detail_queue` (`tick-pipeline.ts:1502`) 와 같은 row shape.
// priority 50 = rematch (search-stage 의 numFaved 기반 default 보다 낮춤 — 신규 매물 우선).
const DETAIL_QUEUE_REMATCH_PRIORITY = 50;
// PostgREST INSERT chunk — `REST_WRITE_CHUNK_SIZE` 와 같은 의도. local hardcode.
const DETAIL_QUEUE_INSERT_CHUNK = 500;

/**
 * pid 집합을 `mvp_detail_queue` 에 INSERT IGNORE.
 *
 * Wave 253 fix A (2026-05-20) — bug fix.
 *   detail-worker 는 `claim_mvp_detail_queue` RPC 로만 작업 수신. helper 가
 *   `detail_status='pending'` PATCH 만 박으면 영영 reparse 안 됨.
 *   PATCH 직후 본 함수 호출 → 다음 cron tick 에 detail-worker pickup.
 *
 * 정책 — additive only:
 *   - `Prefer: resolution=ignore-duplicates` — 이미 queue 에 있으면 skip.
 *   - locked/locked_until 등 destructive overwrite X. ON CONFLICT UPDATE X.
 *   - search-stage (`tick-pipeline.ts:1502`) 의 row shape 동일.
 *
 * @param pids enqueue 대상 pid 배열.
 * @param triggeredAt ISO timestamp (caller 의 `triggeredAt` 재사용).
 */
async function enqueueDetailQueue(pids: number[], triggeredAt: string): Promise<number> {
  if (pids.length === 0) return 0;
  // Wave 254.3 (2026-05-20): insertIgnoreRows shared helper 사용.
  //   기존 동작 동일 (Prefer: resolution=ignore-duplicates + on_conflict=pid + chunk 500).
  //   row defaults 박힘 — caller 가 pid 만 박으면 status/priority 등 자동.
  const rows = pids.map((pid) => ({ pid: Number(pid) }));
  return insertIgnoreRows("mvp_detail_queue", rows, {
    onConflict: "pid",
    chunkSize: DETAIL_QUEUE_INSERT_CHUNK,
    rowDefaults: {
      status: "pending",
      priority: DETAIL_QUEUE_REMATCH_PRIORITY,
      available_at: triggeredAt,
      locked_at: null,
      locked_until: null,
      last_error: null,
      updated_at: triggeredAt,
    },
  });
}

/**
 * sku_id in.() 매칭 매물의 pid list 를 페이지네이션으로 모두 수집.
 *
 * Wave 253 fix A — `triggerRematchForSkus` 가 PATCH 직후 detail_queue 에 INSERT
 * 하기 위해 pid 가 필요. PostgREST default 1k row cap 회피 (Wave 252.B step 1 의
 * 같은 bug fix pattern).
 */
async function fetchPidsBySkuIds(encodedSkuIds: string, total: number): Promise<number[]> {
  if (total === 0) return [];
  // Wave 254.3 (2026-05-20): restFetchAll shared helper 사용.
  //   기존 동작 동일 (offset pagination + order=pid.asc + page 1000).
  //   maxRows = total — caller 가 명시한 cap 존중 (count=exact header 결과).
  const baseUrl = `${tableUrl("mvp_raw_listings")}?select=pid&sku_id=in.(${encodedSkuIds})&listing_state=eq.active&detail_status=eq.done`;
  const rows = await restFetchAll<{ pid: number }>(baseUrl, {
    maxRows: total,
    orderBy: "pid.asc",
  });
  return rows.map((r) => Number(r.pid));
}

/**
 * 특정 sku_id 집합 매물 모두 reparse trigger.
 *
 * 사용 시점:
 *   - catalog.ts 새 mustNotContain 추가 (예: NatGeo 차단) — 영향 SKU 의 매물 reset.
 *   - 새 narrow SKU split (예: Wave 245 RRL/FOG narrow) — broad SKU 매물 자동 reroute.
 *   - parser_version bump (Wave 252.B 의 v3→v7 강제 rematch) — 본 helper 의 대안.
 *
 * @param skuIds reparse 대상 sku_id 배열.
 * @param reason 호출 wave / catalog 변경 사유 (audit log).
 * @param opts dryRun (default true), batchSize, resetDetailStatus.
 */
export async function triggerRematchForSkus(
  skuIds: string[],
  reason: string,
  opts: RematchOptions = {},
): Promise<RematchResult> {
  const dryRun = opts.dryRun ?? true;
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  const resetDetailStatus = opts.resetDetailStatus ?? true;
  const triggeredAt = new Date().toISOString();

  if (skuIds.length === 0) {
    console.warn("[rematch] empty skuIds — no-op", { reason });
    return { count: 0, samplePids: [], triggeredAt, dryRun, reason };
  }

  const encoded = skuIds.map((s) => `"${s}"`).join(",");
  // step 1: count + sample pids (HEAD-style count + select sample).
  const countUrl = `${tableUrl("mvp_raw_listings")}?select=pid&sku_id=in.(${encoded})&listing_state=eq.active&detail_status=eq.done&limit=${SAMPLE_PID_COUNT}`;
  const countRes = await restFetch(countUrl, {
    headers: { ...serviceHeaders(), Prefer: "count=exact" },
  });
  const totalRaw = countRes.headers.get("content-range")?.split("/")?.[1] ?? "0";
  const total = Number(totalRaw) || 0;
  const samplePids = ((await countRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));

  console.log("[rematch:trigger]", {
    type: "by_sku_id",
    skuIds,
    reason,
    count: total,
    samplePids,
    dryRun,
    triggeredAt,
  });

  if (dryRun || total === 0) {
    return { count: total, samplePids, triggeredAt, dryRun, reason };
  }

  // step 2: 실제 UPDATE (additive — detail_status + score_dirty 만).
  //   PostgREST UPDATE 는 in.(...) 그대로 처리. batchSize 초과 시 분할 트리거 안 함
  //   (caller 가 sku_id 를 좁히거나 dryRun → batchSize 조정 권고).
  const patchBody: Record<string, unknown> = { score_dirty: true };
  if (resetDetailStatus) patchBody.detail_status = "pending";

  // Wave 253 fix A — PATCH 전에 pid list 수집 (detail-queue INSERT 용).
  //   PATCH 후엔 detail_status='done' 필터 매칭 안 됨. pid list 사전 fetch 필수.
  const affectedPids = resetDetailStatus ? await fetchPidsBySkuIds(encoded, total) : [];

  const patchUrl = `${tableUrl("mvp_raw_listings")}?sku_id=in.(${encoded})&listing_state=eq.active&detail_status=eq.done`;
  const patchRes = await restFetch(patchUrl, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal,count=exact" },
    body: JSON.stringify(patchBody),
  });

  const affectedRaw = patchRes.headers.get("content-range")?.split("/")?.[1] ?? String(total);
  const affected = Number(affectedRaw) || total;

  // Wave 253 fix A — PATCH 직후 detail_queue INSERT IGNORE.
  //   resetDetailStatus=false 면 enqueue 안 함 (score-only rematch — Wave 251.3 외 use case).
  const enqueued = resetDetailStatus ? await enqueueDetailQueue(affectedPids, triggeredAt) : 0;

  console.log("[rematch:applied]", {
    type: "by_sku_id",
    skuIds,
    reason,
    affected,
    detailQueueEnqueued: enqueued,
    triggeredAt,
  });

  return { count: affected, samplePids, triggeredAt, dryRun: false, reason };
}

/**
 * 특정 pid 집합 매물 모두 reparse trigger.
 *
 * 사용 시점:
 *   - SQL audit 결과 발견된 specific pid 집합 (Wave 251.3 의 29건 같은).
 *   - shadow audit alert 매물 list.
 *
 * @param pids reparse 대상 pid 배열.
 * @param reason 호출 wave / 발견 사유 (audit log).
 * @param opts dryRun (default true), batchSize.
 */
export async function triggerRematchForListings(
  pids: number[],
  reason: string,
  opts: RematchOptions = {},
): Promise<RematchResult> {
  const dryRun = opts.dryRun ?? true;
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  const resetDetailStatus = opts.resetDetailStatus ?? true;
  const triggeredAt = new Date().toISOString();

  if (pids.length === 0) {
    console.warn("[rematch] empty pids — no-op", { reason });
    return { count: 0, samplePids: [], triggeredAt, dryRun, reason };
  }

  const total = pids.length;
  const samplePids = pids.slice(0, SAMPLE_PID_COUNT);

  console.log("[rematch:trigger]", {
    type: "by_pid",
    reason,
    count: total,
    samplePids,
    dryRun,
    triggeredAt,
  });

  if (dryRun) {
    return { count: total, samplePids, triggeredAt, dryRun: true, reason };
  }

  // batchSize 단위로 분할 PATCH — PostgREST in.() URL 길이 제한 회피.
  // Wave 254.3 (2026-05-20): patchAllByPids shared helper 사용.
  //   기존 default batchSize=5000 은 URL 길이 한계 부근 (silent cap 위험).
  //   patchAllByPids 의 default cap = 1000 (REST_IN_CLAUSE_PID_CHUNK).
  //   caller 의 batchSize 가 1000 초과면 helper 가 1000 으로 clamp.
  const patchBody: Record<string, unknown> = { score_dirty: true };
  if (resetDetailStatus) patchBody.detail_status = "pending";
  const affected = await patchAllByPids("mvp_raw_listings", pids, {
    payload: patchBody,
    chunkSize: batchSize,
  });

  // Wave 253 fix A — PATCH 직후 detail_queue INSERT IGNORE.
  //   resetDetailStatus=false 면 enqueue 안 함. INSERT IGNORE 라 기존 queue row 보존.
  const enqueued = resetDetailStatus ? await enqueueDetailQueue(pids, triggeredAt) : 0;

  console.log("[rematch:applied]", {
    type: "by_pid",
    reason,
    affected,
    detailQueueEnqueued: enqueued,
    triggeredAt,
  });

  return { count: affected, samplePids, triggeredAt, dryRun: false, reason };
}

/**
 * 특정 parser_version 매물 모두 reparse trigger (Wave 252.B 의 v3 12k 강제 rematch 의 helper).
 *
 * 사용 시점:
 *   - parser_version bump 후 옛 매물 강제 reparse.
 *   - 사용자 결정 필요 (12k 건 cron 부하 대) — 본 helper 의 default dryRun=true 가 측정만.
 *
 * @param parserVersions reparse 대상 parser_version 배열 (예: ['wave216-clothing-v3', 'wave92-fashion-mobility-v3']).
 * @param reason 호출 wave (audit log).
 * @param opts dryRun (default true).
 */
export async function triggerRematchForParserVersions(
  parserVersions: string[],
  reason: string,
  opts: RematchOptions = {},
): Promise<RematchResult> {
  const dryRun = opts.dryRun ?? true;
  const triggeredAt = new Date().toISOString();

  if (parserVersions.length === 0) {
    console.warn("[rematch] empty parserVersions — no-op", { reason });
    return { count: 0, samplePids: [], triggeredAt, dryRun, reason };
  }

  const encoded = parserVersions.map((v) => `"${v}"`).join(",");
  // mvp_listing_parsed 에서 영향 pid count + sample fetch.
  const countUrl = `${tableUrl("mvp_listing_parsed")}?select=pid&parser_version=in.(${encoded})&limit=${SAMPLE_PID_COUNT}`;
  const countRes = await restFetch(countUrl, {
    headers: { ...serviceHeaders(), Prefer: "count=exact" },
  });
  const totalRaw = countRes.headers.get("content-range")?.split("/")?.[1] ?? "0";
  const total = Number(totalRaw) || 0;
  const samplePids = ((await countRes.json()) as Array<{ pid: number }>).map((r) => Number(r.pid));

  console.log("[rematch:trigger]", {
    type: "by_parser_version",
    parserVersions,
    reason,
    count: total,
    samplePids,
    dryRun,
    triggeredAt,
  });

  if (dryRun || total === 0) {
    return { count: total, samplePids, triggeredAt, dryRun, reason };
  }

  // 실제 12k 같은 큰 batch 는 사용자 결정 필요 — 본 함수가 한 번에 12k 처리.
  // 분할 cron 부하 분산은 caller 가 chunk 분할 호출 책임 (e.g. 1k/h × 12).
  //
  // Postgres-side UPDATE via RPC 권장이지만 단순화 위해 PATCH (mvp_raw_listings).
  // pid 매칭은 sub-select 안 됨 → 2 step: select pids → patch in batches.
  //
  // Wave 252.B step 1 (2026-05-20) bug fix: PostgREST server-side default
  // limit ≈ 1000 row 로 인해 `?limit=${total}` 가 무시되어 1000개만 반환.
  // → Range header (offset 페이지네이션) 으로 모든 pid 수집.
  //
  // Wave 254.3 (2026-05-20): restFetchAll shared helper 사용 — 위 fetchPidsBySkuIds 와 같은 패턴.
  const rows = await restFetchAll<{ pid: number }>(
    `${tableUrl("mvp_listing_parsed")}?select=pid&parser_version=in.(${encoded})`,
    { maxRows: total, orderBy: "pid.asc" },
  );
  const allPids = rows.map((r) => Number(r.pid));
  // delegate 로 by_pid 변환 — 같은 분할 + 같은 PATCH body.
  return triggerRematchForListings(allPids, reason, opts);
}

// Wave 254.3 (2026-05-20): parser_version mismatch retry helper.
//
// 배경 — Wave 252.B silent miss 측정 결과 (2026-05-20):
//   v3 listings 2,183 / v7 listings 2,107 / v4 listings 124. v3 의 2,183 매물 모두
//   score_dirty=true 박혀있으나 parser_version 은 여전히 v3. 즉 Wave 252.B step 1
//   trigger 후 detail-worker 재실행은 됐지만 parser 가 새 버전으로 update 안 됨
//   (이유 — 별도 wave 에서 추적 필요. 우선 retry 로직으로 stuck listing 자동 해소).
//
// 본 helper 의 책임:
//   stale parser_version 매물 (예: v3) 가 score_dirty 인 상태로 stuck → 다시
//   detail_queue 에 INSERT IGNORE + score_dirty=true PATCH. 다음 detail-worker
//   tick 에 pickup. max retry 3 + exponential backoff (1s/2s/4s) — caller 가
//   재진입 시 무한 loop 방지.
//
// 가드:
//   - additive — score_dirty / detail_status / detail_queue 만 reset.
//   - max retry 3 — caller 가 명시한 cap. 초과 시 retry 안 함 + warning log.
//   - dryRun mode — 사용자 신뢰 확보. default true.
//
// 사용 예시:
//   import { retryStaleParserVersions } from "@/lib/rematch-helpers";
//   const r = await retryStaleParserVersions(
//     ["wave216-clothing-v3"],
//     "wave254-3-silent-miss-retry",
//     { dryRun: false, maxRetries: 3 },
//   );
export type RetryStaleOptions = RematchOptions & {
  /** 최대 재시도 횟수 (default 3). 초과 시 warning log + retry skip. */
  maxRetries?: number;
  /** retry attempt 번호 — caller 가 외부에서 추적. default 1. */
  attempt?: number;
  /**
   * backoff base ms — exponential (`base * 2^(attempt-1)`). default 1000.
   *   attempt 1 → 0ms, 2 → 1s, 3 → 2s. 호출자가 sleep 책임 안 짊 — 정보만 log.
   */
  backoffBaseMs?: number;
};

/**
 * stale parser_version 매물 자동 재시도.
 *
 * 사용 시점:
 *   - Wave 252.B silent miss (v3 stuck) — 본 helper 가 자동 해소.
 *   - 미래 parser_version bump 후 자동 retry — caller 가 attempt 추적.
 *
 * @param parserVersions stale parser_version 배열 (예: ['wave216-clothing-v3']).
 * @param reason 호출 wave (audit log).
 * @param opts dryRun (default true), maxRetries (default 3), attempt (default 1).
 */
export async function retryStaleParserVersions(
  parserVersions: string[],
  reason: string,
  opts: RetryStaleOptions = {},
): Promise<RematchResult> {
  const maxRetries = opts.maxRetries ?? 3;
  const attempt = opts.attempt ?? 1;
  const backoffBaseMs = opts.backoffBaseMs ?? 1000;

  if (attempt > maxRetries) {
    console.warn("[rematch:retry-skip]", {
      reason,
      parserVersions,
      attempt,
      maxRetries,
      message: "max retries exceeded — skip",
    });
    return {
      count: 0,
      samplePids: [],
      triggeredAt: new Date().toISOString(),
      dryRun: opts.dryRun ?? true,
      reason,
    };
  }

  const backoffMs = backoffBaseMs * Math.pow(2, attempt - 1);
  console.log("[rematch:retry]", {
    reason,
    parserVersions,
    attempt,
    maxRetries,
    backoffMsHint: backoffMs,
    note: "caller 가 retry 간 sleep 책임 — 본 helper 는 정보만 log",
  });

  // delegate — 본 helper 는 attempt counter / backoff hint 만 추가.
  return triggerRematchForParserVersions(parserVersions, `${reason}#attempt=${attempt}`, opts);
}
