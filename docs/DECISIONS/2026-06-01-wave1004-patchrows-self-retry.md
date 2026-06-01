# Wave 1004 — patchRows 자체에 single-call retry (Wave 1002 보강)

- 시간: 2026-06-01 18:50 KST
- 트리거: Wave 1002 deploy 후 측정. score_c 4건 PATCH 500 fail 잔존 (12:35~12:51 UTC).

## 발견

Wave 1002 patchRowsByIds chunk-level retry 박은 후에도 score_c PATCH 500 fail 4건 지속:

| 시각 (UTC) | worker | err |
|---|---|---|
| 12:51:38 | score_c | Supabase REST failed 500 PATCH /rest/v1/mvp_raw_listings?pid=in.(...) |
| 12:47:38 | score_c | 동일 |
| 12:43:38 | score_c | 동일 |
| 12:35:45 | score_c | 동일 |

분석:
- restFetch (supabase-rest.ts:109-147) 자체에 retry 3번 박혀있음
- `isTransientRestFailure` (line 74-81) 가 status 500 + PG 패턴 (deadlock/serialization/lock/57014) 있을 때만 transient 분류 → retry
- **PostgREST 자체 500 (supabase 일시 부하 / connection pool exhaustion 등) → PG 패턴 없음 → 즉시 throw**
- patchRowsByIds chunk-level catch 가 2회 시도하지만 둘 다 즉시 throw 받아 silent skip 발동 → worker succeed 해야 함

코드 review 결과 Wave 1002 patchRowsByIds 로직 자체는 정상. 그러나 worker fail 마킹됨 (`pid=in.(...)` 형식이라 patchRowsByIds 경유한 PATCH 확실).

가설:
1. Wave 1002 deploy 자체는 됐으나 패치된 `patchRowsByIds` 외에 **다른 path 에서 `patchRows` 직접 호출 + transient 500 → catch 없음 → throw**
   - `patchRows("mvp_raw_listings", \`pid=eq.${pid}\`, ...)` 단일 PATCH (line 1861/1938/5771/5859/6212/6240) — single-pid 라 error message 형식 다르긴 함
   - 그러나 layered protection 으로 patchRows level 에서 retry 박으면 모든 caller cover
2. Vercel deploy timing — 일부 인스턴스 cold start 잔존 가능 (검증 어려움)

## Fix

`src/lib/tick-pipeline.ts:553` `patchRows` 자체에 single-call retry 추가:

```diff
 async function patchRows(table: string, filter: string, payload: Record<string, unknown>): Promise<void> {
-  await restFetch(`${tableUrl(table)}?${filter}`, {
-    method: "PATCH",
-    headers: serviceHeaders("return=minimal"),
-    body: jsonBody(payload),
-  });
+  const url = `${tableUrl(table)}?${filter}`;
+  const init: RequestInit = {
+    method: "PATCH",
+    headers: serviceHeaders("return=minimal"),
+    body: jsonBody(payload),
+  };
+  try {
+    await restFetch(url, init);
+  } catch (firstErr) {
+    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
+    // 500/502/503/504/network/timeout 만 retry. 4xx 는 즉시 throw.
+    const retriable = /Supabase REST (failed (500|502|503|504)|timed out|fetch failed)/.test(msg);
+    if (!retriable) throw firstErr;
+    await new Promise((resolve) => setTimeout(resolve, 500 + Math.floor(Math.random() * 200)));
+    await restFetch(url, init);
+  }
 }
```

### 효과

- 모든 `patchRows` caller (single + chunk) cover
- 4xx (schema/auth 오류) 는 즉시 throw — 의도된 fail
- transient 500/timeout 1회 자동 retry — 정상 PATCH 영향 0
- patchRowsByIds chunk-level catch 와 layered: patchRows 안 retry 1회 → 그래도 fail 시 patchRowsByIds catch → 500ms wait → patchRows 또 호출 (안에서 또 retry 1회) → silent skip
- 총 transient 500 시 최대 4번 시도 (chunk fail → chunk retry → 각 안에서 1회 retry). PostgreSQL 부하 약간 ↑ but acceptable.

## 검증

- `npx tsc --noEmit`: 새 에러 0
- 다음 cron tick 부터 적용

## 위험

- 멱등하지 않은 PATCH payload 있으면 retry 시 부작용. `mvp_raw_listings`/`mvp_lifecycle_checks` 등 score_dirty/detail_enriched_at/timestamp 류 — 다 멱등. 안전.
- transient 500 빈번 시 PostgreSQL 부하 ↑. 단 PostgREST 500 자체가 transient 부하 표현 — retry 늘려도 부하 자체는 비슷.

## 다음

- git push → vercel auto-deploy
- 1~2h 후 score_c PATCH 500 fail rate 측정 (목표 0)
- 잔존 시 wave 1002 deploy 검증 (코드 진짜 적용됐는지)

## 보류 (별 wave)

### lifecycle_a claim_mvp_lifecycle_checks REST timeout (wave 1005 후보)
- `Supabase REST timed out POST /rest/v1/rpc/claim_mvp_lifecycle_checks` 잔존
- Wave 988 RPC statement_timeout 60s 박았으나 SUPABASE_REST_TIMEOUT_MS=30s default → client 30s 에 끊음
- mvp_lifecycle_checks claimable 114k backlog + lifecycle_a sourceFilter 없음 → RPC 무거움
- 옵션:
  1. SUPABASE_REST_TIMEOUT_MS 60s 로 늘림 (모든 restFetch 영향, route maxDuration 도 60s 이상 박아야)
  2. lifecycle-worker route 만 별도 timeout 박음 (signal override)
  3. RPC 자체 lighter (claim 수 줄임 / source sharding)
- wave 1005 에서 결정

## 관련 wave

- Wave 988: claim_mvp_lifecycle_checks statement_timeout 60s
- Wave 991: 14 RPC statement_timeout 일괄 60s
- Wave 1002: patchRowsByIds chunk-level retry + staleRunMinutes default 6→8 + collect-logs lib default 3→8
- Wave 1003: velocity RPC category 단위 분할
- **Wave 1004 (이 wave)**: patchRows 자체 single-call retry
