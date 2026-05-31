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

## Wave 819b 후속 (2026-05-31)

owner trade-off 검토 후 보수적 선택 — 4h 가 길까봐 **2h 로 변경**.
- commit `7cd63a22`
- 88초 spike cycle 1/2 ↓ (1h → 2h)
- query cadence 반영 지연 2h — 시장 변화 속도 대비 무시 가능

deploy 후 첫 검증 (14:37 KST):
- cadence eval 84.8s success ✅ (stale 박지 않음)
- 다음 cadence eval cycle: 16:37 KST (2h 후)
- 그 사이 housekeeper success 2-3s 짧게 박힐 예상

## Wave 803m 긴급 commit (2026-05-31)

검증 중 발견 — 최근 4 prod deploy Error 박힘.
- 원인: 다른 세션의 Wave 803l (live-ingest.ts) 박혔는데 짝인 Wave 803m (bunjang.ts DetailData name/price 추가) 가 working tree 에만 있고 commit/push 안 됨 → TS fail.
- 긴급 fix: bunjang.ts working tree 변경 commit + push (commit `12fb2d52`).
- 다른 세션 작업이지만 prod block 중이라 박음. 의도 명확 (Wave 803l/803m 짝).

## Wave 818b revert 회고 (2026-05-30)

비교매물 query 에 `detail_status=eq.done` 박았는데 컬럼이 `mvp_listing_parsed` 가 아니라 `mvp_raw_listings` 만 있어서 PostgREST 400 → lookup 깨짐.
- commit `0d4ecea9` revert
- 교훈: PostgREST filter 박기 전 컬럼 위치 확인 필수
- 진짜 fix 방향: raw_listings 쪽에서 filter 후 join (별도 wave)
