# Wave 980 ops audit follow-ups

- 시간: 2026-05-31 16:10 KST
- 트리거: 사용자 짚음 "근본 fix 또 빠진 거 있는지". systematic audit.

## Audit 결과 — 갭들

### 1. ✅ backfill RPC statement_timeout fail (4/4)
- PostgREST default 8s, INSERT 5k 초과. `SET statement_timeout TO '55s'` 박음.
- migration: `20260531070500_wave980_backfill_rpc_statement_timeout.sql`

### 2. 🚨 daangn pool ready 중 stale 181건 (사용자 노출 위험)
- daangn pool ready 5,153 중 active 4,972, **sold_confirmed 126, disappeared 55**
- 원인: wave 90 (markRawLifecycleState 안 invalidatePoolEntries) 박혔지만 **daangn 은 lifecycle 안 돌아서 sold transition 자체가 안 됨**. 그래서 ready 잔존.
- 즉시 fix: `UPDATE mvp_candidate_pool SET status='invalidated'` (state_reason='wave980_audit_stale_terminal_state')
- 영구 fix: wave 978 (lifecycle 시드) + wave 979 (3 lane) + wave 980 (backfill) 작동 시 자연 해결. 단 backfill 끝나기 전까지 갭 가능.

### 3. ⚠️ source 별 fresh_24h 비율 (시세 sample 영향)
| source | fresh_24h | total_active | fresh % |
|---|---:|---:|---:|
| bunjang | 64,665 | 432,702 | 14.9% |
| daangn | 104,836 | 370,089 | 28.3% |
| joongna | 2,689 | 36,431 | **7.4%** |

- wave 894 (loadMarketStatRows) lookback 28h. fresh_24h ≈ 28h 안 본 매물 비율.
- joongna 7.4% 우려 — 시세 sample 매우 부족. lifecycle worker capacity 부족 + joongna-worker가 옛 매물 갱신 못 함.
- 단 joongna 36k 전체 자체가 작음. wave 979 capacity 28,800/h 후 lifecycle 갱신 가능 → 자연 해결 예상.

### 4. ✅ pool-warmer / market-worker / detail-worker / score-worker daangn 처리 — 정상
- 코드 audit: 모두 source 무관 또는 daangn 분기 박힘 (pool-warmer line 6093+, score-worker-b/c shard 분산, market-worker wave 894 fix)
- 운영 cron audit (collect_runs 2h): 모든 cron fail 0 또는 1 (격리됨)

### 5. ✅ velocity_daily — 카테고리별 정상 분산
- shoe/tablet/laptop/clothing/smartphone/smartwatch/earphone 다 sold_samples 존재. source 갭 없음.

### 6. ✅ market-worker / market_invalidation queue — daangn 자동 포함
- `enqueueMarketKeyInvalidations` source 무관. lifecycle worker 가 daangn 시드 후 sold/disappeared 처리하면 자동 enqueue.

## 결론

근본 큰 갭은 **daangn lifecycle** 단 하나 (wave 978/979/980 박음).  
**부산물**: pool stale 181 (즉시 invalidate), joongna fresh_24h 7.4% (lifecycle capacity 회복 후 자연 해결 예상).

다른 source/cron 에 비슷한 갭 **없음**. 다음 wave 에서 추가 audit 권장 사항:
- 7일 후 daangn fresh_24h 비율 재측정 (backfill + lifecycle 정상화 효과)
- joongna lifecycle 처리 페이스 (lifecycle worker capacity 충분한지)
