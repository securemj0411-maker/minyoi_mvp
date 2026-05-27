# 2026-05-27 — Wave 889 Guest Preview Market Gap Recompute

## Problem

- 비회원 메인 `지금 인기 매물 미리보기`에서 `매입가`, `시세`, `낮음/차익` 숫자가 서로 모순될 수 있었다.
- 원인은 `/api/preview-pool`이 `mvp_candidate_pool.expected_profit_*`의 과거 계산값을 그대로 내려주면서, 화면의 `시세`는 `mvp_listings.sku_median` 최신값을 보여줬기 때문이다.
- 예: 매입가가 시세보다 높은데도 `2만7천원 낮음`처럼 표시되어 신뢰를 깨는 상태.

## Decision

- 비회원 preview API도 사용자 피드처럼 현재 시세 기준으로 다시 계산한다.
- `mvp_market_price_daily`의 최신 condition-aware median을 우선 사용하고, 없을 때만 `mvp_listings.sku_median`으로 fallback 한다.
- preview 샘플은 `현재 시세 - 매입가 >= 10,000원`인 경우만 노출한다.
- `skuMedian`, `expectedProfitMin`, `expectedProfitMax`, `priceSignalLabel`, `profitLabel`은 모두 같은 현재 market price에서 파생한다.

## Deferred

- 비회원 preview의 `낮음`을 순수 시세 gap으로 유지할지, 상세 피드와 동일한 수수료/배송비 차감 순익으로 바꿀지는 별도 UX wave에서 판단한다.
- 이번 변경은 최소한 화면 안의 매입가/시세/차익 정합성을 맞추는 데 집중한다.

## Verification

- `npx tsx --test --test-name-pattern "guest preview API keeps public sample visible" tests/me-page-contract.test.ts` => pass
- `npm run build` => pass
