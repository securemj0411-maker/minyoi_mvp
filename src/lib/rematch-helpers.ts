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

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

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

  const patchUrl = `${tableUrl("mvp_raw_listings")}?sku_id=in.(${encoded})&listing_state=eq.active&detail_status=eq.done`;
  const patchRes = await restFetch(patchUrl, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal,count=exact" },
    body: JSON.stringify(patchBody),
  });

  const affectedRaw = patchRes.headers.get("content-range")?.split("/")?.[1] ?? String(total);
  const affected = Number(affectedRaw) || total;

  console.log("[rematch:applied]", {
    type: "by_sku_id",
    skuIds,
    reason,
    affected,
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
  const patchBody: Record<string, unknown> = { score_dirty: true };
  if (resetDetailStatus) patchBody.detail_status = "pending";

  let affected = 0;
  for (let i = 0; i < pids.length; i += batchSize) {
    const chunk = pids.slice(i, i + batchSize);
    const patchUrl = `${tableUrl("mvp_raw_listings")}?pid=in.(${chunk.join(",")})`;
    await restFetch(patchUrl, {
      method: "PATCH",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(patchBody),
    });
    affected += chunk.length;
  }

  console.log("[rematch:applied]", {
    type: "by_pid",
    reason,
    affected,
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
  const allPids: number[] = [];
  const PAGE = 1000;
  for (let offset = 0; offset < total; offset += PAGE) {
    const pageRes = await restFetch(
      `${tableUrl("mvp_listing_parsed")}?select=pid&parser_version=in.(${encoded})&order=pid.asc&limit=${PAGE}&offset=${offset}`,
      { headers: serviceHeaders() },
    );
    const pageRows = (await pageRes.json()) as Array<{ pid: number }>;
    allPids.push(...pageRows.map((r) => Number(r.pid)));
    if (pageRows.length < PAGE) break;
  }
  // delegate 로 by_pid 변환 — 같은 분할 + 같은 PATCH body.
  return triggerRematchForListings(allPids, reason, opts);
}
