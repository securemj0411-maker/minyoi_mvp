# Wave 1002 — staleRunMinutes default 6→8 + collect-logs lib default 3→8 + patchRowsByIds per-chunk retry

- 시간: 2026-06-01 17:55 KST
- 트리거: 운영 텔레그램 알림 3건 연속.
  - 17:12 "긴급 Housekeeper: 67% 실패 (2/3)"
  - 17:32 "경고 Market: 11% 실패 (1/9)"
  - 17:32 "경고 recovery_worker: 9% 실패 (7/81)"

## 발견

### A. housekeeper / market_worker stale false-fail (root cause #1)

`mvp_collect_runs` 최근 12h, stale fail 메시지 집계:

| job | 3m | 6m |
|---|---:|---:|
| market_worker | 18 | 19 |
| score | 7 | 14 |
| detail | 8 | 3 |
| recovery_worker | 3 | 6 |
| lifecycle | 4 | 0 |
| housekeeper | 2 | 3 |

**같은 cron 에서 3m / 6m 메시지 둘 다 박힘.** wave 989 (06-01 03:41 KST) 에서 default 3→6 박혔고 wave 994 decision log 에 "wave 989 후 새 threshold = 6m" 명시. 즉 deploy 자체는 성공. 그러나 12h 동안 3m 메시지 33건 계속 발생.

가능성:
- `collect-logs.ts:223` `markStaleCollectRuns(maxAgeMinutes = 3)` lib default. 어디서 인자 없이 호출되는 경로 가능
- Vercel build cache / 옛 인스턴스 잔존
- 미지 caller (admin/debug route 등)

원인 무엇이든 **lib default 도 같이 올리면 모든 경로 cover**.

추가 발견: Wave 995 (market-worker maxDuration 240→300) + Wave 997 (housekeeper 180→300) 박힌 후 모든 무거운 cron 5분 도달. **default 6 (=360s) 도 300s + 60s margin 뿐 → 부족**.

실측:
- housekeeper 09:07 succeeded **223s** (3.7분)
- market_worker 09:12 succeeded **273s**, 09:02 succeeded **326s** (maxDuration 초과 직전)

### B. recovery_worker per-chunk fail propagation (root cause #2)

에러 패턴 10건: `Supabase REST failed 500 PATCH /rest/v1/mvp_raw_listings?pid=in.(...)`. 31~46초 걸려서 500 반환.

원인:
- `tick-pipeline.ts:553` `patchRows()` → restFetch throw 시 catch 없음
- `tick-pipeline.ts:561` `patchRowsByIds()` → chunk loop 안 catch 없음
- 한 chunk(25 pid) transient 500 → recovery_worker 전체 fail
- 1분 cron 주기 → 같은 후보 다음 tick 재시도 → 부하 spike 재충돌 → 누적

`patchRowsByIds` 는 `score_dirty=true` 같은 idempotent mark 용도. chunk drop 해도 다음 cron picks up. drop 안전.

같은 패턴: Wave 994 daangn lock retry, Wave 1000 daangn lock retry 1→3회. transient PG/REST 오류에 retry 박은 거 일관.

### C. housekeeper 알림 임계값 (부차)

`tick-pipeline.ts:3605` critical ≥20% + total≥3 + failed≥1. housekeeper 30분 주기 → 120분 window 4건 정상. 1건 fail = 25% → critical 트리거. root cause A 해소 시 자연 사라짐. 추가 fix 보류.

## 변경

### Fix 1 — `pipeline-config.ts:607` default 6 → 8

```diff
- staleRunMinutes: envInt("PIPELINE_STALE_RUN_MINUTES", 6, 1, 60),
+ staleRunMinutes: envInt("PIPELINE_STALE_RUN_MINUTES", 8, 1, 60),
```

8분 (480s) = maxDuration 300s + 180s margin. Wave 989 시점 maxDuration 240s 였으나 wave 995/997 에서 300s 까지 늘림.

### Fix 2 — `collect-logs.ts:223` lib default 3 → 8

```diff
- export async function markStaleCollectRuns(maxAgeMinutes = 3): Promise<number> {
+ export async function markStaleCollectRuns(maxAgeMinutes = 8): Promise<number> {
```

모든 known caller (cron route 20+개) 가 `config.staleRunMinutes` 사용. 그러나 production "3m" 메시지 잔존 → 미지 경로 cover.

### Fix 3 — `tick-pipeline.ts:561` `patchRowsByIds` per-chunk try/catch + 1회 retry

```diff
- for (const chunk of chunkArray(ids, chunkSize)) {
-   await patchRows(table, `pid=in.(${chunk.join(",")})`, payload);
- }
+ for (const chunk of chunkArray(ids, chunkSize)) {
+   const filter = `pid=in.(${chunk.join(",")})`;
+   try {
+     await patchRows(table, filter, payload);
+   } catch (firstErr) {
+     await new Promise((resolve) => setTimeout(resolve, 500));
+     try {
+       await patchRows(table, filter, payload);
+     } catch (retryErr) {
+       console.warn(`patchRowsByIds chunk failed twice, skipping: ...`);
+     }
+   }
+ }
```

chunk 별 try/catch + 500ms backoff 후 1회 retry. 2회 실패 시 warn + 다음 chunk 진행 (idempotent). recovery_worker / lifecycle / score 등 27+ 호출 곳 전체 적용 (call-site 변경 0).

## Env 확인 (사용자 액션 불필요)

- `vercel env ls production` 결과 `PIPELINE_STALE_RUN_MINUTES` 안 박혀있음 ✅
- 즉 코드 default 가 적용됨. 위 fix 1, 2 deploy 만 하면 끝.
- Vercel auto-deploy (git push) 트리거 예정

## 검증

- `npx tsc --noEmit`: 새 에러 0 (`pipeline-config.ts` + `collect-logs.ts` + `tick-pipeline.ts` clean). 기존 tests/ 사전 부채 161 그대로.
- 24h 후 측정:
  - housekeeper / market_worker stale fail 0~1 (현재 12h 기준 합산 32건)
  - "3m" 메시지 박힘 0 (lib default cover 효과)
  - recovery_worker PATCH 500 → warn 로그로 흡수 (fail 카운트 X)

## 위험

- `patchRowsByIds` silent drop: 진짜 schema/auth 오류도 warn 로 skip. restFetch 가 status code 그대로 throw 하므로 log 에 보임. 후속 wave 에서 retry-then-skip 카운트를 stage_stats 에 박는 거 검토.
- 8분 default 도 maxDuration 600s 까지 늘리면 (Vercel Pro 한도) 다시 mismatch. 새 maxDuration wave 박힐 때마다 default 재검토 필요.
- 진짜 stuck run cleanup 6→8분 지연. alert 일 뿐, 운영 영향 작음.

## 다음

- git push → vercel auto-deploy → 1~2h 후 fail rate 측정
- 운영 알림 `sourceWorkerFailureMinFailed` housekeeper/market_worker minFailed=2 — root cause 해소 후 잔여 노이즈 보고 결정
- 장기: route별 maxDuration 기반 dynamic staleRunMinutes (별 wave)
- Wave 1001 (raw-prune cron) 효과로 housekeeper/market_worker 무게 더 줄어들면 8분도 여유 (자연 해소 가능성)

## 관련 wave history

- Wave 947: market-worker invalidation timeout
- Wave 951: stale marker DB lease
- Wave 982: housekeeper maxDuration 90→180
- Wave 989: staleRunMinutes default 3→6 (이 wave 의 전임자)
- Wave 990: sync-market-velocity maxDuration 90→180
- Wave 991: 14 RPC statement_timeout 8s→60s
- Wave 994: payload retention 별도 cron + daangn lock retry
- Wave 995: market-worker maxDuration 240→300
- Wave 997: housekeeper maxDuration 180→300
- Wave 998: marketStatsLimit 3000→1000
- Wave 1000: daangn lock retry 1→3회
- Wave 1001: raw-prune cron 신설 (mvp_raw_listings 90일+ DELETE)
- **Wave 1002 (이 wave)**: stale mismatch + recovery patch retry
