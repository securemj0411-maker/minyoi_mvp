# 2026-06-04 Wave 1052 — membership Telegram approval and auto activation

## Trigger

입금 확인을 누른 회원은 5분 안에 승인된다는 확신을 받아야 하고, 운영자는 cau 관리자 세션 없이도 텔레그램에서 바로 승인할 수 있어야 한다는 요구가 있었다.

기존 구조는 입금 확인 요청을 텔레그램으로 보내지만, 최종 활성화는 cau 운영자 페이지에서 직접 눌러야 했다. 사용자가 기다리는 동안 프론트에서도 승인 완료를 감지해 피드로 보내는 상태 처리가 부족했다.

## Decisions

- 멤버십 신청 승인/거절 링크는 HMAC 토큰을 붙인 URL로 만든다.
- 텔레그램 승인 링크는 운영자 웹 세션 없이도 동작하지만, `membership_application` scope 토큰이 맞아야만 처리된다.
- 승인 처리는 DB RPC `approve_mvp_membership_application`으로 원자화한다.
- 회원이 `입금했어요`를 누르면 `deposit_confirmed_at`과 `scheduled_auto_approve_at`을 DB에 남긴다.
- 입금 확인 이후에는 기간/금액 변경과 예약 취소를 막는다.
- 5분 안에 수동 승인되지 않으면 cron이 자동 승인한다.
- 프론트는 pending 상태에서 멤버십 상태를 polling하고, 승인 감지 시 환영 토스트를 띄운 뒤 상품 피드로 이동한다.

## Applied

- `mvp_membership_applications`에 입금 확인 시간, 자동 승인 예정 시간, 결정 source 컬럼을 추가했다.
- live Supabase DB에 wave1052 migration을 적용하고 RPC/function/index 존재를 확인했다.
- `POST /api/membership/deposit-notify`가 텔레그램 승인/거절 링크와 inline URL 버튼을 보내도록 바꿨다.
- `GET /api/admin/membership-applications/decide`를 추가해 텔레그램 HMAC 링크로 바로 승인/거절할 수 있게 했다.
- `POST /api/admin/membership-applications/decide`도 같은 승인 helper/RPC를 사용하게 정리했다.
- `GET /api/membership/status`를 추가해 프론트가 승인 완료를 감지하게 했다.
- `GET /api/cron/membership-auto-approve`와 Vercel cron을 추가해 5분 자동 승인을 처리한다.
- cau 운영자 페이지에는 입금 확인 시간과 자동 승인 예정 시간을 표시한다.
- `/plans` pending UI에 5분 countdown과 승인 완료 toast/redirect를 추가했다.

## Deferred

- 텔레그램 메시지를 승인 후 자동으로 edit/update하는 기능은 보류한다.
- 실제 은행 입금 내역과 신청 금액을 자동 대조하는 기능은 보류한다.
- 5분 SLA의 운영 통계를 별도 dashboard로 집계하는 기능은 보류한다.
