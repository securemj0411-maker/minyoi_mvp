# Wave 989 — staleRunMinutes default 3→6 (mismatch fix)

- 시간: 2026-05-31 19:15 KST
- 트리거: 조사 — market-worker 3건 fail "stale running run auto-marked after 3m".

## 발견

24h timeout fail 조사 후 남은 잔존 fail:

| Fail | 빈도 | error_message |
|---|---:|---|
| market-worker stale 3m | 3/30min | "stale running run auto-marked after 3m" |
| score-worker stale 3m | 1/30min | 동일 |
| lifecycle REST timed out | 1/30min | "Supabase REST timed out" — peak |

duration 측정: market-worker 180~245s (route maxDuration 240s 정상 한도까지 사용).

**원인**: 
- `pipeline-config.ts:603` `staleRunMinutes: envInt("PIPELINE_STALE_RUN_MINUTES", 3, 1, 60)` — default 3 (180s)
- `collect-logs.ts:223` `markStaleCollectRuns(maxAgeMinutes = 3)` — 같은 임계값
- 모든 cron route 가 `markStaleCollectRuns(config.staleRunMinutes)` 호출
- **route maxDuration 240s (market-worker) > staleRunMinutes 180s** → 정상 작업 중인 run 을 다음 cron 이 false-positive fail 마킹

## 변경

`src/lib/pipeline-config.ts:603`:
- default 3 → 6 (360s = 6분)
- 가장 긴 route maxDuration 240s + 2분 margin
- 모든 caller (deep-crawl, daangn-*, collect, joongna, lifecycle, score-worker 등) 가 config.staleRunMinutes 사용 — 자동 적용
- env override `PIPELINE_STALE_RUN_MINUTES` 그대로 (수동 조정 가능)

## 평가

**Trade-off 0**:
- 단순 임계값 변경. 코드 path 변경 0.
- 짧은 cron (예: tick 1분, detail-worker 1분 maxDuration 60s) 도 stale 마킹 6분 후 → 정상 cron 매번 finish 호출하니까 stale 마킹 도달 안 함.
- 영향: 진짜 stuck run (예: PG 부하 peak) cleanup 3분 → 6분 지연. 운영 영향 작음 (다음 cron 시작 시 fail 마킹은 alert일 뿐).

## 검증

- `npx tsc --noEmit` clean
- 다음 30분 안 market-worker stale 3m fail 감소 측정

## 다음

- 24h 후 stale 3m fail 0~1건 도달 확인.
- 잔존 시 maxDuration 자체 줄임 (route별 무거운 stage 분리) — 별개 wave.
- lifecycle PostgREST peak timeout 단발성은 별개 — 발생 빈도 모니터링.
