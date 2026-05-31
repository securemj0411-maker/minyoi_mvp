# Wave 982 — 운영 systemic audit + housekeeper fix

- 시간: 2026-05-31 17:00 KST
- 트리거: 사용자 "씨발 계속 확인해야지" — silent fail / stale 패턴 또 있는지 systematic 측정.

## Audit 결과 (24h cron + 데이터 stale)

### A. cron health (24h)
| cron | ok | fail | 진단 |
|---|---:|---:|---|
| **housekeeper** | 30 | **15 (33%)** | 🚨 stale 3m, maxDuration 90s 초과 |
| **score-worker (lane a)** | 1,364 | **30 (2.2%)** | ⚠️ PostgREST 57014 mvp_raw_listings SELECT timeout |
| daangn-lifecycle-backfill | 1 | 11 (RPC fix 전) | ✅ wave 980 후속 fix |
| lifecycle-worker (a) | 278 | 4 | ✅ wave 979 PG overload 이전 |
| 나머지 cron | 정상 | fail 0~2 | ✅ |

### B. stale 데이터
| 테이블 | latest | 진단 |
|---|---|---|
| mvp_market_velocity_daily | 어제 11:36 → 오늘 07:43 | ✅ wave 981 fix 후 정상 |
| mvp_market_price_daily | 07:43 today 8,943 | ✅ |
| mvp_candidate_pool ready | 07:48 | ✅ |
| mvp_lifecycle_checks | 07:48 (299k) | ✅ |

### C. 큐 깊이
| 큐 | 깊이 | 진단 |
|---|---:|---|
| mvp_detail_queue pending | 16 | ✅ 정상 |
| mvp_market_key_invalidation pending | 349 | ✅ 정상 (market-worker 따라잡음) |
| **mvp_lifecycle_checks claimable** | **114,171** | ⚠️ 큰 backlog, but wave 979 capacity 28,800/h 면 4h 해소. spread 7d 적용 됐으면 자연 분산 |
| **daangn raw_listings detail_pending** | **101,624** (24h 신규 30k) | ⚠️ daangn-detail-worker capacity 부족 가능 |

## Wave 982 fix

### 1. housekeeper maxDuration 90→180
- `src/app/api/cron/housekeeper/route.ts:16` 변경
- 원인: expire_mvp_plans RPC + cadence evaluator + payload retention (90일) 누적 무거움. 90s 초과 시 Vercel kill → finishCollectRun 안 됨 → 다음 cron 시작에서 markStaleCollectRuns 3m stale 마킹.
- lifecycle-worker 도 180s 라 동일 패턴.

## 미해결 갭 (별도 wave 필요)

### 2. score-worker (lane a) PostgREST timeout
- 원인: lane a 는 sourceFilter 없어서 mvp_raw_listings (840k row, 큰 column 25개) SELECT 가 PostgREST default 8s 초과. lane b/c 는 sourceFilter='daangn'이라 OK.
- fix 옵션: query limit 줄임 / source-별 chunk / PG side raise statement_timeout
- 2.2% fail 이라 영구 데이터 손실은 아니지만 운영 모니터링 필요

### 3. daangn detail_pending 101k backlog
- 24h 신규 30k → 신규 inflow 분당 ~20건
- daangn-detail-worker 24h ok 842 (분당 0.58 run). run 당 처리량 측정 필요.
- 만약 처리량 < 신규 inflow → backlog 무한 증가
- 별도 wave 측정 + capacity 확장 (lane b/c 패턴 또는 batch 증가)

### 4. daangn-lifecycle-backfill 작동 확인
- statement_timeout fix 후 7:35 succeeded ✅. 다음 cron tick 들 정상 작동 측정 필요.

## 다음 단계

1. wave 982 commit + push (housekeeper fix)
2. daangn-detail-worker capacity 측정 → 부족하면 wave 983
3. score-worker (lane a) timeout 진단 → wave 984
4. 매 cron + 큐 monitor — 사용자가 매 확인 요청 시 빠르게 측정 가능한 query set 정리 (DECISIONS 안에)

## 솔직 평가

사용자가 짚어준 게 매번 정답. "근본 박았다" 단언 후 추가 audit으로 또 발견. 패턴:
- wave 978 → 사용자 "근본 박았냐?" → wave 979 발견
- wave 980 → 사용자 audit → pool stale + RPC timeout 발견
- wave 980 → 사용자 "velocity?" → wave 981 발견
- wave 981 → 사용자 "씨발 계속 확인" → wave 982 + 미해결 2개 추가 발견

지금까지 발견된 운영 갭이 더 있을 수 있음. 매 release 후 systematic audit script (cron health + 큐 깊이 + stale 테이블) 자동화 권장 (별도 wave).
