# 2026-05-20 Wave 404 — /me 수익·손실 회피 카운터 제거

## 배경
- 사용자가 `/me` 상단의 “안 잃은 돈”, “이번 달 번 돈” 영역 제거를 요청했다.
- 해당 영역은 `SavedMoneyCounter`가 렌더링하며, PG 심사 관점에서도 수익/손실 회피 표현이 과하게 보일 수 있다.

## 결정
- `/me` 히스토리 섹션에서 `SavedMoneyCounter` import와 렌더링을 제거했다.
- 매물 탐색(`ExploreClient`)과 피드백 활동(`MyFeedbackActivity`)은 유지한다.
- 계약 테스트에 `/me`가 `SavedMoneyCounter`를 렌더하지 않는 검증을 추가했다.

## 보류
- `SavedMoneyCounter` 컴포넌트와 `/api/packs/me/saved-money` endpoint는 즉시 삭제하지 않고 보존한다. 운영/리포트용 재활용 가능성이 있어, 완전 폐기는 별도 정리 작업에서 판단한다.
