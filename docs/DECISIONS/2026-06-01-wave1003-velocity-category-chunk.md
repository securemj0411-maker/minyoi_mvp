# Wave 1003 — velocity sync RPC category 단위 분할

- 시간: 2026-06-01 18:20 KST
- 트리거: Wave 1002 deploy 후 종합 health check 중 발견 — `mvp_market_velocity_daily` 27h 멈춤.

## 발견

`mvp_market_velocity_daily.computed_at` 최신 = **2026-05-31 07:43 UTC** (27h 멈춤).

`sync-market-velocity` 24h cron 4건 모두 fail:

| 시각 (UTC) | 결과 | duration | err |
|---|---|---:|---|
| 06-01 06:15 | failed | 120s | **RPC 57014 statement_timeout** |
| 06-01 00:15 | failed | 120s | **RPC 57014 statement_timeout** |
| 05-31 18:15 | failed | 196s | stale 3m (wave 990 deploy 전) |
| 05-31 12:15 | failed | 200s | stale 3m |

**원인**:
- `sync_market_velocity_daily()` RPC 가 모든 category 한 트랜잭션 (clothing 99k, shoe 83k, smartphone 35k, bag 21k, earphone 17k, tablet 14k, sport_golf 12k, smartwatch 11k, game_console 9k, laptop 7k, 그 외 10+ 작은 category — 총 320k+ row)
- Wave 981 에서 statement_timeout 120s 박았으나 mvp_raw_listings 더 커지면서 120s 도달
- Wave 981 위험 섹션에 정확히 예측됨: "raw_listings 더 커지면 더 늘려야"

**영향**:
- recovery_worker 가 velocity 기반 회복 판단 — outdated 데이터로 판단
- candidate_pool ready 평가 정확도 ↓ — 27h 동안 sold_24h_count/sold_7d_count 신선도 멈춤
- 사용자 후보 평가 신선도 27h 뒤짐

## Fix — category 단위 분할

### DB
- **신규 RPC**: `sync_market_velocity_daily_for_category(p_category text) RETURNS jsonb`
  - statement_timeout 60s (per-category)
  - 기존 RPC 와 같은 로직 + `where p.category = p_category` filter 추가
  - SECURITY DEFINER, search_path 동일
- **기존 RPC `sync_market_velocity_daily()`**: 그대로 유지 (manual 호출용 / backwards compat)
- migration: `supabase/migrations/20260601090000_wave1003_velocity_category_chunk.sql`

### Route
- `src/app/api/cron/sync-market-velocity/route.ts`:
  - maxDuration 180s → **300s** (vercel pro 한도)
  - `loadCategoryList()` 추가 — `mvp_listing_parsed.category` distinct (PostgREST)
  - fallback hardcoded list (DB 실패 시) — 무거운 것부터 정렬
  - category loop, 각 호출 try/catch + perCategory result 박음
  - route deadline 270s (margin 30s) 도달 시 남은 category skip
  - finishCollectRun stage_stats 에 per_category breakdown 박음

### 분할 효과
- 작은 category (monitor 162 row): **즉시 성공** (14 upserted, 직접 테스트)
- 큰 category (clothing 99k 등): 60s 안에 끝나면 OK, timeout 되면 그 category 만 fail + 나머지 진행
- 24h × 4 sync cron = 무거운 category 도 1~2번 안에 한 번 갱신

## 검증

- `npx tsc --noEmit`: 새 에러 0 (`src/app/api/cron/sync-market-velocity/route.ts` clean)
- monitor category 직접 RPC 호출 → `{upserted_rows: 14, sold_sample_total: 38, computed_at: ...}` ✅
- 다음 sync cron (12:15 UTC = 21:15 KST) 부터 새 route + RPC 적용
- 1~2h 내 velocity_daily.computed_at 갱신 확인 예정

## 위험

- DB distinct query 실패 시 fallback hardcoded list. 새 category 추가되면 fallback 누락 가능 — DB query 정상이면 OK.
- 한 category 가 60s 도달 시 skip — 그 category 갱신 안 됨. 다음 cron 또 시도. 만약 매번 timeout 이면 그 category 더 잘게 분할 필요 (별 wave).
- route 300s 도달 시 남은 category skip — 다음 cron picks up. cron 매 6h 4번 → 평균 ~5 category/cron 가능 → 20 category 한 cron 못 다 처리 가능. 다음 cron 보완.

## 다음

- git push → vercel auto-deploy
- 다음 sync cron (12:15 UTC = 21:15 KST) 결과 측정
  - finishCollectRun stage_stats per_category 보고 어느 category 느린지 파악
  - 만약 큰 category (clothing/shoe) 매번 timeout 이면 sub-chunk (comparable_key prefix 별) 필요
- velocity_daily.computed_at = 오늘 박힘 확인
- recovery_worker / candidate_pool 평가 정확도 회복 확인

## 관련 wave

- Wave 981: velocity cron silent fail fix + statement_timeout 120s
- Wave 982: ops systemic audit
- Wave 989: staleRunMinutes default 3→6
- Wave 990: sync-market-velocity maxDuration 90→180
- Wave 991: 14 RPC statement_timeout 일괄 60s
- Wave 994: payload retention 별도 cron
- Wave 1002: stale mismatch + recovery patch retry
- **Wave 1003 (이 wave)**: velocity RPC category 단위 분할
