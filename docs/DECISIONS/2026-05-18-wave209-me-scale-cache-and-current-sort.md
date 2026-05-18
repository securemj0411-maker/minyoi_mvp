# Wave 209 — /me 시세 조회 스케일 캐시와 현재 차익 정렬 일치

## 배경

- 시간: 2026-05-18 16:45 KST
- 사용자 우려:
  - `/me` 요청 시마다 시세/차익을 다시 계산하는 방식이 이용자가 많아질 때 감당 가능한지 확인 필요.
  - 시세/차익은 최근 cron 집계값이면 캐시를 써도 되지만, 삭제/판매완료 검증은 항상 해야 한다.

## 현재 구조 확인

`/api/packs/me`는 raw listings 전체를 요청마다 재집계하지 않는다.

- 최대 `MAX_REVEAL_SCAN=500`개 reveal을 읽는다.
- 그 reveal들의 `comparable_key` unique set으로 `mvp_market_price_daily`, `mvp_market_velocity_daily`, `mvp_reference_prices`를 batch 조회한다.
- 표시 차익은 request-time `marketBasis.medianPrice - raw.price` 단순 계산이다.
- 현재 보이는 page slice만 `fetchDetail` live verify 한다.

따라서 시세/차익 계산은 user reveal 수에 bounded linear이며, raw market corpus 크기에 비례하지 않는다.

## 발견한 남은 괴리

Wave 208로 표시 차익은 현재 시세 기준이 되었지만, `/me?sort=profit_high|profit_low` 정렬은 아직 reveal 당시 `expectedProfit*` 기준이었다.

결과적으로 카드에 보이는 차익과 정렬 순서가 다를 수 있었다.

## 결정

1. `/me`의 profit 정렬도 현재 표시 차익 `marketGapKrw` 기준으로 맞춘다.
   - `marketGapKrw`가 없을 때만 기존 `expectedProfit*` fallback.
2. 시세/회전률/레퍼런스 가격 batch fetch에는 서버 프로세스 단위 TTL 캐시를 둔다.
   - `mvp_market_price_daily`: 기본 5분
   - `mvp_market_velocity_daily`: 기본 5분
   - `mvp_reference_prices`: 기본 10분
3. 삭제/판매완료 live verify는 캐시하지 않는다.
   - 사용자가 보는 page slice에 대해서는 기존처럼 live detail 검증을 유지한다.

## 변경

- `src/app/api/packs/me/route.ts`
  - `profit_low`, `profit_high` 정렬 기준을 `marketGapKrw ?? expectedProfit*`로 변경.
- `src/lib/pack-open.ts`
  - `fetchLatestMarketStats`
  - `fetchLatestMarketVelocity`
  - `fetchReferencePrices`
  - 위 3개 함수에 comparable_key별 in-memory TTL cache 추가.

## 운영 해석

- 이용자가 많아져도 시세 계산이 `사용자 수 × 전체 raw market 재집계`로 커지지 않는다.
- 같은 인기 SKU를 여러 사용자가 볼 때는 서버 인스턴스 안에서 같은 market/reference row를 재사용한다.
- 서버리스/멀티 인스턴스 환경에서는 인스턴스마다 캐시가 따로 있으므로 영구 shared cache는 아니다.
  - 그래도 hot instance의 반복 read를 줄이는 1차 방어막이다.
  - 더 큰 규모에서는 Redis/Edge Config 같은 shared cache를 붙일 수 있다.

## 보류

- `/me` 요청에서 raw listings를 즉석 재집계하는 on-demand recompute는 계속 보류.
  - 비용과 latency가 크고, condition fallback/seller dedupe/outlier trim을 API 요청마다 재현해야 한다.
- market data freshness가 오래된 경우 UI에 명시 warning을 보여주는 작업은 별도 wave로 남긴다.

## 검증

- `npm run build`: 통과
- `npm run test:core`: 446/447 통과
  - 기존 실패 유지: `tests/wave159h-condition-fallback.test.ts`의 `target sample 부족 → fallback chain 진행` 케이스가 expected `worn`, actual `flawed`로 실패.
