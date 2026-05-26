# Wave 885 Part 4 - Cron 시스템 체계적 audit + 스태거 (trade-off 없는 fix)

## 사용자 요청

> "우리 크론들 병목점이나 이런거들 다 조사해봐야할 듯 겹치거나 등등 체계적으로. 무조건 비파괴적이고 좋은 거면 고치고 trade-off 없는 거는."

## Audit 결과

### 1. Cron 전체 인벤토리

| 카테고리 | 개수 | 비고 |
|---|---|---|
| vercel.json 등록 cron | 19 | `*/2`, `*/3`, `*/5`, `*/30`, 매일 등 |
| 코드만 있는 미등록 endpoint | 4 | collect, hotdeal-worker, housekeeper-ai-cache-prune, landing-showcases |
| 총 cron route | 23 | |

**미등록 4개 처분** = 사용자 결정 필요 (의도된 dormant 인지 확인).

### 2. 매 분 동시 실행 cron 수 (Wave 885 박기 전)

| 분 | 동시 cron | 비고 |
|---|---|---|
| 0 | tick + score + lifecycle + joongna + daangn + detail + recovery + manual | **8개** ⚠️ |
| 1 | detail + recovery + manual | 3 |
| 2 | tick + score + pool-warmer + detail + recovery + manual | 6 |
| 3 | detail + recovery + manual + joongna | 4 |
| 5 | lifecycle + daangn + detail + recovery + manual | 5 |

평균: 5.3 / 피크: 8

### 3. DB Lock 체계 (`mvp_cron_locks`)

- cron-guard.ts 의 `acquireCronGuardWithSourceHealth` 작동 중
- 16개 cron 에 lock 박힘 (manual-deposit / safety-stats-warmer / collect 제외)
- 활성 lock 정상 (tick / lifecycle_terminal_recheck / deep_crawl 등)
- **11개 stale watchdog lock row 5-10일 잔존** (무해 but 정리 가능)

### 4. 영구 통계 저장 없음 ⚠️

- cron-guard 의 skipCounters / recentSkips = **lambda in-memory 만**
- lambda 재시작 시 휘발 → 실제 처리량 / skip 비율 / latency 영구 추적 불가
- 진짜 병목 측정 위해선 별도 통계 테이블 필요 (별도 wave)

### 5. 진짜 병목 = score-worker (이미 발견됨, Wave 883)

- score_dirty backlog: 70,441
- 현재: 매 2분 x limit 100 = 분당 50 → 28h drain 필요
- 매 분 x limit 100 = 분당 100 → 14h drain (lambda 비용 2배)
- 매 분 x limit 200 = 분당 200 → 7h drain (lambda 비용 2배 + DB load 2배)

## 박은 fix (trade-off 없음)

### Cron schedule 스태거 (vercel.json)

| Cron | Before | After | 효과 |
|---|---|---|---|
| score-worker | `*/2 * * * *` (0,2,4,...) | `1-59/2 * * * *` (1,3,5,...) | tick (짝수분) 와 분리 |
| lifecycle-worker | `*/5 * * * *` (0,5,10,...) | `1,6,11,...` (offset +1) | tick 0분과 분리 |
| joongna-worker | `*/3 * * * *` (0,3,6,...) | `2,5,8,...` (offset +2) | tick 0분과 분리 |
| daangn-worker | `*/5 * * * *` (0,5,10,...) | `3,8,13,...` (offset +3) | tick 0분과 분리 |
| 나머지 | (그대로) | (그대로) | |

### After 매 분 동시 실행 cron 수

| 분 | 동시 cron | 변화 |
|---|---|---|
| 0 | tick + detail + recovery + manual | **4개** (이전 8) |
| 1 | score + lifecycle + detail + recovery + manual | 5 |
| 2 | tick + joongna + pool-warmer + detail + recovery + manual | 6 |
| 3 | score + daangn + detail + recovery + manual | 5 |
| 4 | tick + detail + recovery + manual | 4 |
| 5 | score + joongna + detail + recovery + manual | 5 |
| 6 | tick + lifecycle + detail + recovery + manual | 5 |
| 8 | tick + joongna + daangn + detail + recovery + manual | 6 |

평균: 4.5 (이전 5.3) / **피크: 6 (이전 8)**

### Trade-off

- ✅ 없음 — cron 빈도 / 처리량 동일, offset 만 분산
- ✅ 의존성 영향 없음 (tick → score 의존 없음, 매물 raw 만 추가하고 다음 cycle 에 score)
- ✅ Vercel cron 한도 / DB pool 영향 없음 (절대량 동일)

## 박지 않은 fix (사용자 결정 필요)

### A. mvp_cron_locks stale row cleanup

```sql
-- 영향: 11개 watchdog stale row 삭제 (lease_until 5-10일 전). 활성 lock 영향 X.
DELETE FROM mvp_cron_locks WHERE lease_until < NOW() - INTERVAL '1 day';
```

DELETE 라 사용자 명시적 confirm 필요 (instruction "DELETE 사전 영향 명시 필수"). 비파괴 (만료 row 만), 무해.

### B. score-worker 빈도 증가 (매 2분 → 매 분)

- 이점: backlog drain 28h → 14h (2배)
- trade-off: lambda invocation 2배, DB load 2배 (단 100 limit 유지 시 per-tick load 동일)

### C. score-worker limit 100 → 200

- 이점: 분당 처리량 2배
- trade-off: per-tick lambda 시간 늘어 timeout 위험 (Wave 883 가 100 으로 낮춘 이유)

### D. 미등록 cron 4개 처분 (collect / hotdeal-worker / housekeeper-ai-cache-prune / landing-showcases)

- 의도된 dormant 인지 확인 필요
- 살아있으면 manual trigger 가능 (운영 의도)
- 죽이려면 endpoint 삭제

## 별도 wave 권장

### Wave 885 Part 5: cron 영구 통계 테이블 신설

```sql
CREATE TABLE mvp_cron_executions (
  id BIGSERIAL PRIMARY KEY,
  mode TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT,
  processed_count INTEGER,
  skipped_reason TEXT,
  detail JSONB
);
CREATE INDEX ON mvp_cron_executions (mode, started_at DESC);
```

- 진짜 병목 측정 가능
- per-cron latency p50/p99
- skip 비율 / lock contention 측정
- 비파괴 (신규 테이블)
- cron 당 row write 1건 추가 (negligible)

cron-guard.ts 의 `acquireCronGuard` / `release` 에 hook 박으면 됨.

## What Not To Do

- vercel cron schedule 에 comment 박지 X — Vercel cron schema `path` + `schedule` 만 accept.
- 미등록 cron 4개 함부로 죽이지 X — manual trigger 의도일 수 있음.
- score-worker 빈도 / limit 증가 즉시 박지 X — lambda 비용 / timeout 위험 trade-off 사용자 결정 필요.

## 후속 verification

24-48h 후:
- Vercel dashboard 의 cron execution log 확인 — 매 분 동시 실행 실제로 분산 됐는지
- DB connection pool 사용률 (Supabase dashboard) — 피크 시점 감소 확인
- watchdog alert 안 울리는지 (이전 5-10일 전 알람 후 0건 — 정상 유지)
