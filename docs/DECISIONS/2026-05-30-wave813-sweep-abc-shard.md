# Wave 813 — daangn price-sweep A/B/C shard

- 시간: 2026-05-30 KST
- 트리거: owner — "A,B,C 나눠서 다 처리하면 1/3 속도로 빠질텐데"

## Background

- DAANGN_SEARCH_REGION_SEEDS = **6,333 region** (전국 동/읍/면)
- 기존 단일 sweep worker → 1 cycle = 16.5일 (Wave 918) ~ 22시간 (Wave 812)
- detail-worker 가 이미 A/B/C 분산 패턴 박혀있음 (env `CRON_PROJECT_ROLE`)
- → sweep 도 같은 패턴 적용하면 3x throughput

## 구조 — detail-worker 패턴 그대로

| CRON_PROJECT_ROLE env | shardIndex | guard mode |
|---|---|---|
| (없음) / primary / all / daangn_primary | 0 | `daangn_price_sweep_worker_a` |
| daangn_b | 1 | `daangn_price_sweep_worker_b` |
| daangn_c | 2 | `daangn_price_sweep_worker_c` |
| (other) | skip (project_role_disabled) | — |

각 워커가 `selectDaangnRegionShard(allRegionSeeds, 3, shardIndex)` 로 region pool 의 1/3 만 처리.

## 변경

### 1. `src/lib/cron-guard.ts`
- `CronWorkerMode` union 에 `_a/_b/_c` 추가
- `DEFAULT_COOLDOWN_MS`, `DEFAULT_LEASE_MS` 에 3 mode 등록

### 2. `src/lib/daangn-price-sweep.ts`
- `DaangnPriceSweepOptions` 에 `regionShardCount?: number` / `regionShardIndex?: number` 추가
- `runDaangnPriceSweep` 안:
  ```ts
  const searchRegionSeeds = regionShardCount > 1
    ? selectDaangnRegionShard(allRegionSeeds, regionShardCount, regionShardIndex)
    : allRegionSeeds;
  ```
- 기본값 = `shardCount=1, shardIndex=0` → 기존 동작 (단일 워커)
- `DaangnPriceSweepResult` 에 `regionShardCount?` / `regionShardIndex?` 추가 (observability)

### 3. `src/app/api/cron/daangn-price-sweep-worker/route.ts`
- `isDaangnPriceSweepProject()` — `CRON_PROJECT_ROLE` 검증
- `defaultSweepShardIndex()` / `defaultSweepShardCount()` — env 기반 자동 분기
- `sweepGuardMode(count, index)` — guard mode 분리
- `runDaangnPriceSweep({ regionShardCount: 3, regionShardIndex: 0~2 })` 호출
- requestMeta 에 `shardCount`, `shardIndex` 박음 (mvp_collect_runs 에서 추적)

### 4. vercel.json
- **변경 X** — A/B/C 3 프로젝트가 같은 vercel.json 박혀있음 (detail-worker 패턴)
- 같은 cron schedule 호출하면 각 프로젝트 env 가 shard 결정

## throughput 계산

### 기존
| 설정 | 1 cycle |
|---|---|
| Wave 918 (8 region/30분, 단일) | 16.5일 |
| Wave 812 (24 region/5분, 단일) | 22시간 |

### Wave 813 + Wave 812 batch 유지
- 각 워커 = 24 region/5분 (Wave 812 batch)
- 각 워커 shard = 6,333 / 3 = 2,111 region
- 1 cycle (각 워커) = 2,111 / 24 × 5분 = **약 7.3시간**
- 3 워커 동시 동작 = 매 7.3h 전체 region cover

### Wave 813 + Wave 918 batch 보수
- 각 워커 = 8 region/30분 (Wave 918 검증값)
- 1 cycle (각 워커) = 2,111 / 8 × 30분 = **약 5.5일**

본 wave = Wave 812 batch 유지 (7.3시간 cycle).

## Trade-off / 위험

### ✅ 안전
- 각 워커 = **다른 Vercel 프로젝트 = 다른 outbound IP**
- daangn rate limit 입장 = 3 다른 client → IP 부담 분산
- shard 미박힘 시 (B/C project env 없음) = 자동 skip (idempotent)
- 기본값 = 기존 동작 (단일 워커, 변경 X)
- detail-worker 이미 같은 패턴 운영 중 — 검증됨

### ⚠️ 위험
- Wave 812 의 batch (24 region/5분 × 3 워커 = 72 region/5분 동시) = daangn 부담 ↑
  - 다만 IP 3개 분산이라 통제됨
  - 위험 신호 시 env `DAANGN_PRICE_SWEEP_SHARD_COUNT=1` 박으면 즉시 단일 워커 복원
- B/C project 에 catalog/code deploy 안 되어있으면 shard 안 동작
  - 다만 idempotent skip 이라 functional 영향 X

### 즉시 fallback
- `DAANGN_PRICE_SWEEP_SHARD_COUNT=1` → 단일 워커 (각 프로젝트)
- `DAANGN_PRICE_SWEEP_MAX_REGIONS=8` → Wave 918 검증값
- `DAANGN_PRICE_SWEEP_MAX_SKUS=80` → Wave 918 검증값

## 모니터링

```sql
-- 1. 워커 별 metric (shardIndex 별 분리)
SELECT 
  request_meta->>'pipelineMode' AS mode,
  (request_meta->>'shardIndex')::int AS shard,
  COUNT(*) AS runs,
  AVG((request_meta->>'fetchedArticles')::int) AS avg_fetched,
  AVG((request_meta->>'matchedArticles')::int) AS avg_matched,
  SUM((request_meta->>'blockedCombos')::int) AS total_blocked
FROM mvp_collect_runs
WHERE request_meta->>'pipelineMode' LIKE 'daangn_price_sweep_worker%'
  AND finished_at > NOW() - INTERVAL '6 hours'
GROUP BY mode, shard
ORDER BY mode, shard;

-- 2. stale 비율 (1d 후 측정)
SELECT 
  CASE WHEN last_seen_at > NOW() - INTERVAL '1 day' THEN '1d 이내'
       WHEN last_seen_at > NOW() - INTERVAL '3 days' THEN '1-3d'
       ELSE '3d+ stale' END AS recency,
  COUNT(*) AS cnt
FROM mvp_raw_listings 
WHERE source = 'daangn' AND listing_state = 'active'
GROUP BY recency;
```

기존 49% stale → 1주 후 **< 15% 목표** (7.3h cycle 이므로 빠르면 1일 안 < 30%).

## Follow-up

- B/C project deploy 확인 — env `CRON_PROJECT_ROLE` 박혀있는지 owner 점검
- 모니터링 dashboard 별도 wave — shard 별 metric 시각화
- 위험 신호 시 즉시 fallback (env 조정)
