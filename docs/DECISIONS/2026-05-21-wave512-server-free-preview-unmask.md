# Wave 512 — 무료 3회 잔여 시 서버 피드 마스킹 해제

## 문제
- 신규/무료 사용자는 상세 3회가 남아 있어도 `/me` 피드 카드 사진과 제목이 `이어폰/헤드셋 · 미개봉 후보`처럼 마스킹되어 보였다.
- 클릭하면 상세는 3회까지 정상으로 열렸다. 즉 상세 접근 권한 서버 검증은 맞고, 피드 preview payload만 잠긴 상태였다.
- 원인은 `/api/packs/pool`이 무료 사용자면 `detailAccess` 잔여 횟수와 무관하게 `maskFreeFeedItems(items)`를 내려준 점이다. 프론트의 `freePreviewUnlocked`는 원본 payload가 없으면 사진/제목을 복구할 수 없다.

## 결정
- `detailAccess.freeLimit - detailAccess.freeUsed > 0`이면 무료 사용자도 피드에서 원본 사진/제목/가격을 받는다.
- 무료 상세 3회를 모두 쓰면 기존처럼 서버에서 마스킹된 preview를 내려준다.
- 크레딧 보유자/운영자는 기존처럼 항상 원본 피드를 받는다.

## 구현
- `/api/packs/pool` 응답에서 `exactFeedAllowed = creditFeed || freePreviewRemaining > 0` 조건을 추가했다.
- `exactFeedAllowed`가 false일 때만 `maskFreeFeedItems`를 적용한다.
- 계약 테스트에 서버 unmask 조건을 추가했다.

## 보류
- localStorage에 남은 과거 detail access snapshot 정리는 이번 변경으로 우선순위가 낮아졌다. 서버 payload가 잔여 무료 상세 횟수 기준으로 정확히 내려오고, 응답의 `detailAccess`가 클라이언트 snapshot을 다시 덮어쓴다.
