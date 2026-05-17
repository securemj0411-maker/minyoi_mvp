# 2026-05-17 preview-pool: 30만 이하 + SKU/카테고리 다양화

## 사용자 요청

> "유저 진입장벽 매입가 보면 너무 높으니까 30만원 이하로만 보여주자
> 그리고 상품도 너무 같은 sku, lane이면 그러니까 좀 다양화
> lane이 달라도 비슷한거일수도있으니까 이거도 좀 잘해보자"

## 박은 변경

### 1. 가격 cap (30만원 이하)
```ts
const MAX_PRICE_KRW = 300_000;
```
- `mvp_listings.price` SQL 필터 (`price=lte.300000`) — DB 단에서 차단
- 비로그인 사용자 진입장벽 ↓

### 2. SKU 다양화
- `mvp_raw_listings.sku_id` batch fetch
- 같은 SKU 1개만 — "애플워치 5개 보임" 차단
- 5종 못 채울 시 SKU dedup 유지하고 카테고리 중복 허용

### 3. 카테고리 다양화 (기존 유지 강화)
- 같은 category 1개만 우선 박음
- SKU dedup 와 같이 적용

### 4. fetch 전략
- pool fetch limit 80 → 200 (filter 후 5개 확보)
- listings + raw_listings 병렬 fetch (Promise.all)
- price filter 통과 + SKU dedup 통과한 매물만 선택

## DB 사전 확인 (작업 전)

- 30만 이하 ready 매물: 137건 ✅
- distinct SKU: 38종 ✅
- distinct 카테고리: 7종 ✅

다양화 인프라 충분.

## Trade-off

- pool limit 200 = 응답 size 약간 ↑ (정상)
- 같은 SKU 매물 다 표시 X — 대신 다른 SKU 표시 (다양성 win)
- 30만 초과 매물 (band 3 high-profit) 비로그인 노출 X — 로그인 후만 노출
- 진입장벽 ↓ vs 차익 큰 매물 hook 약화 (balance)

## 다음 (보류)

- `lane` 다양화 — 같은 family (smartphone/iphone-series) 안에서도 다양화 (Wave 후속)
- 30만 cap dynamic (사용자 plan tier 기반) — 별도 정책

## Commit

다른 세션 commit `27b4013` (Wave 159g) 에 squash 됨. 코드 박혀있고 push 됨.

## Test

288/288 pass.
