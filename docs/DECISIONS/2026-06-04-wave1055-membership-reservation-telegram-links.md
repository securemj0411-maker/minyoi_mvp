# 2026-06-04 Wave 1055 — membership reservation Telegram links

## Trigger

멤버십 연장 예약 텔레그램 알림이 `입금 확인 후 cau 운영자 페이지에서 승인/거절`이라고 안내했다. 앞서 입금 확인 알림에는 세션 없는 승인 링크를 붙였기 때문에 운영 흐름이 일관되지 않아 보였다.

## Decisions

- 신규 신청/연장 예약 알림에도 세션 없는 승인/거절 링크를 붙인다.
- 링크는 기존 `membership_application` HMAC 토큰을 그대로 사용한다.
- 문구는 `입금 확인 후 아래 링크로 승인/거절`로 바꿔, 입금 전 승인 혼선을 줄이면서 cau 페이지 의존처럼 보이지 않게 한다.
- 입금 확인 알림의 승인 링크 구조는 그대로 유지한다.

## Applied

- `/api/membership/apply` 텔레그램 메시지에 승인/거절 URL과 inline keyboard 버튼을 추가했다.
- 신규 신청과 연장 예약 모두 동일하게 적용한다.
- 계약 테스트에 apply route의 `signAdminAction`, inline keyboard, `운영자 세션 불필요` 문구를 추가했다.

## Deferred

- 입금 전 승인 링크를 별도 보류/확인 단계로 나누는 기능은 보류한다.
