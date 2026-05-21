# Wave 505 — 계정별 무료 상세/예산 상태 정합성

## 문제
- 첫 피드 온보딩에서 예산을 확정한 뒤, 무료 상세 3회가 남아 있어도 카드가 모두 유료 잠김처럼 보일 수 있었다.
- 예산 필터 localStorage는 계정별 key를 쓰고 있었지만, `storageScope`가 바뀌는 렌더에서 기존 상태를 새 계정 key에 다시 쓰는 effect가 있어 계정별 저장 의도와 어긋날 수 있었다.

## 결정
- 무료 상세 횟수는 서버 `mvp_rate_limits`/`detailAccess`가 원장이다.
- 클라이언트 localStorage는 계정별 마지막 snapshot 표시 캐시로만 사용한다.
- 예산 필터는 자동 write effect를 제거하고, 사용자가 직접 선택/초기화할 때만 계정별 key에 저장한다.

## 구현
- `ExploreClient`에 `DETAIL_ACCESS_SNAPSHOT_STORAGE_KEY`를 추가하고 `storageScope`별로 읽고 쓴다.
- 초기 무료 상세 상태는 `freeUsed=0`, `freeLimit=3`으로 시작하되, pool/detail-access API 응답이 오면 즉시 서버 값으로 덮어쓴다.
- `freeDetailRemaining`은 nullable snapshot fallback 계산 대신 정규화된 snapshot에서 계산한다.
- 예산 필터 저장은 `updateBudgetFilter`에서만 수행한다.

## 보류
- 무료 상세 3회 자체를 “피드 카드 3개 선공개”로 바꾸는 UX는 보류한다. 현재 모델은 카드 목록은 마스킹 preview이고, 상세 열람 3회가 무료다.
