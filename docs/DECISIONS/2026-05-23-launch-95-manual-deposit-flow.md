# launch-95 — 토스페이먼츠 가맹심사 중 임시 계좌이체 + 양심 신뢰 + 운영자 회수/차단

## 사용자 결정

> "지금 우리 크레딧 충전 누르면 일단 내 계좌로 입금하라고 하고 ... 토스페이먼츠 카드결제 가맹심사 중이라고 빠르면 이번주내에 정식으로 된다고 그전까진 계좌로 해주라"
> "입금하고 입금완료 버튼 누르면 바로 크레딧 지급"
> "운영자 확인 절대 안되고 내가 은행앱 webhook그런거 자체가 불가능 → 양심 신뢰하고 일단 30분 내로 20 크레딧 다 쓸일 없으니까 30분 내로 충전하려고 하면 막아"
> "막는 메세지가 30분 뒤에 다시 시도라고 하면 안됨"
> "운영자 페이지에서 회원 크레딧 회수 및 차단 버튼 만들고 나중에 추후 조취"

## 흐름

```
/plans (충전 패키지 카드)
  → "충전하기" 버튼
  → /billing/manual?credits=20 (또는 200, 500)
  → 계좌 안내 + 입금자명 input
  → "입금 완료 — 즉시 20크레딧 받기" 버튼
  → POST /api/billing/manual-deposit
    ├─ blocked_at 체크 → 거부 ("결제가 차단된 계정")
    ├─ last_manual_deposit_at < 30분 → 거부 ("이미 진행 중인 신청이 있어요")  ← 시간 명시 X (사용자 지시)
    ├─ balance += plan.monthlyCredits
    ├─ ledger insert (event_type=manual_deposit_grant + depositor_name)
    └─ last_manual_deposit_at = now()
  → minyoi:credits-changed 이벤트 + /explore redirect
```

운영자 측:
```
/cauleexxyz... (회원 목록)
  ├─ 회수 input + 버튼 → POST /api/admin/credits/revoke
  │     balance -= amount + ledger event_type=admin_revoke
  └─ 차단/해제 토글 → POST /api/admin/user/block
        blocked_at = now() or null + ledger event_type=admin_block/unblock
```

## DB 변경 (`wave_launch95_manual_deposit_columns` migration applied)

```sql
ALTER TABLE mvp_user_credits
  ADD COLUMN blocked_at TIMESTAMPTZ NULL,
  ADD COLUMN blocked_reason TEXT NULL,
  ADD COLUMN last_manual_deposit_at TIMESTAMPTZ NULL;

CREATE INDEX idx_user_credits_blocked_at
  ON mvp_user_credits(blocked_at) WHERE blocked_at IS NOT NULL;
```

## 파일

### Frontend
- **`src/app/billing/manual/page.tsx` + `manual-deposit-client.tsx` (신규)** — 계좌이체 안내
  - 우리은행 1002-367-160511 / 이민제
  - 복사 아이콘 (토스 톤 — `#3182f6`, 클릭 시 ✓ 1.6s)
  - 패키지 요약 카드 (블루 그라데이션)
  - 입금자명 input + "입금 완료 — 즉시 N크레딧 받기" 버튼
  - submitting 시 3 dots staggered bounce
  - success 시 1.4s 후 `/explore` redirect
- **`src/app/plans/page.tsx`** — "충전하기" link `/billing/checkout` → `/billing/manual` (가맹 승인 후 복원)

### Backend
- **`POST /api/billing/manual-deposit` (신규)** — 양심 신뢰 grant + rate limit
- **`POST /api/admin/credits/revoke` (신규)** — 운영자 회수
- **`POST /api/admin/user/block` (신규)** — 운영자 차단/해제

### Admin UI
- **`members-table.tsx`** — 회수 input + button + 차단/해제 toggle 신규 2 column

## 보안 / fraud 대응

- **Rate limit 30분** — 한 사용자가 짧은 시간에 여러 번 grant 시도 차단. 메시지에 "30분" 표시 X (사용자 지시).
- **차단 사용자** — 다음 manual-deposit POST 시 즉시 403 거부. 추후 다른 결제 path 도 동일 패턴 적용 가능.
- **Ledger audit** — 모든 grant/revoke/block 이벤트가 `mvp_credit_ledger` 에 박힘. metadata 에 depositor_name + admin_email + reason.
- **운영자 수동 점검** — 통장 입금 안 확인된 사용자 → admin page 에서 회수 + 차단.

## 가맹 승인 후 복원

PortOne (토스페이먼츠) 가맹 승인되면:
1. `src/app/plans/page.tsx` 의 link 만 `/billing/manual` → `/billing/checkout` 으로 되돌리면 됨
2. `/billing/manual` 페이지는 keep (예외 fallback 또는 deprecate)
3. `/api/billing/manual-deposit` 도 keep — admin 수동 처리용으로 활용 가능

## 검증

- [x] TS 컴파일 통과 (내 변경 0 에러)
- [x] DB migration applied (supabase MCP)
- [ ] 폰에서 /plans → /billing/manual 진입 + 계좌 복사 + 입금자명 입력 + 완료 → 크레딧 지급 + /explore (사용자)
- [ ] 30분 내 재시도 → 차단 메시지 ("이미 진행 중인 신청이 있어요")
- [ ] /cauleexxyz... admin 페이지에서 회수/차단 button 동작 확인

Owner: caulee1227@gmail.com / 2026-05-23
