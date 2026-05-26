# Wave 885 Part 5 — cron 영구 통계 테이블 신설 (mvp_cron_executions)

## 배경

Wave 885 Part 4 audit 결과:
- cron-guard 의 `skipCounters` / `recentSkips` = **lambda in-memory only**
- lambda 재시작 / 다른 lambda instance 시 휘발
- 진짜 병목 측정 불가 (per-cron latency / skip 비율 / lock contention)

사용자 결정:
> "5번 ㄱㄱ" — Part 5 (통계 테이블 신설) 진행.

## 박은 fix

### 1. mvp_cron_executions 테이블 신설 (migration)

```sql
CREATE TABLE mvp_cron_executions (
  id BIGSERIAL PRIMARY KEY,
  mode TEXT NOT NULL,
  owner TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
    'running', 'success', 'failed', 'released',
    'skipped_cooldown', 'skipped_running', 'skipped_unhealthy'
  )),
  skip_reason TEXT,
  detail JSONB
);
CREATE INDEX idx_mvp_cron_executions_mode_started_at ON mvp_cron_executions (mode, started_at DESC);
CREATE INDEX idx_mvp_cron_executions_started_at ON mvp_cron_executions (started_at DESC);
CREATE INDEX idx_mvp_cron_executions_status_partial ON mvp_cron_executions (status, started_at DESC)
  WHERE status != 'success';
```

비파괴 — 신규 테이블. 기존 mvp_cron_locks 와 별개.

### 2. cron-guard.ts hook (fire-and-forget)

신규 helper:
- `logCronStart(mode, owner)` — INSERT (status='running')
- `logCronFinish(execId, status, durationMs, detail?)` — PATCH (status='success', finished_at, duration_ms)
- `logCronSkip(mode, owner, reason, detail?)` — INSERT (status='skipped_*', skip_reason)

`acquireCronGuardInternal` hook 위치:
- skip (same_worker_running / cooldown / source_health_unhealthy): `void logCronSkip(...)` 박음
- allowed: `const execIdPromise = logCronStart(...)` 박음
- release callback: `void execIdPromise.then((id) => id && logCronFinish(id, 'success', durationMs))`

**fire-and-forget** — DB write 실패해도 cron 자체 영향 X.

### 3. 데이터 양 예상

- 매 분 5-6 cron × 1440 = 7,200-8,640 rows/일
- 한 달 ~250K rows
- 1 row ≈ 200 bytes (mode/owner/timestamps/jsonb)
- 100MB/월
- 90일 retention 시 ~300MB (Supabase Pro 8GB 한도 안)

## Trade-off

- ✅ 비파괴 (신규 테이블)
- ✅ cron-guard core path 영향 X (fire-and-forget)
- ✅ DB write 부담 매 cron 당 INSERT 1건 + PATCH 1건 — negligible (Supabase REST API 무제한)
- ⚠️ 별도 retention cleanup 필요 — 별도 wave (compliance-retention 활용 가능)
- ⚠️ lambda 종료 직전 fire-and-forget UPDATE 가 누락될 수 있음 — status='running' 으로 잔존. 별도 wave 에서 stale running row → 'released' 정리.

## 테스트

- `tests/cron-guard.test.ts` 8/8 pass (기존 테스트 변경 X).
- Hook 은 fire-and-forget — DB call mock 없이도 통과.
- 실제 INSERT/PATCH 동작은 production deploy 후 mvp_cron_executions row 모니터링으로 확인.

## 활용 예시 — 진짜 병목 측정 가능

```sql
-- per-cron latency p50/p99 (지난 24h)
SELECT mode,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
  COUNT(*) FILTER (WHERE status = 'success') AS success_cnt,
  COUNT(*) FILTER (WHERE status LIKE 'skipped_%') AS skip_cnt,
  COUNT(*) FILTER (WHERE status = 'running') AS running_cnt
FROM mvp_cron_executions
WHERE started_at >= NOW() - INTERVAL '24 hours'
GROUP BY mode
ORDER BY p99_ms DESC NULLS LAST;

-- skip 비율 (지난 24h)
SELECT mode, skip_reason, COUNT(*) AS cnt
FROM mvp_cron_executions
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND skip_reason IS NOT NULL
GROUP BY mode, skip_reason
ORDER BY cnt DESC;

-- stale running rows (leaked)
SELECT mode, owner, started_at, NOW() - started_at AS age
FROM mvp_cron_executions
WHERE status = 'running' AND started_at < NOW() - INTERVAL '1 hour'
ORDER BY started_at;
```

## What Not To Do

- 통계 hook 을 cron critical path 박지 X — 항상 fire-and-forget.
- DB write 실패 시 cron 차단 X — `try/catch` swallow.
- Retention cleanup 즉시 박지 X — 별도 wave 에서 compliance-retention cron 활용.

## 후속 wave

### Part 6: stale running row cleanup
- housekeeper cron 에 hook 박기 OR 신규 mini-cron
- `UPDATE mvp_cron_executions SET status='released', finished_at=NOW() WHERE status='running' AND started_at < NOW() - INTERVAL '10 minutes'`

### Part 7: cron stats admin dashboard
- `/cauleexxyz.../cron-monitor` 신규 페이지
- per-cron p50/p99 / skip 비율 / lock contention 시각화
- 진짜 병목 발견용

### Part 8: 90일 retention cleanup
- compliance-retention cron 에 추가
- `DELETE FROM mvp_cron_executions WHERE started_at < NOW() - INTERVAL '90 days'`

## 24-48h 후 verification

- `mvp_cron_executions` row 증가 확인 (분당 ~10 row 예상)
- per-cron latency p99 측정
- score-worker / tick / daangn-worker 가장 느린 cron 식별
- skip 비율 측정 (cooldown / running / unhealthy)
