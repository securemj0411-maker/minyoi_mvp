# 2026-06-06 Wave 1180 — Feed continuation loading

## 결정

- 초기 피드는 빠르게 6개를 먼저 보여주고, 뒤 후보를 붙이는 동안 리스트 아래에 continuation skeleton을 보여준다.
- 기존 자동 remainder 요청은 `silent: true`라 아무 표시 없이 몇 초 후 카드가 갑자기 추가됐다. 사용자는 멈춘 것으로 느낄 수 있어 별도 `continuationLoading` 상태를 추가했다.
- 당근 focused 상태의 `근처 매물 새로고침`은 기존 `loadPool(false)`에서 `loadPool(true)`로 바꿨다. 새로고침 버튼은 cache hit 재조회가 아니라 `refresh=1` + exclude pids로 새 후보를 찾는 의미가 있어야 한다.

## 구현

- `FeedContinuationSkeleton`을 추가해 기존 카드 레이아웃과 비슷한 3개 skeleton row를 표시한다.
- 자동 background append와 수동 refresh 중 기존 피드가 있으면 리스트 아래 skeleton을 보여준다.
- 기존 매물이 있는 refresh에서는 전체 화면 loading overlay를 띄우지 않는다.
- 초기 6개 이후 background append 시작 지연을 줄였다.
  - 당근 focused: 900ms → 250ms
  - 기타: 250ms → 180ms

## 보류

- 당근 background append의 응답 크기(`DAANGN_BACKGROUND_FEED_PAGE_SIZE=500`)는 유지했다.
  - 사용자가 “근처 당근 후보를 빠뜨리지 말라”고 여러 번 강조했기 때문에, 이번 wave에서는 후보 범위를 줄이지 않고 체감 loading만 먼저 정리했다.
  - 이후에도 실제 응답이 너무 느리면, 서버에서 chunked page token 또는 precomputed card table로 구조를 바꾸는 쪽이 맞다.

## 검증

- `npm run lint -- src/components/explore-client.tsx`
- `git diff --check`
- `npm run build`
- `curl -I http://localhost:3000/me`
