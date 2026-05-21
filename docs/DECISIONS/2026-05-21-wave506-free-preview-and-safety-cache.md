# Wave 506 — 무료 3회 피드 공개와 안전 통계 캐시

## 문제
- 신규 가입 직후 무료 상세 3회가 남아 있어도 피드 카드의 사진/제목/정확한 금액이 잠긴 preview로 보였다.
- 첫 온보딩 카드의 안전 통계가 `/api/public/safety-stats`에서 매번 다수의 count query를 실행해 로딩이 느렸다.

## 결정
- 무료 상세 잔여 횟수가 1회 이상이면 피드 카드도 공개 상태로 보여준다.
- 상세 모달을 실제로 열 때만 기존 서버 `detail-access` 검증으로 무료 횟수 또는 크레딧을 차감한다.
- 무료 3회를 모두 쓰면 아직 열지 않은 카드는 다시 잠긴 preview로 표시한다.
- 안전 통계 API는 30분 TTL 메모리 캐시와 CDN `s-maxage=1800`을 함께 둔다.

## 구현
- `ExploreClient` 카드 렌더에서 `freePreviewUnlocked`를 추가해 `freeDetailRemaining > 0`이면 카드 마스킹을 해제한다.
- `/api/public/safety-stats`에 scope별 cache key와 `x-minyoi-safety-stats-cache` 헤더를 추가했다.

## 보류
- DB materialized/cache table로 cron precompute 하는 방식은 보류했다. 현재는 public API 캐시만으로 신규 온보딩 체감 속도를 먼저 개선한다.
