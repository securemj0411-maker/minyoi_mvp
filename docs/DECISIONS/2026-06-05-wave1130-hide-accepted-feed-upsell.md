# 2026-06-05 Wave 1130 - Hide Accepted Feed Upsell

## Decision

- 피드 업셀 연장이 승인되면 기존 업셀 카드 대신 화면 중앙 완료 토스트만 보여준다.
- `/api/membership/status`의 DB 기반 상태를 사용해 최근 활성 멤버십이 `renewal`이면 피드 업셀을 노출하지 않는다.
- 최신 신청이 `renewal`이고 `pending` 또는 `approved` 상태여도 중복 제안을 숨긴다.

## Root Cause

- 피드 업셀은 승인 완료 후에도 카드 본문을 계속 렌더해서, 사용자가 이미 결제/승인된 상태에서 다시 "제안 수락"을 보게 했다.
- `activePlan.memberOfferExpiresAt`만 보고 오퍼를 보여주면, 연장 승인 자체가 새 활성 플랜이 되어 다시 1시간 오퍼처럼 보이는 역효과가 있었다.

## Deferred

- 연장 예약 진행 상태를 피드에서 복구하는 전용 카드 UI는 보류한다. 필요하면 `/plans`의 멤버십 관리 흐름과 통합한다.
