# Wave 513 — 운영자 첫 피드 온보딩 숨김과 통계 실패 문구 정리

## 문제
- 운영자 모드에서도 `/me` 진입 시 첫 피드 온보딩이 떠서 운영 흐름을 막았다.
- 안전 통계 API가 timeout/fail 되면 `잠시 후 갱신`, `잠시 후` 숫자판이 고정되어 무한 로딩처럼 보였다.

## 결정
- 운영자는 첫 피드 온보딩을 보지 않는다.
- 일반 사용자는 기존처럼 계정별 1회 온보딩을 유지한다.
- 안전 통계가 실패하면 숫자판을 계속 보여주지 않고, 숫자 없는 설명 문장으로 fallback한다.

## 구현
- `ExploreClient`에 `showFirstFeedIntro` prop을 추가했다.
- `/me`에서 `effectiveAdmin`이면 `showFirstFeedIntro=false`로 전달한다.
- safety stats 실패 후 `잠시 후 갱신` 문구와 rows를 숨긴다.

## 보류
- safety stats를 DB materialized/cache table로 precompute하는 구조는 별도 작업으로 남긴다.
