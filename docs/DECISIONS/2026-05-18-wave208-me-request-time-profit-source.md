# Wave 208 — /me 차익 표시는 요청 시점 시세를 source of truth로 사용

## 배경

- 시간: 2026-05-18 16:10 KST
- 사용자 우려: `/me`를 새로고침해도 옛날 시세/옛날 차익이 보이면 안 된다.
- 관련 기존 구조:
  - `mvp_pack_reveals.expected_profit_*`: reveal 당시 snapshot.
  - `mvp_pack_reveals.current_profit_*`: market-worker/RPC가 갱신하는 cached current profit.
  - `/api/packs/me`: 매 요청마다 latest `marketBasis`는 다시 계산하지만, non-reference 상품은 DB `current_profit_min`이 있으면 그 값을 우선 표시했다.

## 문제

`current_profit_min`은 cron/RPC lag에 취약한 cache 값이다.  
따라서 `/me` 요청 시 최신 `mvp_market_price_daily` 또는 `mvp_reference_prices`를 가져와도, 표시 차익은 옛 DB `current_profit_min`에 끌려갈 수 있었다.

즉 Wave 189~207로 아래 문제들은 많이 줄었지만:

- reveal snapshot 그대로 표시되는 문제
- reference label/value mismatch
- sold/deleted lifecycle mismatch

non-reference 상품의 cached `current_profit_min` 우선순위는 여전히 stale display를 만들 수 있었다.

## 결정

`/me` 표시 차익은 request-time `marketBasis.medianPrice - raw.price`를 source of truth로 사용한다.

우선순위:

1. request-time computed `marketBasis.medianPrice - price`
2. computed median이 없을 때만 DB `current_profit_min` fallback
3. `marketStale`도 computed gap이 있으면 그 gap의 음수 여부로 판단

## 변경

`src/app/api/packs/me/route.ts`

- 기존:
  - reference anchor 상품만 request-time gap 우선.
  - 일반 상품은 DB `current_profit_min`이 있으면 우선.
- 변경:
  - 모든 상품에서 request-time computed gap 우선.
  - DB `current_profit_min`은 median 계산 실패 시에만 fallback.
  - DB `market_invalidated_at`도 computed gap이 없을 때만 fallback stale signal.

## 남은 구조와 방어막

- market-worker는 여전히 `mvp_market_price_daily`를 갱신하는 근본 source다.
- market-worker/RPC가 늦어도 `/me`는 `current_profit_min` cache에 의존하지 않는다.
- 단, market-worker 자체가 오래 멈춰서 `mvp_market_price_daily`가 오래된 경우에는 request-time 계산도 오래된 market table을 읽는다.
- 그 경우의 방어막:
  - `cron-watchdog.ts`: market-worker expected 60분, alert after 180분.
  - `incident-watch`: market table freshness incident 감지.
  - reference 상품은 `mvp_reference_prices` anchor를 별도 사용.

## 보류

- market-worker가 멈췄을 때 `/me` 요청에서 raw listings를 직접 읽어 market median을 즉석 재집계하는 on-demand recompute는 보류.
  - 정확한 condition fallback, seller dedupe, outlier trimming, sold/disappeared weighting을 API 요청마다 재현해야 해서 DB 비용과 복잡도가 크다.
  - 다만 이번 변경으로 cached reveal profit stale 문제는 제거했다.
- UI에 "market data computed_at stale" warning을 노출하는 작업은 별도 wave로 검토.

## 검증

- `npm run build`: 통과
- `npm run test:core`: 446/447 통과
  - 기존 실패 유지: `tests/wave159h-condition-fallback.test.ts`의 `target sample 부족 → fallback chain 진행` 케이스가 expected `worn`, actual `flawed`로 실패.
