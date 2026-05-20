# 2026-05-21 관리자 수동 크레딧 지급

## 결정

- 운영자 회원 목록에서 회원별로 크레딧 수량을 입력하고 즉시 지급할 수 있게 한다.
- 별도 페이지를 만들지 않고 기존 난독화 관리자 회원 페이지의 크레딧 열에 입력칸과 `지급` 버튼을 추가한다.
- API는 반드시 admin auth를 통과해야 하며, 지급 전 브라우저 confirm으로 한 번 더 확인한다.

## 구현

- `POST /api/admin/credits/grant`를 추가했다.
- 대상 회원의 `mvp_user_credits` row가 없을 수 있으므로 `claim_mvp_user_credits(..., p_free_grant=0)`로 row를 보장한다.
- 실제 잔액 증가는 기존 `refund_mvp_user_credits` RPC를 재사용하고, ledger metadata에 `source=admin_manual_grant`, 운영자 ID/email, 대상 회원 ID, note를 남긴다.

## 보류

- `mvp_credit_ledger.event_type`에 별도 `admin_grant` 타입을 추가하는 DB migration은 이번 작업에서 보류했다.
- 현재 운영 즉시성을 위해 기존 허용 event type을 사용하고 metadata source로 운영자 지급을 구분한다.
