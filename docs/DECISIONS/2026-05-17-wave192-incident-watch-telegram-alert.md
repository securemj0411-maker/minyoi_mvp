# Wave 192 — 자동 사고 감지 cron + 텔레그램 운영자 알림

## 사용자 지적

> "slack?텔레그램으로 하면되는거아닌가? 지금 env.local에 @minyoi_alert_bot 이거 있잖아 이걸로 하면안돼?"

→ **이미 박혀있는 인프라 발견**:
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID` (운영자 알림 전용)
- `src/lib/operational-notifier.ts` — `reportCriticalIncident({ source, summary, context })` utility 박혀있음
- HOTDEAL_ prefix (사용자 알림) 와 별도 — 운영자 알림 충돌 X

기존 인프라 그대로 활용 → 새 코드 최소화.

## 박은 것

### 1. `/api/cron/incident-watch` (GET + POST)

매일 새벽 KST 06:00 (UTC 21:00) 자동 실행 — daily-backup (KST 04:00) 후 2시간.

#### 검사 4개 (Promise.allSettled — 한 검사 실패해도 나머지 진행)

| # | 검사 | severity | 임계 |
|---|---|---|---|
| 1 | 시세 historical row 급감 | 🚨 critical | 어제 row < 7일 평균 × **0.5** |
| 2 | 일일 백업 실패 | 🚨 critical | 어제 Storage 폴더 row=0 |
| 3 | 풀 ready 매물 부족 | ⚠️ warning | < **100건** |
| 4 | 검수 SLA 위반 | ⚠️ warning | inaccurate_report pending > **24h** |

#### 사고 1개 이상 → 텔레그램 알림 한 메시지로 묶음

```
[차익잡이] 운영 사고
source: incident-watch
summary: 🚨 시세 historical row 급감 — 어제 X / 평균 Y | ⚠️ 풀 부족 N건
at: 05/18 06:00:23

context:
  market_historical_rows: { yesterdayCount: 3, weekAvg: 487, ratio: 0.01, threshold: 0.5 }
  pool_ready_count: { count: 47, threshold: 100 }
```

`reportCriticalIncident()` 호출 → `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERT_CHAT_ID` 로 send.

### 2. `vercel.json` cron 추가

```json
{
  "crons": [
    { "path": "/api/cron/daily-backup",   "schedule": "0 19 * * *" },
    { "path": "/api/cron/incident-watch", "schedule": "0 21 * * *" }
  ]
}
```

Vercel Pro plan = 40개 cron 한도 → 여유.

## 기존 로직 충돌 검토 (사용자 요청)

| 검사 항목 | 충돌 risk | 검토 |
|---|---|---|
| 시세 historical | count query — read only | ✅ 안전 |
| 백업 폴더 list | Storage list API — read only | ✅ 안전 |
| 풀 ready count | candidate_pool count — read only | ✅ 안전 |
| 검수 SLA | reveal_feedback count — read only | ✅ 안전 |
| 텔레그램 알림 | 기존 `reportCriticalIncident` 사용 | ✅ 기존 패턴 |

→ **read-only + 기존 알림 인프라 활용** = 충돌 0.

## Trade-off

### Pros
- 기존 텔레그램 알림 인프라 활용 — 추가 인프라 0
- read-only + 비파괴
- 4 검사 한 cron 으로 통합 (Promise.allSettled — 한 검사 실패해도 다른 검사 진행)
- 사고 발생 즉시 운영자 인지 → 24h 안 대응

### Cons
- spam risk — 사고 미해결 상태로 매일 같은 알림 (현재 dedup 로직 X)
  → follow-up: 알림 cooldown (같은 incident.key 24h 안 한 번만)
- 임계값 (0.5 / 100 / 24h) 보수적 — 사용자 base 커지면 조정 필요
- 알림이 텔레그램 한 채널만 — 운영자 핸드폰 안 보면 놓침

## Test

`npm run test:core`: **370/370 pass**. 영향 없음 (새 endpoint + vercel.json 한 줄).

## 첫 호출 (배포 후 권장)

수동 호출로 첫 동작 확인:
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<vercel-domain>/api/cron/incident-watch
```

응답:
- `ok: true/false`
- `incidentCount: N`
- `checks[]`: 4 검사 결과
- `notify`: 텔레그램 send 결과

## Follow-up

1. **알림 dedup** — 같은 incident.key 24h 안 한 번만 (mvp_incident_log table or 메모리 cache)
2. **추가 검사** — DB connection 실패 / API 응답 시간 / cron 실행 실패
3. **임계값 자동 조정** — 사용자 base 변화에 따라 동적 (per-percentile)
4. **resolved 알림** — 사고 해결 시 "회복됨" 메시지 (operational-notifier.ts의 notifyOperationalAlerts 활용 가능)
5. **cooldown 외에도 escalation** — critical 1h 내 미해결 → 추가 알림 (운영자 수면 시 대응)

## Linked

- `2026-05-17-wave186-daily-backup-cron-pitr-alternative.md`
- `2026-05-17-wave189-vercel-cron-daily-backup-schedule.md`
- `2026-05-17-wave191-restore-backup-cli.md`
