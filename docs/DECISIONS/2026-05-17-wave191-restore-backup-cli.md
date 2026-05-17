# Wave 191 — 백업 복원 CLI utility + runbook (사고 시 사용)

## 컨텍스트

Wave 186 (백업 endpoint) + Wave 189 (Vercel cron 등록) 박았지만 **복원 방법 미박힘** → 사고 발생 시 수동 SQL 조작 필요.

> "백업 복원 utility (별도 wave)" — Wave 186 follow-up 명시.

## 기존 로직 충돌 검토

restore 는 본질적으로 destructive (UPSERT). 검토 결과:

| 테이블 | 운영 변경 | 충돌 risk |
|---|---|---|
| `mvp_user_credits` | 결제/사용 event | ✅ 안전 (UPSERT on user_ref + auth_user_id) |
| `mvp_user_plans` | 결제 event | ✅ 안전 (UPSERT on auth_user_id) |
| `mvp_reveal_feedback` | 신고 + 운영자 응답 | ✅ 안전 (UPSERT on user_ref + pid) |
| `mvp_candidate_pool` | tick-pipeline 정기 갱신 | ⚠️ 즉시 재계산 — 복원 의미 약함 |
| `mvp_market_velocity_daily` | 일일 집계 (어제 row 박음) | ⚠️ 어제 이전 row 만 안전 |
| `mvp_market_price_daily` | 동일 | ⚠️ 동일 |
| `mvp_listing_parsed` | parser 매물 볼 때 박음 | ⚠️ 다시 덮어씀 |

→ **production endpoint X**, CLI only, dry-run 기본 으로 박음. 기존 로직과 충돌 없음 (사용자 명시 호출만).

## 박은 것

### 1. CLI Script — `scripts/restore-backup.mjs`

#### 안전 보호 5개
1. **CLI 전용** — production API endpoint 안 박음
2. **dry-run 기본** — `--confirm` 없으면 박지 않고 row 수 + sample 출력
3. **테이블별 strategy** — `TABLE_CONFIG` 에 `onConflict` + `safety` 명시
4. **service_role only** — `SUPABASE_SERVICE_ROLE_KEY` 필요 (운영자만)
5. **chunk UPSERT** — 500 row chunk, 일부 실패 시 나머지 진행 + exit code 1

#### 사용법
```bash
# dry-run (안전)
npx tsx scripts/restore-backup.mjs --date=2026-05-16 --table=mvp_user_credits

# 실제 복원 (destructive — 운영자 명시 confirm)
npx tsx scripts/restore-backup.mjs --date=2026-05-16 --table=mvp_user_credits --confirm
```

#### 흐름
1. Storage `mvp-backups/<date>/<table>.jsonl` 다운로드
2. JSONL parse → row 배열
3. 앞 2 row sample 출력 (검증용)
4. dry-run: 안 박고 종료 + 운영 충돌 경고
5. --confirm: 500 row chunk UPSERT (on_conflict 매칭)
6. 결과: success/failed/total 출력

### 2. Runbook — `docs/runbook/restore-backup.md`

사고 발생 시 운영자 SOP:

1. **사전 점검** (사고 후 30분)
   - 사고 영향 범위 파악
   - 백업 존재 확인
   - 운영 중 cron 일시 정지 (필요 시 — Vercel/QStash 콘솔)
2. **복원 흐름**: dry-run → confirm → SQL 검증
3. **테이블별 strategy** (safe/warn 분류)
4. **사고 시나리오별 권고** (시세 손실 / 토큰 손실 / 신고 손실 / parser 손실)
5. **사고 후 follow-up**: decision log + 사용자 알림 + post-mortem

## Trade-off

### Pros
- **PITR 보류 (Wave 184b) 대안 완성** — 사고 시 빠른 복원 가능
- 기존 로직 충돌 없음 (CLI only)
- destructive 5중 보호 (CLI / dry-run / per-table strategy / service_role / chunk)
- runbook 박힘 — 운영자 SOP 명확

### Cons
- 최대 24h 데이터 손실 가능 (어제 backup 까지만 복원)
- candidate_pool / listing_parsed 복원 의미 약함 (재계산 자동)
- 자동화 X — 사고 시 사용자 수동 실행 필요 (의도적 — destructive 안전)

## Test

CLI script 새 파일 — 기존 코드 변경 0.
`npm run test:core`: 영향 없음 (production 코드 미수정).

## Follow-up

1. **사고 시뮬레이션** — staging 환경에서 복원 test (다음 wave)
2. **사용자 알림 template** — 사고 시 영향 사용자에게 보내는 메시지 sample
3. **자동 사고 감지** — 시세 historical row 수 급감 시 slack 알림 (cron + threshold)
4. **post-mortem template** — 사고 후 decision log 표준화

## Linked

- `2026-05-17-wave186-daily-backup-cron-pitr-alternative.md`
- `2026-05-17-wave189-vercel-cron-daily-backup-schedule.md`
- `2026-05-17-wave184b-pitr-deferred-leaked-password-enabled.md`
- `docs/runbook/restore-backup.md`
