# 2026-06-04 Wave 1048 — membership reservation edit and cancel

## Trigger

입금 전 멤버십 자리 예약을 신청한 사용자가 기간을 잘못 골랐거나 마음이 바뀐 경우, 새로고침 이후에도 수정/취소를 할 수 있어야 하는지 검토가 필요했다.

## Decisions

- 현재 멤버십 신청은 결제 완료 구독이 아니라 `입금 전 자리 예약`으로 본다.
- `pending` 예약은 사용자가 직접 기간/금액을 변경할 수 있다.
- `pending` 예약은 사용자가 직접 취소할 수 있다.
- 취소는 별도 DB status를 추가하지 않고 기존 `rejected` 상태로 닫되, `admin_note`에 `user_cancelled_reservation`을 남겨 운영자 거절과 구분한다.
- 승인/입금 완료 이후의 구독 해지, 환불, 기간 변경 정책은 별도 운영 규칙이 필요하므로 이번 작업에서 보류한다.

## Applied

- `/plans`의 pending 신청 상태에 `기간/금액 변경`과 `예약 취소` 버튼을 추가했다.
- pending 상태에서도 플랜 선택 모달을 다시 열 수 있게 프론트 상태 가드를 완화했다.
- 기존 POST 흐름을 재사용해 pending 신청의 `product_key`와 `price_krw`를 업데이트할 수 있게 했다.
- `DELETE /api/membership/apply`를 추가해 사용자가 입금 전 예약을 취소할 수 있게 했다.
- 취소 시 운영자 텔레그램 알림을 보내고, 운영자 페이지 최근 처리 라벨은 `cancelled`로 표시한다.

## Deferred

- 승인 후 멤버십 환불/해지 요청 UI.
- 승인 후 플랜 업그레이드/다운그레이드 정책.
- 실제 결제/정산 시스템과 연결된 subscription cancellation ledger.
