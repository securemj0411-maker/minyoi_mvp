# Wave 195 — 운영자 Daily Brief (텔레그램)

## 사용자 결정

> "Daily Brief 우선순위? — 운영자(나) brief 먼저 (추천)"

→ 매일 KST 08:00 텔레그램으로 사이트 상태 brief 발송.

## 박은 것

### 1. `src/lib/operational-notifier.ts` 확장

새 함수 `sendOperatorBrief({ title, lines })`:
- 사고 알림 (`reportCriticalIncident`) 과 별도 (prefix "운영 사고" → "운영 brief")
- 같은 텔레그램 봇/채팅 사용 (TELEGRAM_BOT_TOKEN + TELEGRAM_ALERT_CHAT_ID)

### 2. `/api/cron/operator-brief` (GET + POST)

#### 집계 8 항목 (Promise.allSettled — 한 항목 실패 시 fallback)

```
📊 어제
  신규 가입:      N명
  매수 신고:      N건 (bought feedback)
  정보 오류 신고: N건 (top: 시세 부정확 X건)
  풀 신규 진입:   N건
  일일 백업:      ✅ N개 (2026-05-17)

📦 현재
  풀 ready:       N건
  검수 대기:      N건
```

#### 텔레그램 메시지 예
```
[차익잡이] 운영 brief
📊 어제
  신규 가입:      3명
  매수 신고:      2건
  정보 오류 신고: 5건 (top: 시세 부정확 3건)
  풀 신규 진입:   47건
  일일 백업:      ✅ 7개 (2026-05-17)

📦 현재
  풀 ready:       287건
  검수 대기:      1건
checked: 05/18 08:00:23
```

### 3. `vercel.json` cron 추가

```json
{
  "crons": [
    { "path": "/api/cron/daily-backup",   "schedule": "0 19 * * *" },  // KST 04:00
    { "path": "/api/cron/incident-watch", "schedule": "0 21 * * *" },  // KST 06:00
    { "path": "/api/cron/operator-brief", "schedule": "0 23 * * *" }   // KST 08:00
  ]
}
```

운영자 morning routine: 일어나서 텔레그램 봄 → 사이트 상태 즉시 인지.

## 비파괴 검토

- 8개 집계 모두 read-only (count + storage list)
- 텔레그램 send 만 새 작업 (기존 인프라 활용)
- 기존 cron / API 변경 0
- DB 마이그레이션 0

## Trade-off

### Pros
- 운영자 morning routine 통합 — 매일 사이트 상태 1분 안 파악
- 텔레그램 인프라 활용 (기존 봇/채팅 그대로)
- Promise.allSettled — 한 집계 실패해도 brief 나머지 출력
- 검수 대기 카운트 → 24h SLA 자동 reminder

### Cons
- 텔레그램만 — 핸드폰 안 보면 놓침
- 카테고리 top 1개만 표시 (전체 분포 보려면 `/cau~~/feedback-stats` 페이지)
- 매수 신고 ('bought' feedback) — 사용자가 박지 않으면 0 (현재 상태)

## Test

`npm run test:core`: **375/375 pass**.

## 첫 호출 (배포 후 권장)

수동 호출로 동작 확인:
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<vercel-domain>/api/cron/operator-brief
```

응답 + 텔레그램 메시지 즉시 확인.

## Cron 3개 정리

| Cron | 시간 (KST) | 의도 |
|---|---|---|
| daily-backup | 04:00 | 시세 historical Storage 저장 |
| incident-watch | 06:00 | 사고 자동 감지 (4 검사, dedup 박힘) |
| operator-brief | 08:00 | 운영자 morning routine (어제 stats + 현재) |

→ 4시간 간격, **3개 다 KST 새벽~아침** = 운영자 활동 시간 전 정리.

## Follow-up

1. **사용자 brief** (HOTDEAL_TELEGRAM_BOT 활용) — 사용자 base 커지면
2. **brief 풍부화** — 사고 history / 매출 / acquisition funnel
3. **알림 setting UI** — 운영자가 brief on/off / 시간 변경 (현재 hardcoded)
4. **brief 압축** — text 가 길어지면 summary card image (선택)

## Linked

- `2026-05-17-wave186-daily-backup-cron-pitr-alternative.md`
- `2026-05-17-wave189-vercel-cron-daily-backup-schedule.md`
- `2026-05-17-wave192-incident-watch-telegram-alert.md`
- `2026-05-17-wave193-incident-watch-dedup.md`
