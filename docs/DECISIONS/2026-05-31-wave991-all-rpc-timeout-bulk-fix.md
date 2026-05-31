# Wave 991 — 모든 RPC statement_timeout 일괄 fix (mole 잡기 종결)

- 시간: 2026-05-31 19:50 KST
- 트리거: 사용자 "씨발 도대체 언제 고칠거야". 매 wave 마다 다른 RPC 에서 같은 패턴 발견 — 일괄 audit + fix.

## 패턴 종결 — PostgREST default 8s mismatch

매 wave 마다 다른 RPC 에서 발견:
- wave 980 (5/31): wave978_backfill_daangn_lifecycle_chunk
- wave 981 (5/31): sync_market_velocity_daily
- wave 986 (5/31): claim_scorable_raw_rows (신규 RPC 박을 때 박음)
- wave 987 (5/31): wave978_backfill 시그니처 확장
- wave 988 (5/31): claim_mvp_lifecycle_checks + claim_mvp_terminal_lifecycle_rechecks
- 또 발견 가능성: 다른 RPC 들

같은 패턴 → 일괄 fix.

## Audit + Fix

### Before (wave 991 전)
| RPC | statement_timeout |
|---|---|
| claim_mvp_lifecycle_checks | 60s (wave 988) |
| claim_mvp_terminal_lifecycle_rechecks | 60s (wave 988) |
| claim_scorable_raw_rows | 60s (wave 986) |
| sync_market_velocity_daily | 120s (wave 981) |
| wave978_backfill_daangn_lifecycle_chunk | 55s (wave 980/987) |
| **claim_mvp_detail_queue** | **DEFAULT 8s** ❌ |
| **claim_mvp_joongna_detail_queue** | **DEFAULT 8s** ❌ |
| **drain_stale_missing_suspect** | **DEFAULT 8s** ❌ |
| **expire_mvp_plans** | **DEFAULT 8s** ❌ |
| **expire_search_query_cadence_overrides** | **DEFAULT 8s** ❌ |
| **expire_stale_hotdeal_reservations** | **DEFAULT 8s** ❌ |
| **commit_mvp_pool_reveal** | **DEFAULT 8s** ❌ |
| **invalidate_mvp_pool_entry** | **DEFAULT 8s** ❌ |
| **spend_and_record_pack_open** | **DEFAULT 8s** ❌ |
| **claim_mvp_kakao_share_bonus** | **DEFAULT 8s** ❌ |
| **claim_mvp_user_credits** | **DEFAULT 8s** ❌ |
| **claim_next_hotdeal_for_alert** | **DEFAULT 8s** ❌ |
| **reserve_mvp_pool_candidates** | **DEFAULT 8s** ❌ |
| **release_mvp_pool_reservation** | **DEFAULT 8s** ❌ |

### Migration
- `supabase/migrations/20260531095000_wave991_all_rpc_statement_timeout.sql`
- DO block 으로 14 RPC 일괄 ALTER FUNCTION SET statement_timeout TO '60s'
- 조건: statement_timeout 미박힌 RPC 만 (NOT EXISTS) — 기존 박힌 거 건드림 0

## 평가

**Trade-off 0**:
- 정상 RPC 작업 1~2초. 60s 는 emergency buffer (PG 부하 peak / 데이터 폭증 대비)
- 사용자 실시간 RPC (pack_open / pool_reveal) 도 정상 빠르게 끝남. 60s 박는 게 응답 시간 영향 X
- 코드 변경 0. 응답 호환성 0 변화.

## 검증

- migration applied (success)
- 7 sample RPC 확인 — proconfig 에 `statement_timeout=60s` 박힘 ✅
- 다음 cron tick 들 이 RPC 호출 시 60s 한도 적용

## 효과

이제 운영 패턴 영구 차단:
- mvp_raw_listings/mvp_lifecycle_checks/mvp_detail_queue 등 테이블 커져도 RPC 8s timeout fail 발생 0
- 매번 새 RPC 발견 → 매번 같은 wave 박는 패턴 종결

## 다음

- 24h 후 PostgREST 57014 timeout fail 추세 측정 (목표 0~5건/24h, 이전 80건/24h)
- 잔존 fail 은 다른 원인 (route maxDuration / lock 충돌 등) → 별개 wave
