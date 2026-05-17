# Wave 189 — daily-backup Vercel Cron 등록 (스케줄링 박음)

## 사용자 결정

> "나 버셀 프로플랜인데 이게 젤 나으려나?? qstash는 지금 8개 넘어서 잘 안돌아가는느낌인데"

**선택**: Vercel Cron.

### 이유
- Vercel Pro plan = cron 40개까지 가능 (Hobby = 2)
- 기존 QStash 13개 cron + 한계 (사용자 "8개 넘어서 안 돌아가는 느낌")
- daily-backup 만 Vercel Cron으로 → 기존 QStash 인프라 영향 X
- 향후 다른 cron 도 점진적으로 Vercel 로 마이그레이션 검토 가능 (별도 wave)

## 박은 것

### `vercel.json` 새로 생성

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-backup",
      "schedule": "0 19 * * *"
    }
  ]
}
```

- **schedule**: `0 19 * * *` = UTC 19:00 = **KST 04:00 매일**
- 야간 트래픽 가장 낮은 시간 → DB 부하 최소
- 사용자 영향 0 (백업은 SELECT 만)

### 주의 사항

Vercel Cron 은 `GET` 으로 호출. `daily-backup` endpoint 는 `GET/POST` 둘 다 받음 (Wave 186) → OK.

Vercel Cron 은 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더 박힘 (Vercel 환경변수 `CRON_SECRET` 자동 사용). 미뇨이 `checkCronAuth` 패턴과 호환.

## 첫 backup 수동 호출 (배포 직후)

Vercel cron 은 다음 스케줄 시점까지 자동 트리거되지 않음. **첫 backup snapshot 확인**:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<vercel-domain>/api/cron/daily-backup
```

응답에 각 테이블별 row 수 / size / duration 박힘. Supabase Storage 콘솔에서 `mvp-backups/YYYY-MM-DD/` 폴더 확인.

## 모니터링

### Vercel 콘솔
1. Project → Settings → Crons
2. `daily-backup` 실행 history + 응답 코드 확인
3. 실패 알림 (Vercel 자동 — Settings → Notifications)

### Supabase Storage
1. Storage → `mvp-backups` bucket
2. 매일 새 폴더 (YYYY-MM-DD) 생성 확인
3. 7개 JSONL 파일 (Wave 186 핵심 테이블 list) 확인

## Trade-off

### Pros
- Vercel Pro 한도 내 (40개) — 여유
- 자동 인증 (CRON_SECRET 환경변수)
- 콘솔 모니터링 통합
- 기존 QStash 안 건드림

### Cons
- 모든 cron 이 분산 (Vercel + QStash) — 운영 측 추적 복잡
- → 향후 모든 cron 을 Vercel 로 마이그레이션 검토 (별도 wave)

## Test

`npm run test:core`: 369/370 pass (1 skipped, 0 fail).
`vercel.json` 추가 — 코드 변경 0, deploy 후 자동 활성화.

## Follow-up

1. **배포 후 수동 호출** — 첫 backup snapshot 즉시 확인
2. **Vercel cron 실행 history 1주 후 점검** — 매일 04:00 KST 정상 실행 확인
3. **기존 QStash 13개 마이그레이션** — Vercel cron 으로 통일 검토 (별도 wave)
4. **백업 복원 script** — 사고 시 빠르게 복원 utility (별도 wave)

## Linked

- `2026-05-17-wave186-daily-backup-cron-pitr-alternative.md` (endpoint 박은 wave)
- `2026-05-17-wave184b-pitr-deferred-leaked-password-enabled.md` (PITR 보류 결정)
