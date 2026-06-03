# Wave 1032 — 상세 재진입 판매주기 안정화

## 배경
- 사용자 제보: 쉬운모드에서 같은 상품을 처음 열면 판매주기가 `~일` 형태로 보이는데, 닫았다 다시 열면 같은 상품이 `표본 부족`으로 바뀌는 현상.
- 증상상 원본 lifecycle/velocity 산출 자체보다는 상세 분석 API 결과가 프론트 재진입 경로에서 유실되는 가능성이 높았다.

## 결정 / 구현
- `/me` 피드의 상세 분석 lazy-fill 결과를 `selectedCard`뿐 아니라 `items` 캐시에도 저장하도록 수정했다.
  - `marketBasis`
  - `velocityBasis`
  - `skuListingFlow`
  - `optionBaseAssumed`
- 이미 열린 상품을 다시 열 때 `poolItemToRevealCard`가 저장된 `velocityBasis`/`marketBasis`를 우선 사용하게 했다.
- 스크랩 snapshot으로 변환되는 `revealCardToPoolItem`도 분석 결과를 보존하게 했다.
- 서버 측 `fetchLatestMarketVelocity` merge 로직에서 최신 sparse row가 기존 usable row를 덮지 않도록 보강했다.
  - usable 기준: `observed_sold_sample_count >= 3`, `sold_7d_count > 0`, `median_hours_to_sold > 0`.
  - usable row가 non-usable row보다 우선.
  - 같은 usable/non-usable 상태에서는 computed_at, sold_7d, sold sample 순으로 더 나은 row 선택.

## 보류 / 주의
- DB schema 변경 없음.
- velocity worker throughput 자체 개선은 이번 wave 범위 밖이다.
- `mvp_market_velocity_daily`에 날짜별 usable row가 충분히 없으면 UI가 표본 부족을 표시하는 것은 유지한다.

## 검증
- `npx tsx --test tests/velocity-detail-cache-contract.test.ts`
  - 2 pass, 0 fail.
- `npm run build`
  - Next.js production build / TypeScript 통과.
