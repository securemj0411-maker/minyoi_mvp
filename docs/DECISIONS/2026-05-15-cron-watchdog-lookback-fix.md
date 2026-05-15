# 2026-05-15 — Cron watchdog lookback window 동적화 (false positive 차단)

## 트리거
22:51 KST 텔레그램 운영 알림:
```
source: cron_watchdog
summary: [reference-price-refresh] 6시간+ 안 돔 (예상 1440분 주기)
```

## 진단
두 가지 문제 동시 발견:

### (a) reference-price-refresh 한 번도 호출 안 됨 (사용자 액션 미수행)
```sql
select count(*) from public.mvp_collect_runs
where request_path like '/api/cron/reference-price-refresh%';
-- result: 0
```
- 사용자가 QStash schedule 등록을 아직 안 한 상태.
- 등록 URL: `https://minyoi-mvp.vercel.app/api/cron/reference-price-refresh?wait=1`
- Cron expression: `0 19 * * *` (UTC 19시 = KST 04시)
- Authorization: `Bearer minyoi-cron-2026`

### (b) Watchdog 자체 버그 (false positive)
`loadLastRunByWorker()`가 전체 6시간 fixed lookback이었음. 24h 주기 worker는 6시간 안에 절대 안 잡힘 → 정상 동작 중에도 매일 22-23시쯤 false alert 발생.

영향받는 worker:
- `reference-price-refresh` (1440분 주기)
- `compliance-retention` (1440분 주기)
- `housekeeper-ai-cache-prune` (360분 주기 — 경계선)

## Fix

### `src/lib/cron-watchdog.ts` 변경
- `loadLastRunByWorker()` (전체 6시간 fetch) 제거.
- `loadLastRunForTarget(target)` 추가. target별 lookback 동적:
  ```typescript
  Math.max(360, Math.min(target.alertAfterMinutes * 1.5, 48 * 60))
  ```
  - 최소 6시간, 최대 48시간.
  - reference-price-refresh (alertAfter=1800) → 2700분 (45h) lookback.
  - compliance-retention (alertAfter=2880) → 2880분 (48h) lookback.
  - tick (alertAfter=10) → 360분 (6h) lookback (minimum 적용).
- PostgREST `like` filter 사용 (prefix matching):
  ```
  request_path=like.${requestPath}*
  ```
- 10 target 병렬 fetch (`Promise.all`).

### 사용자 액션 (남음)
1. QStash console에서 reference-price-refresh schedule 등록.
2. 등록 후 manual trigger 1번 (검증):
   ```bash
   curl -X POST 'https://minyoi-mvp.vercel.app/api/cron/reference-price-refresh?wait=1' \
     -H 'Authorization: Bearer minyoi-cron-2026'
   ```

## 검증
- TypeScript: validator.ts 외 무에러.
- ESLint: 무에러.
- 다음 tick (1-2분) 후 watchdog 동작 확인 — false positive 사라져야 함.
- reference-price-refresh는 사용자 액션 전까진 진짜 alert 계속 옴 (cooldown 30분).

## 리스크
- 48h lookback도 잡지 못하는 worker가 생기면? — 현재 WATCHDOG_TARGETS 중 alertAfter > 2880인 건 없음. 추후 weekly cron 추가 시 cap 늘리거나 별도 처리 필요.
- 10개 target 병렬 query → REST API 부하 약간 증가 (LIMIT 1 + started_at 인덱스 가정 → 무시 가능).
