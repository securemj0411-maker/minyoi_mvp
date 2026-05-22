# 2026-05-22 Wave 530 — Admin Pool Price Filter Pagination Fix

## Context
- 운영자 풀에서 `15만원 이하` stats 는 56~57건으로 보이는데 실제 리스트는 4건, 1페이지만 보였다.
- `/api/public/pool-listings?page=1&pageSize=20&status=ready&sort=newest_added&priceBucket=lte_15` 로 재현했다.
  - before: `total=4`, `totalPages=1`, `itemCount=4`
  - stats: `lte_15.ready_count=57`

## Root Cause
- 가격 필터에서 `mvp_listings?price<=150000&limit=5000` 를 전역으로 먼저 가져온 뒤 candidate_pool 과 교집합을 냈다.
- 전체 저가 listing 이 5,000개를 넘으면서 실제 ready candidate pid 대부분이 전역 5,000개 밖으로 밀렸다.
- stats 는 ready pid 를 기준으로 chunk 조회해서 정확했지만, filter 결과만 과소 집계됐다.

## Decision
- 가격 필터는 전역 listing pre-scope 를 하지 않는다.
- candidate_pool base rows 를 먼저 가져온 뒤, 해당 pid 들의 listing price 를 chunk 로 조회해서 price bucket 을 적용한다.
- SKU/source/search pre-scope 는 별도 동작으로 유지한다.

## Implementation
- `src/app/api/admin/pool-listings/route.ts`
  - priceBucket global pid pre-scope 제거.
- `src/app/api/public/pool-listings/route.ts`
  - 동일 수정.

## Verification
- Public mirror API:
  - page 1: `total=57`, `totalPages=3`, `itemCount=20`
  - page 2: `total=57`, `totalPages=3`, `itemCount=20`
- `git diff --check` 통과.

## Note
- `/me` feed 의 `/api/packs/pool` budget filter 는 별도 구현이며, 이번 전역 5,000개 pre-scope 버그와 직접 같은 경로는 아니다.
