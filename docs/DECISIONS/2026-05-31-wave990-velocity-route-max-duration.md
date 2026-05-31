# Wave 990 — sync-market-velocity route maxDuration 90→180

- 시간: 2026-05-31 19:30 KST
- 트리거: 측정 — velocity_daily 7:43 UTC 이후 12시간 stop. 12:15 + 18:15 UTC sync cron 둘 다 stale 3m fail.

## 발견

velocity_daily 마지막 갱신: **2026-05-31 07:43 UTC** (12h 전 직접 호출). 두 번의 cron sync 다 fail:

| 시각 | 결과 | duration |
|---|---|---|
| 12:15 UTC | failed (stale 3m) | 199s (12:15→12:18:37) |
| 18:15 UTC | failed (stale 3m) | 195s (18:15→18:18:17) |

진단:
- route maxDuration = **90s** (`src/app/api/cron/sync-market-velocity/route.ts:25`)
- wave 981 박은 statement_timeout = **120s** (PG function level)
- 즉 route 90s 가 먼저 kill → finishCollectRun 못 호출 → DB running 잔존 → 3분 후 markStaleCollectRuns 가 fail 마킹
- statement_timeout 120s 박은 게 의미 없음 — route 가 먼저 끝남

## 변경

`src/app/api/cron/sync-market-velocity/route.ts:25`:
- `maxDuration = 90` → **180**
- RPC 120s + processing margin

## 평가

**Trade-off 0**:
- Vercel maxDuration 늘림. Pro plan 300s 한도라 마진 있음.
- 코드 다른 path 변경 0.
- statement_timeout 120s 와 route 180s 정합 — RPC 끝까지 응답 받음.

## 검증

- typecheck clean
- 다음 sync cron (00:15 UTC 자정 후) 부터 새 maxDuration 적용
- 또는 다음 자정 직후 market-worker self-heal — new date row 없으면 RPC 호출

## 다음

- 자정 후 (UTC 0:00) date 변경 시 market-worker self-heal 또는 다음 sync cron 갱신 측정
- velocity_daily 새 row 박힘 확인 (date = today)
- 24h 후 sync cron fail 0 도달 측정
