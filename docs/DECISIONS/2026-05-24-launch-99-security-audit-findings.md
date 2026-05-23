# launch-99 — 보안 audit findings (fix 전 발견 log)

## 사용자 지시

> "우리 사이트 악용가능한부분이나 버그 같은거 한번 탐색해볼까?"

general-purpose agent 가 codebase + DB advisor 종합 audit (agent id `a37783f849f5384fc`).

## HIGH — 돈 잃을 risk (시급 fix)

### F1. Manual-deposit 무한 grant — 30분 rate limit 만으로는 부족
- **재현**: 사용자 신청 → 3분 자동 grant → **31분 대기** → 다시 신청 → 또 3분 자동 grant. blocked_at 박힐 때까지 무한.
- **위치**: `src/app/api/billing/manual-deposit/route.ts:60-83`
- **fix 후보**:
  - lifetime cumulative grants per user cap (e.g., 일일 1회 / 누적 amount cap)
  - 24h 안 `manual_deposit_*` ledger amount 합산 한도 (e.g., 500 크레딧/일)
  - reject 후 cool-down 연장 (30분 → 24h)
  - 3회 연속 자동 grant 가 입금 확인 안 되면 운영자 알림 + 자동 blocked_at

### F2. `grantManualDeposit` read-then-write race → lost update / 중복 grant
- **재현 (낮은 확률, 가능)**: 운영자 승인 link + cron auto-approve 동시 firing → 둘 다 `currentBalance + amount` upsert → balance 2배 grant 가능.
- **위치**: `src/lib/manual-deposit-grant.ts:25-47`
- **fix**: Supabase RPC 신설 — `UPDATE mvp_manual_deposit_requests SET status='approved' WHERE id=$1 AND status='pending' RETURNING *` 으로 row lock + transactional `UPDATE mvp_user_credits SET balance = balance + amount`. 기존 `refund_mvp_user_credits` 패턴 미러.

### F3. `share-bonus` 동일 race + 검증 부재
- **재현**: `POST /api/packs/pool/share-bonus` 동시 두 번 fire → cooldown 둘 다 통과 → 2 크레딧 grant. 또는 단순히 직접 curl 호출 (카톡 SDK 검증 X — 코드 주석 인정).
- **위치**: `src/app/api/packs/pool/share-bonus/route.ts:73-110`
- **fix**: atomic RPC + share 발생 검증 (예: server-side token + 24h flag).

### F4. `admin/credits/revoke` 동일 race
- **위치**: `src/app/api/admin/credits/revoke/route.ts:33-57`
- **fix**: F2 RPC 패턴.

### F5. 텔레그램 approve GET link CSRF + ID 순차 예측
- **재현**: `https://.../api/admin/manual-deposit/decide?id=X&decision=approve` — 운영자 로그인된 브라우저에서 GET 1회로 즉시 approve. 외부 `<img src="...">` CSRF 가능. id 순차 정수라 예측 가능.
- **위치**: `src/app/api/admin/manual-deposit/decide/route.ts:58-72`
- **fix**: GET 은 confirmation page 만 → POST submit 시 처리. 또는 link query 에 HMAC token 박기 (per request_id, server secret).

## MEDIUM — IDOR / 누출 / DOS

### F6. admin list 의 PII (입금자명, 이메일) 24h 노출
- **위치**: `src/app/api/admin/manual-deposit/list/route.ts`
- **fix**: 운영자 본인만 가능이지만 마스킹 옵션 ("홍*").

### F7. 35+ table RLS 활성 but 정책 0개 (Supabase advisor INFO)
- **영향**: 현재는 deny-all 효과. 향후 정책 추가 시 미세 실수로 ledger/credits 외부 anon 노출 risk.
- **fix**: 각 table 명시적 self-select policy + `REVOKE ALL ... FROM anon, authenticated`.

### F8. error message 가 PostgREST raw 누출
- **재현**: insert 실패 시 `errText.slice(0, 120)` 그대로 사용자 응답 → "duplicate key value violates ... constraint mvp_user_credits_pkey" 같은 schema 누출.
- **위치**: `src/app/api/billing/manual-deposit/route.ts:107-112, 142-145`
- **fix**: 사용자에겐 generic 한 "처리 실패". detail 은 console.error + Sentry 만.

### F9. Public endpoints 대부분 IP-level rate limit 부재
- detail-access / packs-pool 등. credit shortcut 차단이지만 DB R/W 부담.
- **fix**: `check_mvp_rate_limit` RPC 재사용한 shared middleware.

## LOW — hygiene

### F10. `LEGACY_ADMIN_EMAILS` 하드코딩 4개 (`src/lib/auth-users.ts`)
- `caulee1227@gmail.com` 포함 — memory note 의 "Claude.ai 계정" 과 동일. 의도 확인 필요.

### F11. `mvp_payment_events`, `mvp_credit_ledger` 정책 0
- service_role bypass 라 OK 지만 defense-in-depth 필요.

### F12. Supabase Auth `leaked_password_protection` 비활성 (advisor WARN)

## 시급 fix 권장 순서

| # | 작업 | 영향 | 시간 |
|---|---|---|---|
| 1 | F1 — 24h 누적 grant 한도 + reject cool-down 24h | 무한 grant 완전 차단 | 1h |
| 2 | F2 + F3 + F4 — 공통 atomic RPC | race condition + curl abuse 차단 | 2~3h |
| 3 | F5 — GET → POST confirm + HMAC token | CSRF + 텔레그램 leak 보호 | 1h |
| 4 | F8 — error message generic 화 | PostgREST schema 누출 차단 | 30분 |
| 5 | F7 — table RLS 정책 추가 | 장기 안전망 | 2h |

## 미해결 / 후속 wave

- F6 (PII 마스킹) — admin 본인 viewing 이라 risk 낮음
- F9 (rate limit middleware) — 별도 wave
- F10 (admin email DB migration) — 별도 wave  
- F11/F12 — supabase admin console 수정

Owner: caulee1227@gmail.com / 2026-05-24
