# launch-96 — 충전 신청·승인 모델 + 텔레그램 알림 + 자동 grant + admin cleanup

## 사용자 결정

> "cau 관리자페이지에서 플랜 / 플랜만료 / 베타 체험단 다 없애줘"
> "충전신청 누르면 나한테 텔레그램 운영알람 보내주게 + 내가 승인 버튼 누르면 즉시 / 3분내 안누르면 자동 우선 믿고 지급"

## 흐름 변경

### Before (launch-95)
```
사용자 입금완료 클릭 → 즉시 grant → /me redirect
```
양심 신뢰 즉시 grant. 운영자가 따로 통장 보고 의심 시 수동 회수.

### After (launch-96)
```
사용자 입금완료 클릭
  ↓
신청 row insert (status=pending, scheduled_auto_approve_at=now+3min)
  ↓
운영자에게 텔레그램 알림 (승인/거절 link 포함)
  ↓
응답: "신청이 접수됐어요" 모달 + /me redirect
  ↓
(병렬)
  ├─ 운영자가 link 클릭 → /api/admin/manual-deposit/decide → 즉시 grant
  └─ 3분 경과 → cron /api/cron/manual-deposit-auto-approve → 자동 grant
```

## 신규 파일

### Backend
- `supabase/migrations/launch96_manual_deposit_requests.sql` — 신청 table (applied)
- `src/lib/telegram-notify.ts` — `notifyAdminTelegram(message)` helper. env 없으면 silent skip.
- `src/lib/manual-deposit-grant.ts` — `grantManualDeposit(request, decidedBy)` / `rejectManualDeposit` 공통 logic.
- `src/app/api/admin/manual-deposit/decide/route.ts` — 텔레그램 link 클릭 → admin auth → grant/reject. 결과 HTML page.
- `src/app/api/cron/manual-deposit-auto-approve/route.ts` — 매분 cron. pending + scheduled_at 지난 row 다 auto grant.
- `vercel.json` — `* * * * *` schedule 등록.

### Modified
- `src/app/api/billing/manual-deposit/route.ts` — 통째로 변경. 즉시 grant → request row insert + telegram.
- `src/app/billing/manual/manual-deposit-client.tsx` — success modal 카피 변경 ("신청이 접수됐어요" + "운영자 확인 또는 3분 안에 자동 지급돼요").
- `src/app/cauleexxyz...members-table.tsx` — 플랜 / 플랜 만료 / 일일 사용 / 최근 결제 / 베타 체험단 column 제거. 단순화 (닉네임 / 이메일 / 가입일 / 마지막 로그인 / 크레딧 / 회수 / 차단 / provider).

## 환경 변수 (사용자 setup 필요)

```
TELEGRAM_BOT_TOKEN=<BotFather 발급>
TELEGRAM_ADMIN_CHAT_ID=<운영자 chat>
```

둘 다 없으면 telegram 알림 skip — 신청은 정상 진행 + auto-approve 만 작동. 사용자가 push 후 Vercel env 추가.

## DB 변경 (이미 적용됨)

```sql
CREATE TABLE mvp_manual_deposit_requests (
  id BIGSERIAL PRIMARY KEY,
  user_ref TEXT NOT NULL,
  auth_user_id UUID NOT NULL,
  plan_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  price_krw INTEGER NOT NULL,
  depositor_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|auto_approved|rejected
  scheduled_auto_approve_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ NULL,
  decided_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 안전망

- `account_blocked` 체크 (`mvp_user_credits.blocked_at`) — 차단 사용자 신청 거부.
- 같은 사용자 pending 신청 또는 30분 내 직전 신청 차단.
- decide endpoint admin auth 필수 (`isAdminUser`).
- cron endpoint `checkCronAuth` (CRON_SECRET).
- telegram fail 해도 신청 자체 유효 (auto-approve 가 fallback).
- 모든 grant/reject 가 ledger 에 audit (`event_type` 으로 admin/auto 구분).

## 검증

- [x] DB migration applied
- [x] TS 컴파일 통과
- [ ] 사용자 env (TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID) Vercel 추가
- [ ] 사용자가 신청 → 텔레그램 알림 도착 확인
- [ ] 승인 link 클릭 → admin auth → grant page 표시 확인
- [ ] 3분 후 cron auto grant 확인

Owner: caulee1227@gmail.com / 2026-05-24
