# Wave 812 — daangn sweep throughput 강화 (cron 빈도 + batch)

- 시간: 2026-05-30 KST
- 트리거: owner — "B 시급한데 왜이렇게 느린거야?? 우리 지금 배포 a,b,c 버셀에 한거 작업로그 보면 알건데 이거 이용해서 병렬 처리로 속도내도 되고"

## Background — Wave 806 root cause

daangn active 매물 158,822건 중 **49% (77,930건) 가 last_seen 3~7일 stale**.
원인: `daangn-price-sweep-worker` 가 30분 마다 1번, 작은 batch.

### 워커 현재 상태 (vercel.json 진단)
| Worker | 빈도 | 분산 |
|---|---|---|
| daangn-worker (a/b/c) | 5분 마다 (각각) | ✅ 3 워커 (env `CRON_PROJECT_ROLE=daangn_b/c`) |
| daangn-detail-worker | 5분 마다 | ✅ 코드 차원 A/B/C shard (defaultDetailShardIndex) |
| **daangn-price-sweep-worker** | **30분 마다** | ❌ **단일 워커, shard 없음** ← 병목 |

기존 sweep throughput 계산:
```
30분 × maxSkus 80 × maxRegions 8 = 시간당 160 SKU
158K 매물 → 1 cycle 약 31일
```

## 변경 — Phase 1 (즉시 가능)

### A. vercel.json — sweep cron 빈도 ↑ (30분 → 5분, 6x)

```diff
- "schedule": "24,54 * * * *"
+ "schedule": "4,9,14,19,24,29,34,39,44,49,54,59 * * * *"
```

### B. sweep batch size + concurrency ↑

`src/app/api/cron/daangn-price-sweep-worker/route.ts`:

| 변수 | 기존 | 변경 후 |
|---|---|---|
| maxSkus | 80 | **200** |
| maxRegions | 8 | **24** |
| maxCategoryCombos | 8 | **16** |
| maxDetailFetches | 100 | **250** |
| searchConcurrency | 2 | **4** |
| detailConcurrency | 2 | **4** |
| requestDelayMs | 250 | **200** |

새 throughput 추정:
```
5분 × maxSkus 200 × maxRegions 24 = 시간당 2,400 SKU
158K 매물 → 1 cycle 약 2.7일 (vs 31일 = 11x faster)
```

Region rotation offset (이미 박힘) 으로 매 tick 다른 region 부터 → 자연 분산. 동일 SKU 반복 처리 X.

### C. maxDuration 안전 마진
- `maxDuration = 300s` (Pro 한도)
- 새 batch 시간 추정: 200 SKU × 24 region × ~50ms = ~240s. 안전.
- 위험 신호 시 env 로 즉시 fallback 가능 (`DAANGN_PRICE_SWEEP_MAX_SKUS=80` 박으면 원복).

## 차단 / 위험 점검

### Vercel Pro plan
- Cron 5분 × 12 = 시간당 12 호출 / day 288 호출. Vercel cron 한도 안 (단일 cron 5분 이하 가능).
- 다만 detail-worker / daangn-worker A/B/C 도 5분이라 동시 호출 다수. Vercel concurrent execution 한도 점검 필요 (Pro = 무제한).

### Daangn API rate limit
- 작업 늘림 = daangn 호출 늘림. 위험 신호 (429/403) 시 cron-guard 가 source_health 통해 차단.
- detailConcurrency 4 = 동시 4 detail fetch. requestDelayMs 200ms. 충분히 안전.
- 위험 시 env 로 즉시 throttle 가능.

### Cost
- Vercel function execution 시간 ↑. 큰 비용 X (sweep 자체 300s 안).
- Supabase write ↑ (last_seen_at update 더 자주).

## 미해결 — Phase 2 (별도 wave)

### sweep code 에 shard 추가
- 현재 단일 워커, shard 없음 → 3 워커 박으려면 sweep 함수에 `skuShardCount`/`skuShardIndex` 옵션 추가 필요
- detail worker 패턴 그대로 (default by `CRON_PROJECT_ROLE` env)
- 박으면 3x 추가 throughput (= 약 0.9일 cycle)

### 우선순위 sweep
- 현재: 모든 SKU 균등 처리
- 박을 만: ready pool / 최근 본 매물 우선
- 사용자 lookup 시 stale 발견 → 즉시 detail check trigger

### on-demand re-check
- /lookup 시 last_seen > 2일 stale 매물 발견 → 사용자 wait 동안 detail fetch
- 정확도 ↑ but latency 영향 가능 (2~3s)

## 검증 흐름

1. Vercel deploy 끝나면 (3분)
2. 다음 5분 tick 후 cron logs 확인 — 정상 실행 + 429/403 없는지
3. 1h 후 mvp_raw_listings 의 daangn active stale 비율 측정:
   ```sql
   SELECT 
     CASE WHEN last_seen_at > NOW() - INTERVAL '1 day' THEN '1d 이내'
          WHEN last_seen_at > NOW() - INTERVAL '3 days' THEN '1-3d'
          ELSE '3d+ stale' END AS recency,
     COUNT(*) AS cnt
   FROM mvp_raw_listings 
   WHERE source = 'daangn' AND listing_state = 'active'
   GROUP BY recency;
   ```
4. 기존 49% stale → 1주 후 < 20% 목표

## Owner 다른 세션 작업 회피

비교매물 통합 작업 중인 다른 세션이 건드리는 파일:
- `src/app/api/lookup/by-url/route.ts`
- `src/components/pack-reveal-modal.tsx`
- `src/lib/pack-open.ts`

본 wave 는 sweep cron 관련 파일만 (`src/app/api/cron/daangn-price-sweep-worker/route.ts` + `vercel.json`) 박아서 **충돌 X**.

## Follow-up

- Wave 812b — sweep code 에 shard 옵션 추가 (3 워커 패턴 완성)
- Wave 808 sample 의 신발 false-negative audit (catalog mustNotContain 점검)
- 시세 cron 표본 떨어진 root cause (Wave 810c — 폴로 어제 28 → 오늘 5건)
