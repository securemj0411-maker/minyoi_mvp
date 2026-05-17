# Wave 193 — incident-watch dedup (spam 차단 + 회복 알림)

## 사용자 결정

> "Dedup 박을까? — 박으면 좋다면서??"

→ 박음.

## 문제

Wave 192 incident-watch 매일 새벽 검사 → 사고 미해결 시 **매일 같은 알림** → 운영자 spam.

```
05/17 06:00: 풀 부족 (47건) → 🚨 알림
05/18 06:00: 풀 여전히 부족 → 🚨 같은 알림 또
05/19 06:00: 풀 여전히 부족 → 🚨 또 또
...
```

## 박은 것

### 1. DB 마이그레이션 — `mvp_incident_log`

```sql
CREATE TABLE mvp_incident_log (
  incident_key TEXT PRIMARY KEY,                -- 'market_historical_rows' etc.
  severity TEXT NOT NULL,                       -- 'critical' | 'warning'
  first_alert_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_alert_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detail    TEXT,
  last_context   JSONB,
  resolved_at    TIMESTAMPTZ,                   -- null = 진행 중
  alert_count    INTEGER NOT NULL DEFAULT 1,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mvp_incident_log_unresolved_idx
  ON mvp_incident_log (severity, last_alert_at DESC)
  WHERE resolved_at IS NULL;
```

비파괴 (IF NOT EXISTS).

### 2. `/api/cron/incident-watch` 수정

`DEDUP_WINDOW_HOURS = 24`.

#### 흐름
1. 모든 incident_log row fetch → Map
2. **새 알림 조건** (incidentsToAlert):
   - log 에 없음 (첫 발생)
   - resolved_at 박힘 (회복 후 재발)
   - last_alert_at < 24h 전 (dedup window 지남)
3. **회복 알림 조건** (recovered):
   - log 에 active row (resolved_at = null)
   - 이번 검사에서 ok
4. 알림 후 mvp_incident_log upsert:
   - 새 알림: incident_key + severity + last_alert_at + detail + context, resolved_at = null
   - 회복: resolved_at = now

#### 결과 (사용자 흐름 시뮬레이션)
```
05/17 06:00: 풀 부족 → 🚨 알림 + log 박힘
05/18 06:00: 풀 부족 → 알림 X (24h 안)
05/19 06:00: 풀 부족 → 24h 지남 → 🚨 재알림 + log update
05/20 06:00: 풀 회복 (150건) → ✅ 회복 알림 + resolved_at 박힘
05/21 06:00: 풀 다시 부족 → 회복 후 재발 → 🚨 새 알림 + resolved_at null
```

### 3. Response 추가 필드

- `sentCount` — 실제 send 한 수
- `dedupSkipped` — dedup 으로 skip 한 수
- `recoveredCount` — 회복 알림 한 수
- `recoveredNotify` — 회복 알림 send 결과

## Trade-off

### Pros
- spam 차단 — 사고당 24h 한 번
- 회복 알림 — 자동 detect + 1회 송신 (run-on 안 함)
- mvp_incident_log = 사고 history 분석 용 (alert_count, first_alert_at)
- 비파괴 (read + 새 table)

### Cons
- 24h window 고정 — critical vs warning 동일 (향후 차등 가능)
- 회복 알림이 매번 검사 시점 발생 → 06:00 KST 외 시간 사고 해결 시에도 다음 검사까지 대기

## Test

`npm run test:core`: 370/375 pass.
실패 5개 (`galaxy-book-*`) 는 다른 worktree (Wave 182 Phase 4 Galaxy Book SKU lane) 새 parser 테스트 — 본 wave 무관.

내 변경 (incident-watch + DB 마이그레이션) 회귀 없음.

## Follow-up

- severity 별 dedup window 차등 (critical 12h / warning 24h)
- alert_count 임계 (예: 5회 누적) 시 escalation 알림 (운영자 SOP 강화)
- 회복 알림 채널 분리 옵션 (critical 만 회복 알림)

## Linked

- `2026-05-17-wave192-incident-watch-telegram-alert.md`
