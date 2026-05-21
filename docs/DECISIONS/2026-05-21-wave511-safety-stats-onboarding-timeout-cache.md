# Wave 511 — 첫 피드 안전 통계 무한 확인중 방지

## 문제
- `/me` 첫 피드 온보딩의 "오늘 볼 만한 후보만 남겼어요" 통계가 계속 `확인 중`으로 남을 수 있었다.
- `/api/public/safety-stats`에는 30분 TTL 메모리 캐시와 CDN `s-maxage`가 있었지만, 클라이언트가 `cache: "no-store"`로 호출해 HTTP 캐시 효과를 스스로 줄이고 있었다.
- global 통계는 20개 이상의 count query를 exact로 실행해 콜드스타트/DB 부하 상황에서 느려질 수 있었다.

## 결정
- 첫 온보딩 통계 fetch는 3.5초 timeout을 둔다. 실패해도 피드와 예산 선택 흐름은 막지 않는다.
- 클라이언트 `no-store`를 제거해 CDN/browser cache가 동작하게 한다.
- global safety stats는 value hook 용도이므로 `count=planned`로 낮추고, scoped SKU/lane 통계는 기존처럼 `count=exact`를 유지한다.

## 구현
- `ExploreClient`의 safety stats fetch에 `AbortController` timeout을 추가했다.
- stats fetch 실패/timeout 시에도 `statsLoaded=true`로 전환해 "확인 중" 무한 상태를 끊는다.
- `/api/public/safety-stats` global count preference를 `planned`로 바꿨다.

## 보류
- DB materialized/cache table로 30분마다 precompute하는 구조는 아직 보류한다. 이번 조치는 배포 즉시 체감되는 frontend timeout + CDN cache + lighter count 개선이다.
