# Wave 187 (2026-05-17) lifecycle worker — last_seen 갱신 + batch cap 1000

> **중요도: HIGH.** Wave 184 (market-worker incremental) 의 의도된 후속.
> active 매물 last_seen freshness 시스템 wide 부족 (10~25%) → 시세 산정 누락 → 사용자 매물 카드 시세 미표시.

## 사용자 보고 origin

> "이거 다 해결됏으면 또는 자연해결될거면 그럼 우리 전에 맥락으로 가서 그다음 해결할것은?"

Wave 184 가 인프라 (PostgREST 1000 cap + pagination + lookback) 해결 후, 사용자가 본 매물 카드 (MacBook Air i3) 의 진짜 시세 미표시 문제 추적 → 시스템 wide search/lifecycle freshness 발견.

## 진단 (사용자 통찰의 후속)

### 측정 1: niche SKU 가설 X — 시스템 wide 문제

MacBook Air chip 별 분포 측정:
| chip | listings | fresh_28h | fresh % |
|---|---|---|---|
| m2 | 148 | 32 | 22% |
| m1 | 130 | 27 | 21% |
| m4 | 123 | 13 | 11% |
| m5 | 83 | 17 | 20% |
| m3 | 72 | 15 | 21% |
| i5 | 36 | 5 | 14% |
| **i3** | 15 | 3 | 20% |
| i7 | 4 | 1 | 25% |

→ **i3 만의 문제 아님.** 모든 chip fresh_28h 비율 **10~22%**. 시스템 wide.

### 측정 2: 전체 카테고리 last_seen freshness

| SKU | total_active | fresh_28h | fresh % |
|---|---|---|---|
| ipad-mini | 486 | 69 | 14.2% |
| macbook-air | 613 | 109 | 17.8% |
| airpods-pro-2 | 528 | 148 | 28.0% |
| ipad-pro | 726 | 185 | 25.5% |
| **shoe-nike-dunk-low** | 275 | 219 | **79.6%** ← specific query 30+ 있음 |
| **shoe-adidas-gazelle-og** | 238 | 219 | **92.0%** ← 동일 |

→ **search query 가 specific 한 카테고리만 80%+ fresh.** broad query 카테고리 10~25%. 신발 Wave 134/138/144 의 specific query 보강 효과 검증된 셈.

### 측정 3: 원인 분석

1. `markRawLifecycleState` ([tick-pipeline.ts:3150](../../src/lib/tick-pipeline.ts:3150)) 가 `last_seen_at` 갱신 안 함 (status / sold_detected_at / disappeared_at / missing_count / sale_status 만 patch). lifecycle 가 detail fetch 해도 raw_listings.last_seen 안 박힘.
2. RPC `claim_mvp_lifecycle_checks` 가 **`limit ... least(p_batch_size, 200)`** — batch_size param 어떤 값 넣어도 max 200 으로 cap. 코드 (`LIFECYCLE_BATCH_HARDCODE = 400`) 와 mismatch → 200 만 처리.
3. `tickDetailBudgetMs` 20초 공유 — lifecycle batch 늘려도 timeout. 측정 400 batch → 139 enriched (35%).

→ Wave 184 의 28h lookback 이 의미 있으려면 active 매물 lifecycle 가 28h 안에 cover. 현재 batch 200 + 7분 cycle = 시간당 1,720 매물 → cover 88시간 (3.7일). **부족.**

## 충돌 조사

| 항목 | 결론 |
|---|---|
| `markRawLifecycleState` 호출 site | 4 곳 — disappeared / sold_confirmed / active / missing_suspect 전환. 모두 detail fetch 후 호출 (last_seen 갱신 의미 자연스러움) |
| `last_seen_at` 다른 writer | searchStage (L1268) 가 매물 페치 매 tick `now`. lifecycle 추가 갱신 — 같은 timestamp 덮어쓰기, idempotent. coalesce_seen_at_only_window policy 영향 없음 (그건 search 내부 dedup) |
| `claim_mvp_lifecycle_checks` RPC caller | lifecycle-worker route 만. terminal_recheck 는 별도 RPC (`claim_mvp_terminal_lifecycle_rechecks`) — 영향 X |
| Bunjang rate limit | probe c=20 lenient 검증 ([tick-pipeline.ts:3116](../../src/lib/tick-pipeline.ts:3116) 코멘트). batch 800 → 시간당 4800 calls / 7분 cycle → 안전 |
| `tickDetailBudgetMs` 공유 | detailStage / poolWarmerStage / lifecycleStage 다 쓰는데, lifecycle 만 별 budget 필요. **`lifecycleBudgetMs` 별 config 추가** 로 분리 — detail/poolWarmer 영향 X |
| `lifecycle-worker` route 의 terminal_recheck 추가 호출 | route 가 lifecycle 후 terminal_recheck 도 호출. maxDuration 90 안에 둘 다. lifecycle 60s → terminal 30s 분배 안전 |

→ **충돌 없음.** 변경 4 곳 (코드 2 + config 1 + RPC migration 1).

## 변경

### 1. `src/lib/tick-pipeline.ts:3150` (B1)

`markRawLifecycleState` 의 patch 에 `last_seen_at: now` 추가:
```ts
const patch: Record<string, unknown> = {
  listing_state: status,
  last_seen_at: now,  // ← Wave 187 B1 추가
  updated_at: now,
};
```

→ lifecycle 가 detail fetch 후 → status patch 시 last_seen 같이 갱신. search 가 못 페치한 매물도 lifecycle cover 하면 fresh.

### 2. `src/lib/tick-pipeline.ts:3123` (B2 batch)

```ts
// Before
const LIFECYCLE_BATCH_HARDCODE = 400;
// After
const LIFECYCLE_BATCH_HARDCODE = 800;
```

### 3. `src/lib/pipeline-config.ts` (B2 budget)

- `PipelineRuntimeConfig` 타입에 `lifecycleBudgetMs: number` 추가
- envInt 등록:
```ts
lifecycleBudgetMs: envInt("PIPELINE_LIFECYCLE_BUDGET_MS", 60_000, 1_000, 120_000),
```

### 4. `src/lib/tick-pipeline.ts:4409` (`runLifecycleWorkerPipeline`)

```ts
// Before
const detail = await timedStage(..., () => lifecycleStage(Date.now() + config.tickDetailBudgetMs, mode));
// After
const detail = await timedStage(..., () => lifecycleStage(Date.now() + config.lifecycleBudgetMs, mode));
```

### 5. RPC migration `wave187_lifecycle_batch_cap_increase`

`claim_mvp_lifecycle_checks` 의 `limit greatest(1, least(coalesce(p_batch_size, 30), 200))` → `... 1000)` 으로 변경. 다른 로직 그대로. 성공 — `{"success":true}`.

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### 로컬 실측 (force=1 lifecycle-worker)

| 시도 | RPC cap | batch | budget | claimed | enriched | timedOut | total |
|---|---|---|---|---|---|---|---|
| Baseline (Wave 187 전) | 200 | 400 | 20s | 200 | 168 | true | 14s |
| migration 후 batch 800 + 20s budget | 1000 | 800 | 20s | 800 | 139 | **true (17%)** | 26s |
| **+ 75s budget** | 1000 | 800 | 75s | 800 | **621 (78%)** | true | 81s ⚠️ |
| **+ 60s budget (최종)** | 1000 | 800 | 60s | 800 | **345 (43%)** | true | 76s ✅ |

**최종 선택 = 60s budget**:
- 80s 는 maxDuration 90 안전 마진 부족 (terminal_recheck 추가 호출 영향)
- 60s → 76s total = lifecycle 60 + terminal 16. maxDuration 90 안전
- enriched 345 / cycle. lifecycle 가 2분 cron 주기 (CLAUDE.md) 기준 시간당 ~10,350 매물 sweep → active 151K cover **14.6시간**.
- Wave 184 28h lookback 안에 1 sweep 완료 → fresh % 대폭 ↑ 예상

### DB migration 적용
```
mcp__supabase__apply_migration({"name":"wave187_lifecycle_batch_cap_increase", ...})
→ {"success":true}
```

## 위험

1. **`last_seen_at` 갱신 시 search 의 coalesce policy 영향**:
   - search 의 last_seen 갱신은 raw_listings 의 다른 컬럼 (price, num_faved 등) 동시 변경 가능 — Wave 187 의 lifecycle 은 last_seen 만. mixing → 시점 mismatch 가능.
   - 완화: lifecycle 의 last_seen 갱신은 detail fetch 직후 (의미 동일). 다른 컬럼 mismatch 영향 없음.

2. **batch 800 + 60s budget timeOut 빈도**:
   - 800 중 345 처리 (43%) → 455 매물 next_check 10분 뒤로 미룸. cycle 마다 timed_out 매물 누적.
   - 완화: 미룬 매물은 다음 cycle 첫 우선순위 (priority_tier 정렬). 점진적 cover.

3. **prod 첫 cycle 시 lifecycle workload spike**:
   - 코드 deploy 직후 active 151K 매물의 next_check 가 일제히 만료 → 한 cycle 800 만 처리 가능, queue backlog.
   - 완화: 1~2 일 안에 자연 점진적 sweep. Bunjang API rate limit 영향 X (probe c=20 lenient).

4. **terminal_recheck 시간 확보**:
   - lifecycle 60s + terminal 30s = 90s 한도. 실측 76s 안전.
   - terminal 의 batch 도 늘리면 추가 위험 (별 wave 시 검토).

## 다음 액션

### 즉시 (1~2일 내 측정)

1. `mvp_raw_listings` 의 fresh_28h 비율 점진적 증가 확인 (현재 10~25% → 60%+ 목표)
2. `mvp_market_price_daily` 의 niche SKU (i3, intel 등) row 박히는지 확인 (Wave 184 + Wave 187 의 의도된 collateral effect)
3. lifecycle backlog 정상 소화 확인 (next_check_at distribution 변화)

### 별 wave 후보

| Wave | 내용 | 우선순위 |
|---|---|---|
| 188 | search query specific 보강 (broad SKU 별 chip/variant query — 신발 사례) | medium — Wave 187 결과 측정 후 |
| 185 | raw_listings TTL (60일+ disappeared/sold hard delete) | low — 신생 9일짜리 시스템, 30~60일 후 시급 |
| 186 | market_price_daily rollup (daily 30+ → weekly → monthly) | low — 장기 storage 절약 |

## 운영 조정 옵션 (env)

| env | default | 의미 |
|---|---|---|
| `PIPELINE_LIFECYCLE_BUDGET_MS` | 60000 | lifecycle 처리 시간. maxDuration 90 안에 lifecycle + terminal 안전 분배. 늘리려면 80000 (terminal 시간 줄어듦 — 추후 측정 후) |

## Lesson

1. **niche SKU 가설 검증** — i3 macbook 하나만 본 게 아니라 chip 전체 측정. m1/m2/m3/m4 도 동일 fresh 비율 → 시스템 wide 라는 결론. **단일 케이스 진단 X, 전수 측정 필수**.

2. **RPC schema 검증** — code 측 batch 변경만으로 부족. RPC 내부 `least(p_batch_size, 200)` cap 발견. **DB 함수 정의도 같이 확인** (`pg_get_functiondef` 으로 정의 확인 후 수정).

3. **공유 config 의 영역 분리** — `tickDetailBudgetMs` 가 detail/poolWarmer/lifecycle 셋 다 공유. 한 영역 변경하려면 분리 (lifecycle 전용 `lifecycleBudgetMs` 도입). **단일 config 가 여러 stage 공유 시 trade-off 발생 — 분리 검토**.

4. **timed_out 의 의미** — claimed 800 / enriched 345 면 "실패" 가 아니라 "이번 cycle 분량 한도". next cycle 에서 미룬 매물 우선 처리. **timed_out=true 가 항상 나쁜 게 아님**.

5. **Vercel cron schedule 의 외부 의존** — vercel.json 에 lifecycle-worker 없음. QStash 추정. **schedule 정확값을 추후 운영자 직접 확인 권장**.

6. **사용자 통찰의 후속** — Wave 184 의 단순 fix (incremental) → Wave 187 의 lifecycle 보강 → 자연스러운 layered approach. **한 wave 가 다음 wave 의 필요를 명확히 함**.
