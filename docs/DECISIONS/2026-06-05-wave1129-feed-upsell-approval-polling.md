# 2026-06-05 Wave 1129 - Feed Upsell Approval Polling

## Decision

- 피드의 멤버 전용 업셀 카드에도 입금 확인 후 `/api/membership/status` polling을 붙였다.
- 텔레그램 승인 또는 자동 승인으로 해당 연장 신청이 approved 되면 즉시 "멤버십 연장 완료. 기간이 추가됐어요." 토스트를 띄운다.
- 승인 감지 시 부모 피드의 membership status도 갱신해, 피드/업셀/상단 멤버십 상태가 따로 놀지 않게 한다.

## Root Cause

- 신규 가입/플랜 페이지의 `MembershipApplicationClient`는 입금 확인 후 status polling을 하고 있었다.
- 반면 피드 업셀 카드(`FeedMembershipUpsellCard`)는 `deposit_sent`와 카운트다운까지만 처리하고 승인 결과를 다시 조회하지 않았다.
- 그래서 운영자가 텔레그램 승인 링크로 처리해도 DB는 승인됐지만, 피드 UI는 연장 완료를 즉시 알 수 없었다.

## Deferred

- 모든 멤버십 신청/연장 UI를 공용 hook으로 통합하는 작업은 추후 진행한다.
