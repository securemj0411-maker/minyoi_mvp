# Wave 203 — /me 미개봉 카드 다나와 anchor 실제 적용

## 배경

- 시간: 2026-05-18 14:09 KST
- 사용자 보고: `/me` 내 상품 카드에서 새상품/미개봉인데 "다나와" 라벨만 보이고 실제 시세는 내부 번개장터 median을 쓰는 것 같다는 의심.
- 확인: 의심이 맞았음. Wave 201에서 `pack-open.ts`와 admin pool은 `mvp_reference_prices.effective_price`를 fetch해서 `marketBasisForCandidate()`에 넘기도록 고쳤지만, `/api/packs/me`는 `fetchReferencePrices()` 호출이 빠져 있었음.

## 변경

- `src/app/api/packs/me/route.ts`
  - `fetchReferencePrices` import 추가.
  - `/me` reveal의 `comparable_key` 목록으로 `mvp_reference_prices`를 batch fetch.
  - `marketBasisForCandidate(..., referencePrices)`로 전달해서 `condition_class='unopened'` + reference row 존재 시 `marketBasis.medianPrice`가 다나와/공식 anchor가 되게 수정.
  - 미개봉 + reference anchor가 있는 경우 `/me` 카드의 `marketGapKrw`/`marketStale`도 화면에 표시되는 다나와 anchor 기준으로 계산.

## 왜 `current_profit`도 우회했나

- Wave 190/191의 `current_profit_*` RPC는 reveal row를 자동 갱신하지만, DB 값은 market worker/RPC timing 또는 `mvp_market_price_daily` 기준 값과 섞일 수 있음.
- `/me` 카드에서 `시세`는 다나와 anchor인데 `차익/추천 무효`는 번개 median 기반 current_profit이면 다시 화면 모순이 생김.
- 따라서 `/me` read path에서는 `unopened + referencePrices.has(comparableKey)`일 때 표시 기준 source of truth를 reference anchor로 통일.

## 검증

- `npx tsc --noEmit --pretty false`
  - 실패. 변경 파일과 무관한 기존 오류:
    - `.next/dev/types` vs `.next/types` route type mismatch
    - 오래된 test fixture의 `Sku.released`, `PoolCandidateInput.riskHits/scoreFlags` 누락
- `npm run test:core`
  - 샌드박스에서 tsx IPC pipe EPERM으로 1차 실패 → 승인 후 재실행.
  - 결과: 446/447 pass.
  - 실패 1건은 기존 `tests/wave159h-condition-fallback.test.ts`의 `target sample 부족 → fallback chain 진행` (`flawed !== worn`)으로 본 변경과 무관.

## 위험

- DB/schema 변경 없음.
- `/me` API read path만 변경.
- reference price가 없는 미개봉 comparable_key는 기존처럼 `mvp_market_price_daily` fallback을 유지.
- reference price가 오래된 경우 다나와 anchor 자체 최신성은 `reference-price-refresh` cron 책임.

## 다음

- 실제 `/me`에서 미개봉 카드의 `시세` 숫자가 `mvp_reference_prices.effective_price`와 일치하는지 spot check.
- 필요하면 `recompute_reveal_current_profits` RPC도 unopened + reference anchor 기준으로 재정의하는 별도 wave 검토. 단 현재 `/me` 화면 모순은 read path에서 차단됨.
