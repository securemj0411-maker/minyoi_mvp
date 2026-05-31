# Wave 819 — cadence evaluator cooldown 1h → 4h (housekeeper stale fix)

날짜: 2026-05-31
범위: 1줄 변경 (`tick-pipeline.ts:6517`)

## 배경

운영 알림: `긴급 Housekeeper: 67% 실패 (2/3)` 박힘 (05-31 13:42 KST).

진단 결과:
- 정상 housekeeper duration: 2-3초
- 1h 마다 cadence eval 박은 cycle: 88초 spike
- 그 사이 cron lock missing 으로 누적되면 10분 timeout (stale)
- 최근 timing:
  - 21:37 UTC success 89s
  - 01:07 UTC success 88s
  - 00:07/00:37/02:37/04:07/04:37 UTC stale (10분 timeout)

Root cause: `evaluateSearchQueryCadences` (cadence evaluator) 가:
- raw_listings 최근 24h 전부 paginate (PAGE 1000, HARD_CAP 100,000)
- pool 전체 50,000 scan
- 9,379 search queries 별 집계 + registry write

→ 1h cooldown 마다 박기 너무 무거움.

## 변경

```diff
- const QUERY_CADENCE_EVAL_COOLDOWN_MS = 60 * 60_000; // 1시간
+ const QUERY_CADENCE_EVAL_COOLDOWN_MS = 4 * 60 * 60_000; // 4시간
```

## 효과

- cadence eval 박는 cycle 수 1/4 로 ↓ (housekeeper stale 박을 확률 대폭 ↓)
- query cadence 재평가 빈도 4h 1회 — query crawl 빈도/우선순위 영향 미미
- cron lock 누적 차단

## Backward-compat

- 코드 변경만, DB 무변경
- 옛 cycle 의 registry row 그대로 — `shouldRunCadenceEvaluator` 가 `last_evaluated_at` 기준 4h 안 박은 cycle 만 skip

## TS check

`npx tsc --noEmit` — src/ 0 error.

## Follow-up (안 박은 것)

- 옵션 B: cadence eval 별도 cron 분리 (큰 변경)
- 옵션 C: raw scan 24h → 12h, pool scan 50K → 10K (cadence eval 자체 가볍게)

→ 옵션 A 만 박음 — 가장 안전 + 즉시 효과.

## Sign-off

자율 진행 — destructive 없음. owner 확인 받음 ("해결해야 되는 거 아님?").
