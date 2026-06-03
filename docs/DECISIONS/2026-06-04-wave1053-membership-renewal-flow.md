# 2026-06-04 Wave 1053 — membership renewal flow

## Trigger

이미 멤버십이 활성화된 회원에게도 `/plans`가 신규 신청 페이지처럼 보이면 어색하다는 피드백이 있었다. 회원은 남은 기간과 만료일을 확인하고, 필요하면 기간을 연장할 수 있어야 한다.

## Decisions

- `/plans`는 회원과 비회원 상태를 분리한다.
- 비회원은 기존처럼 선공개 300명 신청/자리 예약/입금 확인 흐름을 본다.
- 회원은 현재 멤버십 남은 기간, 만료일, 상품 피드 링크, 멤버십 연장 버튼을 본다.
- 회원의 연장 예약도 기존 입금 확인/텔레그램 승인/5분 자동 승인 구조를 그대로 사용한다.
- 연장 승인 시 새 기간은 `now + months`가 아니라 기존 유효 만료일 뒤에 붙인다.
- 연장 pending 상태는 로컬 상태가 아니라 `mvp_membership_applications` DB row로 유지한다.

## Applied

- `mvp_membership_applications.application_kind`를 추가해 `new`와 `renewal`을 구분한다.
- `approve_mvp_membership_application` RPC를 갱신해 활성 plan의 `current_period_end`가 미래면 그 시점을 기준으로 기간을 연장한다.
- `/api/membership/apply`에서 활성 회원의 `intent: "renewal"` 요청은 막지 않고 연장 예약 row를 생성/수정하게 했다.
- `/api/membership/apply` DELETE는 회원의 pending 연장 예약도 취소할 수 있게 했다.
- `/api/membership/deposit-notify`, `/api/membership/status`, cau 운영자 패널에 신규/연장 구분을 반영했다.
- `/plans`와 `MembershipApplicationClient`에 회원용 활성 상태 카드, 남은 기간, 만료일, 연장 기간 선택, 연장 예약/입금 대기 UI를 추가했다.
- 연장 승인 polling은 기존 회원 여부가 아니라 최신 application status가 `approved`인지 확인하게 했다.
- live Supabase DB에 wave1053 migration을 적용하고 컬럼/constraint/RPC body 반영을 확인했다.

## Deferred

- 연장 결제 내역을 별도 매출 리포트로 집계하는 화면은 보류한다.
- 만료 임박 n일 전 자동 알림은 보류한다.
- 회원 전용 할인/재구매 쿠폰 정책은 보류한다.
