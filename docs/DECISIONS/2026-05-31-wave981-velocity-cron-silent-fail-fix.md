# Wave 981 — velocity cron silent fail fix

- 시간: 2026-05-31 16:45 KST
- 트리거: 사용자 "velocity 기록 다 잘 되냐?" 측정 시 발견.

## 발견

- `mvp_market_velocity_daily` last_computed = **2026-05-30 11:36 UTC** (하루 전 멈춤).
- `sync-market-velocity` cron `mvp_collect_runs` 검색 결과 **0건** → route 가 collect_run 안 박아서 silent fail 무방비.
- market-worker self-heal (wave 886.17) 도 fail — RPC 호출 시 PostgREST default statement_timeout 8s 초과로 실패. catch swallow.
- MCP 직접 호출도 timeout (PG 안에서는 끝남 — 직접 호출 후 today_rows 2,694 박힘 확인).

## 변경

### DB
- `ALTER FUNCTION public.sync_market_velocity_daily() SET statement_timeout TO '120s'`. RPC 호출 시 client default 8s 무시. PostgREST/route maxDuration 90s 안에서 OK.
- migration: `20260531071000_wave981_velocity_rpc_statement_timeout.sql`

### Route
- `src/app/api/cron/sync-market-velocity/route.ts` 갱신:
  - `startCollectRun` + `finishCollectRun`/`failCollectRun` 박음 → silent fail 차단, watchdog 추적 가능
  - 응답에 runId 포함
  - error path 도 failCollectRun

## 검증

- 직접 RPC 호출 (`SELECT public.sync_market_velocity_daily()`) 후 velocity_daily today_rows 2,694 박힘 ✅
- market-worker self-heal 다음 run 부터 statement_timeout 120s 활용 → 정상 작동 예상

## 위험

- statement_timeout 120s 는 RPC 자체 한도. raw_listings 가 더 커지면 더 늘려야 할 수 있음 (현재 ~840k row 에서 정상).
- route maxDuration 90s 보다 길어지면 route timeout 가능 — RPC 가 90s 안 끝나면 무한 stall 위험. self-heal 은 매 market-worker tick 마다라 idempotent.

## 다음

- 다음 sync-market-velocity cron tick (00:15/06:15/12:15/18:15 UTC) 또는 market-worker self-heal 작동 확인.
- 만약 cron silent fail 재발 시 (collect_run 박혀도 fail) — Vercel cron 자체 이슈 의심. 별도 incident.
- velocity_daily 갱신 frequency monitor 권장 (incident-watch / cron-watchdog 안에 velocity stale check 박기 — 별도 wave).
