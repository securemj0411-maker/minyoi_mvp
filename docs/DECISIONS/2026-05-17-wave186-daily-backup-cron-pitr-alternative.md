# Wave 186 — 일일 핵심 테이블 백업 (PITR 대안, cost 0)

## 컨텍스트

Wave 184b 에서 사용자 결정:
> "PITR 보류 (C 옵션) — 다른 우선순위 완성 후 재검토"

메모리 노트 우선순위:
> "PITR 미박힘 → 시점 복원 불가. 시세 historical 한 번 잃으면 못 돌림."

**Mitigation**: PITR add-on (월 $99~) 대신 Supabase Storage 에 매일 핵심 테이블 export (cost 0).

## 박은 것

### 1. Storage Bucket 생성 (`wave186_storage_bucket_mvp_backups`)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mvp-backups',
  'mvp-backups',
  false,                              -- 비공개
  104857600,                          -- 100 MB / 파일
  ARRAY['application/json', 'application/gzip']
)
ON CONFLICT (id) DO NOTHING;
```

비공개 bucket → service_role 만 access. anon/authenticated 차단.

### 2. API — `/api/cron/daily-backup`

#### 흐름
1. `checkCronAuth(req)` — `CRON_SECRET` 검증 (기존 cron 패턴 동일)
2. 핵심 테이블 7개 순회 — SELECT * (5000 row chunk paginate) → JSON Lines
3. Storage PUT: `mvp-backups/<YYYY-MM-DD>/<table>.jsonl` (upsert)
4. 30일 전 폴더 자동 삭제 (보관 정책)
5. 결과 JSON 응답 (table별 row count + size + duration)

#### 핵심 테이블 7개 (작은 것부터)
1. `mvp_user_credits` — 사용자 토큰 잔액 (보호 필수)
2. `mvp_user_plans` — 결제 plan
3. `mvp_reveal_feedback` — 사용자 피드백 (포함 inaccurate_report)
4. `mvp_candidate_pool` — 풀 상태
5. `mvp_market_velocity_daily` — 회전 historical
6. `mvp_market_price_daily` — **시세 historical (가장 critical)**
7. `mvp_listing_parsed` — parser 결과 (재계산 비용 큼, 가장 큰 테이블 — 마지막)

#### 응답
- 모두 성공: 200
- 일부 성공: 207 (Partial Content)
- 모두 실패: 500

각 테이블별 `{ rowCount, sizeBytes, durationMs, ok, error }` 응답 — 운영자 모니터링 용.

### 3. 보관 정책

매일 호출 시 30일 전 폴더 자동 삭제. destructive 정책이지만 **storage cost 통제**를 위해 명시적.

만약 의도적으로 더 오래 보관하고 싶으면 다른 위치로 export 또는 RETENTION_DAYS 상수 변경.

## 사용자 결정 필요 — cron 스케줄링

endpoint만 박힘. 실제 스케줄링은 다음 중 선택 필요:

### 옵션 1: Supabase pg_cron + http extension
```sql
SELECT cron.schedule(
  'mvp-daily-backup',
  '0 19 * * *',  -- UTC 19:00 = KST 04:00
  $$ SELECT net.http_get(
       url := 'https://<vercel-domain>/api/cron/daily-backup',
       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
     ) $$
);
```
**Pros**: 외부 서비스 의존 X, Supabase 내부.
**Cons**: pg_cron + net extension 활성화 필요. CRON_SECRET 을 DB setting 으로 박아야.

### 옵션 2: Vercel Cron (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/daily-backup", "schedule": "0 19 * * *" }
  ]
}
```
**Pros**: 가장 간단. Vercel 콘솔에 자동.
**Cons**: Vercel Pro plan 필요 (Hobby = cron 1개만), 기존 cron 13개 와의 통합 검토 필요. 기존 cron 들이 QStash 사용 중인 경우 충돌 가능성.

### 옵션 3: Upstash QStash (기존 cron 인프라 추정)
- 기존 cron 들이 `x-qstash-schedule-id` 헤더 확인 (`housekeeper/route.ts`)
- QStash 콘솔에서 스케줄 추가
**Pros**: 기존 인프라 통합.
**Cons**: QStash 콘솔 작업.

### 옵션 4: 수동 호출 (당장 첫 백업만)
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<domain>/api/cron/daily-backup
```
첫 backup snapshot 박고 나중에 스케줄링 결정.

## 검증 (배포 후)

1. 수동 호출 → Storage 콘솔에서 `mvp-backups/YYYY-MM-DD/` 확인
2. 각 테이블 JSON Lines 파일 다운로드 → row 수 검증
3. 30일 후 폴더 자동 삭제 확인

## 복원 흐름 (사고 발생 시)

1. Supabase Storage 콘솔 → `mvp-backups/<날짜>/<table>.jsonl` 다운로드
2. JSON Lines parse → INSERT (DDL 호환 검증)
3. 또는 별도 restore endpoint 박기 (TBD)

## Trade-off

### Pros
- **cost 0** — Supabase Pro plan 기본 storage 사용
- 시세 historical 100% 일일 snapshot
- 사용자 피드백/credits/plans 매일 보호
- 운영자 모니터링 가능 (응답에 table별 stats)

### Cons vs PITR
- **분 단위 복원 불가** — 일일 snapshot이라 최대 24h 데이터 손실
- **수동 복원** — restore 자동화 미박힘 (수동 SQL/script 필요)
- **DDL 변경 시 호환 검토 필요** — snapshot 시점 schema 와 복원 시점 schema 다를 때

PITR 가 필요해지면 (사용자 base > 500 또는 historical 손실 사고 1회 발생) 재검토.

## Test

`npm run test:core`: 359/360 pass (1 skipped, 0 fail).
이전 (Wave 185) 실패 2개 (`ipad-7`, `ipad-8`) 는 **다른 worktree (ipad SKU lane) 이 처리 완료** — main 에 반영됨.

## Follow-up

1. **Cron 스케줄링** — 사용자 결정 (4가지 옵션) 후 다음 wave 박기
2. **첫 수동 backup** — 배포 후 즉시 1회 호출해서 동작 확인
3. **Restore script** — 사고 시 빠르게 복원할 수 있는 utility (별도 wave)
4. **Storage 사용량 모니터링** — 30일 누적 사이즈가 free tier (Pro = 100GB) 초과 안 하는지

## Linked

- `2026-05-17-wave184-security-audit-phase1.md`
- `2026-05-17-wave184b-pitr-deferred-leaked-password-enabled.md`
- `2026-05-17-master-plan-deferred-items.md`
