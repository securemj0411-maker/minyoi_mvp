# Runbook: 백업 복원 (Wave 186 + 191)

사고 발생 시 Supabase Storage `mvp-backups` bucket 의 JSONL 백업을 DB 로 복원.

## 사전 점검 (사고 후 30분 안)

1. **사고 영향 범위** 파악:
   ```sql
   -- 영향 받은 테이블 확인 (예: 시세)
   SELECT date, COUNT(*) FROM mvp_market_price_daily
   WHERE date >= CURRENT_DATE - 7 GROUP BY date;
   ```
2. **백업 존재 확인**:
   - Supabase 콘솔 → Storage → `mvp-backups` → `<날짜>/` 폴더 존재
   - 7개 JSONL 파일 확인 (mvp_user_credits, mvp_user_plans, mvp_reveal_feedback, mvp_candidate_pool, mvp_market_velocity_daily, mvp_market_price_daily, mvp_listing_parsed)
3. **운영 중 cron 일시 정지** (필요 시):
   - Vercel 콘솔 → daily-backup cron 일시 비활성 (사고 폭 안 늘리기)
   - QStash 콘솔 → tick / market-worker / pool-warmer 일시 정지

## 복원 흐름

### Step 1: dry-run (안전 확인)

```bash
npx tsx scripts/restore-backup.mjs --date=2026-05-16 --table=mvp_user_credits
```

출력:
- 다운로드 size
- row 수
- 앞 2 row sample
- 운영 충돌 경고 (해당 시)

✅ row 수 / sample 정상이면 다음 Step.

### Step 2: 실제 복원 (--confirm)

```bash
npx tsx scripts/restore-backup.mjs --date=2026-05-16 --table=mvp_user_credits --confirm
```

- 500 row chunk 로 UPSERT
- 진행상황 stdout (success/failed/total)
- failed > 0 면 exit code 1 + 수동 확인 권장

### Step 3: 검증

```sql
-- 복원 후 row 수 확인
SELECT COUNT(*) FROM mvp_user_credits;

-- 특정 user_ref 복원 검증
SELECT * FROM mvp_user_credits WHERE user_ref = '<특정 user_ref>';
```

## 테이블별 strategy

### ✅ 안전 (운영 변경 X — 즉시 복원 OK)

| 테이블 | UPSERT key | 특이사항 |
|---|---|---|
| `mvp_user_credits` | `user_ref, auth_user_id` | 사용자 토큰 잔액 — **가장 critical** |
| `mvp_user_plans` | `auth_user_id` | 결제 plan |
| `mvp_reveal_feedback` | `user_ref, pid` | 사용자 신고 (정보 오류 신고 포함) |

### ⚠️ 주의 (운영 중 재집계 — 날짜 필터 권장)

| 테이블 | UPSERT key | 충돌 risk |
|---|---|---|
| `mvp_candidate_pool` | `pid` | tick-pipeline 즉시 재계산 → 복원 의미 약함. cron 일시 정지 후 복원. |
| `mvp_market_velocity_daily` | `date, comparable_key, condition_class` | 매일 새벽 집계가 어제 row 박음. **어제 이전 row 만 안전**. |
| `mvp_market_price_daily` | `date, comparable_key, condition_class` | 동일. |
| `mvp_listing_parsed` | `pid` | parser 매물 볼 때 박음 → 다시 덮어씀. mining cron 일시 정지 후 복원. |

## 사고 시나리오별 복원 권고

### 1. 시세 historical 손실 (예: DROP TABLE mvp_market_price_daily 실수)
```bash
# 어제까지의 모든 historical 복원
npx tsx scripts/restore-backup.mjs --date=<어제> --table=mvp_market_price_daily --confirm
npx tsx scripts/restore-backup.mjs --date=<어제> --table=mvp_market_velocity_daily --confirm
```
- 어제 새벽 backup 시점까지 복원
- 오늘 일부 데이터 손실 (24h 이하)

### 2. 사용자 토큰 잔액 손실 (예: 결제 API 버그)
```bash
# 직전 backup 시점으로 복원
npx tsx scripts/restore-backup.mjs --date=<어제> --table=mvp_user_credits --confirm
```
- 결제 cron 일시 정지 후 복원
- 복원 후 결제 event 재처리

### 3. 신고 데이터 손실
```bash
npx tsx scripts/restore-backup.mjs --date=<어제> --table=mvp_reveal_feedback --confirm
```
- 사용자 신고 + 운영자 응답 복원
- 어제 ~ 오늘 사이 신고는 사용자에게 재신고 요청 push 필요

### 4. parser 결과 (mvp_listing_parsed) 손실
- 복원 의미 약함 — parser 가 매물 보면 다시 박음
- 그냥 mining cron 재시작 → 자동 재계산 권장

## destructive 보호 장치

1. **dry-run 기본** — `--confirm` 없으면 박지 않음
2. **테이블별 strategy** — 안전한 것만 즉시 복원, warn 은 cron 정지 안내
3. **CLI only** — production API endpoint X
4. **service_role 만 호출** — `SUPABASE_SERVICE_ROLE_KEY` 필수
5. **chunk UPSERT** — 한 번에 500 row, 일부 실패 시 나머지 진행

## 사고 후 follow-up

1. **decision log** — 사고 원인 + 복원 결과 박기 (`docs/DECISIONS/YYYY-MM-DD-incident-restore.md`)
2. **사용자 알림** — 영향 받은 사용자에게 메시지 (영향 범위 + 보정 완료)
3. **post-mortem** — 같은 사고 차단 방법 검토 (테스트 보강 / 권한 회수 / 정책 변경)

## Linked

- `docs/DECISIONS/2026-05-17-wave186-daily-backup-cron-pitr-alternative.md`
- `docs/DECISIONS/2026-05-17-wave189-vercel-cron-daily-backup-schedule.md`
- `docs/DECISIONS/2026-05-17-wave191-restore-backup-cli.md`
